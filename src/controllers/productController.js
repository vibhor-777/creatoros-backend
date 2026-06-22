const fs = require('fs');
const Product = require('../models/Product');
const { addPdfWatermark } = require('../services/watermarkService');
const { createChecksumFromFile } = require('../services/checksumService');
const { moderateProduct } = require('../services/moderationService');
const { summarizeProductDescription } = require('../services/openaiService');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');

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

  if (req.file) {
    if (productType === 'physical') {
      productDoc.media = {
        demoVideoUrl: `uploads/${req.file.filename}`
      };
    } else {
      productDoc.files = {
        originalFilePath: `uploads/${req.file.filename}`,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        checksum: createChecksumFromFile(req.file.path)
      };

      if (req.file.mimetype === 'application/pdf') {
        try {
          const watermarkedFileName = `wm-${req.file.filename}`;
          await addPdfWatermark({
            inputPath: req.file.path,
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
  return sendSuccess(res, { product }, 'Product created', 201);
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

  await product.save();
  return sendSuccess(res, { product }, 'Product updated');
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
  const product = await Product.findById(req.params.productId);
  if (!product || !product.files) {
    return sendError(res, 'Download not available for this product', 404);
  }

  // Database stored Base64 fallback (removes dependency on ephemeral disk storage)
  if (product.files.fileData) {
    const fileBase64 = product.files.watermarkedFileData || product.files.fileData;
    const fileName = product.files.fileName || 'product-file';
    const mimeType = product.files.mimeType || 'application/octet-stream';
    
    const fileBuffer = Buffer.from(fileBase64, 'base64');
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(fileBuffer);
  }

  // Ephemeral disk fallback
  const filePath = product.files.watermarkedFilePath || product.files.originalFilePath;
  if (!filePath || !fs.existsSync(filePath)) {
    return sendError(res, 'Product file not found on server disk', 404);
  }
  return res.download(filePath, product.files.fileName || 'product-file');
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
  return sendSuccess(res, { product }, `Product successfully ${action}d`);
});


const clearAllProducts = asyncHandler(async (req, res) => {
  await Product.deleteMany({});
  return sendSuccess(res, null, 'All products deleted');
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
  moderateProduct: moderateProductStatus
};
