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
    productDoc.files = {
      originalFilePath: req.file.path,
      checksum: createChecksumFromFile(req.file.path)
    };

    if (req.file.mimetype === 'application/pdf') {
      const watermarkedPath = await addPdfWatermark({
        inputPath: req.file.path,
        watermarkText: `CreatorOS • ${req.user.username}`,
        outputFileName: `wm-${req.file.filename}`
      });
      productDoc.files.watermarkedFilePath = watermarkedPath;
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
    'moderation.status': { $ne: 'rejected' }
  };

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
  if (!product || !product.files?.originalFilePath) {
    return sendError(res, 'Download not available for this product', 404);
  }

  const filePath = product.files.watermarkedFilePath || product.files.originalFilePath;
  return res.download(filePath);
});

module.exports = {
  createProduct,
  listProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  downloadProduct
};
