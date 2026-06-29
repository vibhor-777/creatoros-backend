const fs = require('fs');
const Product = require('../models/Product');
const User = require('../models/User');
const { addPdfWatermark } = require('../services/watermarkService');
const { createChecksumFromFile } = require('../services/checksumService');
const { moderateProduct } = require('../services/moderationService');
const { summarizeProductDescription } = require('../services/openaiService');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');
const { notifyProductModerationResult } = require('../services/emailService');

const toSlug = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);

const createProduct = asyncHandler(async (req, res) => {
  const { title, description, category, amount, productType = 'digital', phase = 'digital-vault', tags = [] } = req.body;

  if (!title || !description || !category || amount === undefined) {
    return sendError(res, 'title, description, category and amount are required', 400);
  }

  const coverImageFile = req.files && req.files['coverImage'] && req.files['coverImage'][0];
  if (!coverImageFile) {
    return sendError(res, 'Cover image is required', 400);
  }

  // Enforce active listing limits (API bypass prevention)
  const isPublished = req.body.isPublished === undefined ? true : Boolean(req.body.isPublished);
  if (isPublished) {
    const activeCount = await Product.countDocuments({ creator: req.user._id, isPublished: true });
    const tier = req.user.subscriptionTier || 'Starter';
    if (tier === 'Starter' && activeCount >= 3) {
      return sendError(res, 'Active listing limit (3) exceeded for Starter tier. Please upgrade to Core, Elite, or Nexus.', 403);
    } else if (tier === 'Core' && activeCount >= 15) {
      return sendError(res, 'Active listing limit (15) exceeded for Core tier. Please upgrade to Elite or Nexus.', 403);
    }
  }

  const moderation = moderateProduct({ title, description });
  if (!moderation.approved) {
    return sendError(res, 'Product did not pass moderation', 422, moderation);
  }

  const slugBase = toSlug(title);
  const slug = `${slugBase}-${Date.now().toString(36)}`;
  const productDoc = {
    creator: req.user._id,
    title,
    slug,
    description,
    category,
    phase,
    productType,
    tags,
    pricing: {
      amount: Number(amount),
      currency: req.body.currency || 'INR',
      discountPercent: Number(req.body.discountPercent || 0)
    },
    isPublished: Boolean(req.body.isPublished)
  };

  // Support both upload.single('file') and upload.fields([{name:'file'},{name:'coverImage'}])
  const primaryFile = req.file || (req.files && req.files['file'] && req.files['file'][0]);

  if (primaryFile) {
    if (productType === 'physical') {
      productDoc.media = {
        demoVideoUrl: `uploads/${primaryFile.filename}`
      };
    } else {
      productDoc.files = {
        originalFilePath: `uploads/${primaryFile.filename}`,
        fileName: primaryFile.originalname,
        mimeType: primaryFile.mimetype,
        checksum: createChecksumFromFile(primaryFile.path)
      };

      if (primaryFile.mimetype === 'application/pdf') {
        try {
          const watermarkedFileName = `wm-${primaryFile.filename}`;
          await addPdfWatermark({
            inputPath: primaryFile.path,
            watermarkText: `CreatorOS • ${req.user.username}`,
            outputFileName: watermarkedFileName
          });
          productDoc.files.watermarkedFilePath = `uploads/watermarked/${watermarkedFileName}`;
        } catch (wmErr) {
          console.error("[Product Controller] Failed to watermark PDF:", wmErr);
        }
      }
    }
  }

  // Save cover image if provided
  if (coverImageFile) {
    if (!productDoc.media) productDoc.media = {};
    productDoc.media.coverImage = `uploads/${coverImageFile.filename}`;
  }

  // Save gallery images if provided (Step 3E)
  const galleryFiles = req.files && req.files['gallery'];
  if (galleryFiles && galleryFiles.length > 0) {
    if (!productDoc.media) productDoc.media = {};
    productDoc.media.gallery = galleryFiles.map(file => `uploads/${file.filename}`);
  }

  if ((process.env.ENABLE_AI_SERVICES || 'true') === 'true') {
    try {
      const summary = await summarizeProductDescription(description);
      if (summary) {
        productDoc.description = `${description}\n\nAI Summary:\n${summary}`;
      }
    } catch (error) {
      productDoc.description = description;
    }
  }

  const product = await Product.create(productDoc);

  // Notify admin about new product submission
  try {
    const { notifyAdminNewProduct } = require('../services/emailService');
    await notifyAdminNewProduct(req.user, product);
  } catch (emailErr) {
    console.error('[Product Controller] Failed to send admin product notification:', emailErr.message);
  }

  const productObj = product.toObject();
  if (productObj.files) {
    delete productObj.files.originalFilePath;
    delete productObj.files.watermarkedFilePath;
    delete productObj.files.fileData;
    delete productObj.files.watermarkedFileData;
  }
  return sendSuccess(res, { product: productObj }, 'Product created', 201);
});

const listProducts = asyncHandler(async (req, res) => {
  const {
    category,
    phase,
    q,
    minPrice,
    maxPrice,
    page = 1,
    limit = 20
  } = req.query;

  const query = {
    isPublished: true,
    $or: [
      { 'moderation.status': 'approved' }
    ]
  };

  if (req.user) {
    query.$or.push({ creator: req.user._id });
  }

  if (category) query.category = category;
  if (phase) query.phase = phase;

  if (minPrice || maxPrice) {
    query['pricing.amount'] = {};
    if (minPrice !== undefined) query['pricing.amount'].$gte = Number(minPrice);
    if (maxPrice !== undefined) query['pricing.amount'].$lte = Number(maxPrice);
  }

  if (q) {
    query.$text = { $search: String(q) };
  }

  const pageNumber = Math.max(Number(page), 1);
  const pageSize = Math.min(Math.max(Number(limit), 1), 100);

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate('creator', 'fullName username avatarUrl')
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize),
    Product.countDocuments(query)
  ]);

  return sendSuccess(res, products, 'Products fetched', 200, {
    total,
    page: pageNumber,
    limit: pageSize,
    pages: Math.ceil(total / pageSize)
  });
});

const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.productId).populate('creator', 'fullName username');
  if (!product) {
    return sendError(res, 'Product not found', 404);
  }

  product.metrics.views += 1;
  await product.save();

  return sendSuccess(res, { product }, 'Product details fetched');
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.productId);
  if (!product) {
    return sendError(res, 'Product not found', 404);
  }

  if (product.creator.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return sendError(res, 'Not authorized to update this product', 403);
  }

  // Enforce active listing limits on draft publish
  const willBePublished = req.body.isPublished !== undefined ? Boolean(req.body.isPublished) : product.isPublished;
  if (willBePublished && !product.isPublished) {
    const activeCount = await Product.countDocuments({ creator: req.user._id, isPublished: true });
    const tier = req.user.subscriptionTier || 'Starter';
    if (tier === 'Starter' && activeCount >= 3) {
      return sendError(res, 'Active listing limit (3) exceeded for Starter tier. Please upgrade to Core, Elite, or Nexus.', 403);
    } else if (tier === 'Core' && activeCount >= 15) {
      return sendError(res, 'Active listing limit (15) exceeded for Core tier. Please upgrade to Elite or Nexus.', 403);
    }
  }

  const mutable = ['title', 'description', 'category', 'tags', 'phase', 'productType', 'isPublished'];
  mutable.forEach((field) => {
    if (req.body[field] !== undefined) {
      product[field] = req.body[field];
    }
  });

  if (req.body.amount !== undefined) {
    product.pricing.amount = Number(req.body.amount);
  }
  if (req.body.discountPercent !== undefined) {
    product.pricing.discountPercent = Number(req.body.discountPercent);
  }

  // If editing title, description, category, or amount, reset moderation to pending
  let requiresReapproval = false;
  if (req.body.title && req.body.title !== product.title) requiresReapproval = true;
  if (req.body.description && req.body.description !== product.description) requiresReapproval = true;
  if (req.body.category && req.body.category !== product.category) requiresReapproval = true;
  if (req.body.amount !== undefined && Number(req.body.amount) !== product.pricing.amount) requiresReapproval = true;

  if (requiresReapproval) {
    product.moderation = {
      status: 'pending',
      reason: null,
      reviewedBy: null,
      reviewedAt: null
    };
    // Notify admin that an edit needs re-approval
    try {
      await emailService.notifyAdminNewProduct(req.user, product);
    } catch(err) {
      console.error('Failed to notify admin of product edit re-approval:', err.message);
    }
  }

  await product.save();
  const productObj = product.toObject();
  if (productObj.files) {
    delete productObj.files.originalFilePath;
    delete productObj.files.watermarkedFilePath;
    delete productObj.files.fileData;
    delete productObj.files.watermarkedFileData;
  }
  return sendSuccess(res, { product: productObj }, 'Product updated');
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.productId);
  if (!product) {
    return sendError(res, 'Product not found', 404);
  }

  if (product.creator.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return sendError(res, 'Not authorized to delete this product', 403);
  }

  await product.deleteOne();
  return sendSuccess(res, null, 'Product deleted', 200);
});

const downloadProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.productId).populate('creator').select('+files.fileData +files.originalFilePath');
  if (!product || !product.files) {
    return sendError(res, 'Download not available for this product', 404);
  }

  const fileName = product.files.fileName || 'product-file';
  const mimeType = product.files.mimeType || 'application/octet-stream';
  const isPDF = fileName.toLowerCase().endsWith('.pdf') || mimeType === 'application/pdf';

  // 1. Fetch transaction details to construct watermark metadata
  const Transaction = require('../models/Transaction');
  const tx = await Transaction.findOne({
    buyer: req.user._id,
    product: product._id,
    status: { $in: ['released', 'on_hold', 'paid'] }
  }).sort({ createdAt: -1 });

  const isCreator = product.creator._id.toString() === req.user._id.toString();
  if (!isCreator && !tx) {
    return sendError(res, 'You must purchase this product to download it', 403);
  }

  const txId = tx ? tx._id.toString() : 'SELF-DOWNLOAD';
  const watermarkText = `Secured for ${req.user.fullName || 'Student'} (${req.user.email || 'buyer@studio-z.in'}) | TxID: ${txId} | StudioZ Campus Safe`;

  // 2. Database stored Base64 fallback (removes dependency on ephemeral disk storage)
  if (product.files.fileData) {
    let fileBuffer = Buffer.from(product.files.fileData, 'base64');
    
    if (isPDF) {
      const { addPdfWatermarkToBuffer } = require('../services/watermarkService');
      try {
        fileBuffer = await addPdfWatermarkToBuffer(fileBuffer, watermarkText, product.creator);
      } catch (err) {
        console.warn("[Watermarking Failed] Serving unwatermarked base64 fallback:", err.message);
      }
    }
    
    res.setHeader('Content-Type', isPDF ? 'application/pdf' : mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(fileBuffer);
  }

  // 3. Ephemeral disk fallback
  const filePath = product.files.originalFilePath;
  if (!filePath || !fs.existsSync(filePath)) {
    return sendError(res, 'Product file not found on server disk', 404);
  }

  let fileBuffer = fs.readFileSync(filePath);
  if (isPDF) {
    const { addPdfWatermarkToBuffer } = require('../services/watermarkService');
    try {
      fileBuffer = await addPdfWatermarkToBuffer(fileBuffer, watermarkText, product.creator);
    } catch (err) {
      console.warn("[Watermarking Failed] Serving unwatermarked disk fallback:", err.message);
    }
  }

  res.setHeader('Content-Type', isPDF ? 'application/pdf' : mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  return res.send(fileBuffer);
});

const getPendingProductsForAdmin = asyncHandler(async (req, res) => {
  const products = await Product.find({ 'moderation.status': 'pending' })
    .populate('creator', 'fullName username email')
    .sort({ createdAt: -1 });

  return sendSuccess(res, { products }, 'Pending products fetched');
});

const moderateProductStatus = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { action, reason } = req.body; // 'approve' or 'reject'

  const product = await Product.findById(productId);
  if (!product) {
    return sendError(res, 'Product not found', 404);
  }

  if (action === 'approve') {
    product.moderation.status = 'approved';
    product.moderation.reason = null;
    product.isPublished = true;
  } else if (action === 'reject') {
    product.moderation.status = 'rejected';
    product.moderation.reason = reason || 'Does not comply with community guidelines';
    product.isPublished = false;
  } else {
    return sendError(res, 'Invalid moderation action', 400);
  }

  product.moderation.reviewedBy = req.user._id;
  product.moderation.reviewedAt = new Date();

  await product.save();

  // Notify creator via email
  try {
    const creator = await User.findById(product.creator);
    if (creator) {
      await notifyProductModerationResult(creator, product, action === 'approve', reason);
    }
  } catch (emailErr) {
    console.error('[Product Controller] Failed to send moderation email:', emailErr.message);
  }

  return sendSuccess(res, { product }, `Product successfully ${action}d`);
});


const clearAllProducts = asyncHandler(async (req, res) => {
  await Product.deleteMany({});
  return sendSuccess(res, null, 'All products deleted');
});
const duplicateProduct = asyncHandler(async (req, res) => {
  const original = await Product.findById(req.params.productId).select('+files.fileData +files.originalFilePath +files.watermarkedFilePath +files.watermarkedFileData');
  if (!original) {
    return sendError(res, 'Product not found', 404);
  }

  if (original.creator.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return sendError(res, 'Not authorized to duplicate this product', 403);
  }

  // Enforce active listing limits on duplicate if published
  if (original.isPublished) {
    const activeCount = await Product.countDocuments({ creator: req.user._id, isPublished: true });
    const tier = req.user.subscriptionTier || 'Starter';
    if (tier === 'Starter' && activeCount >= 3) {
      return sendError(res, 'Active listing limit (3) exceeded for Starter tier. Please upgrade to Core, Elite, or Nexus.', 403);
    } else if (tier === 'Core' && activeCount >= 15) {
      return sendError(res, 'Active listing limit (15) exceeded for Core tier. Please upgrade to Elite or Nexus.', 403);
    }
  }

  const slugBase = toSlug(original.title + '-copy');
  const slug = `${slugBase}-${Date.now().toString(36)}`;

  const duplicated = new Product({
    creator: req.user._id,
    title: `${original.title} (Copy)`,
    slug,
    description: original.description,
    category: original.category,
    tags: original.tags,
    phase: original.phase,
    productType: original.productType,
    pricing: {
      amount: original.pricing.amount,
      currency: original.pricing.currency,
      discountPercent: original.pricing.discountPercent
    },
    inventory: {
      stock: original.inventory.stock,
      sku: original.inventory.sku,
      isUnlimited: original.inventory.isUnlimited
    },
    media: {
      coverImage: original.media.coverImage,
      gallery: original.media.gallery,
      demoVideoUrl: original.media.demoVideoUrl
    },
    files: {
      originalFilePath: original.files.originalFilePath,
      watermarkedFilePath: original.files.watermarkedFilePath,
      fileData: original.files.fileData,
      watermarkedFileData: original.files.watermarkedFileData,
      fileName: original.files.fileName,
      mimeType: original.files.mimeType,
      checksum: original.files.checksum
    },
    moderation: {
      status: 'pending', // Duplicate needs new approval
      reason: null
    },
    isPublished: original.isPublished
  });

  await duplicated.save();

  const productObj = duplicated.toObject();
  if (productObj.files) {
    delete productObj.files.originalFilePath;
    delete productObj.files.watermarkedFilePath;
    delete productObj.files.fileData;
    delete productObj.files.watermarkedFileData;
  }

  return sendSuccess(res, { product: productObj }, 'Product duplicated successfully', 201);
});

module.exports = {
  clearAllProducts,
  createProduct,
  listProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  downloadProduct,
  getPendingProductsForAdmin,
  moderateProduct: moderateProductStatus,
  duplicateProduct
};
