const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const { createOrder, verifySignature } = require('../services/razorpayService');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');

const createPaymentOrder = asyncHandler(async (req, res) => {
  const { productId } = req.body;

  const product = await Product.findById(productId).populate('creator', '_id');
  if (!product) {
    return sendError(res, 'Product not found', 404);
  }

  const order = await createOrder({
    amount: product.pricing.amount,
    currency: product.pricing.currency,
    receipt: `product_${product._id}_${Date.now()}`,
    notes: {
      productId: product._id.toString(),
      buyerId: req.user._id.toString()
    }
  });

  const transaction = await Transaction.create({
    buyer: req.user._id,
    seller: product.creator._id,
    product: product._id,
    transactionType: 'product',
    paymentGateway: 'razorpay',
    gatewayOrderId: order.id,
    amount: product.pricing.amount,
    currency: product.pricing.currency,
    status: 'pending'
  });

  return sendSuccess(
    res,
    {
      order,
      transactionId: transaction._id
    },
    'Payment order created',
    201
  );
});

const verifyPayment = asyncHandler(async (req, res) => {
  const { orderId, paymentId, signature } = req.body;
  if (!orderId || !paymentId || !signature) {
    return sendError(res, 'orderId, paymentId and signature are required', 400);
  }

  const transaction = await Transaction.findOne({ gatewayOrderId: orderId }).populate('product');
  if (!transaction) {
    return sendError(res, 'Transaction not found', 404);
  }

  const valid = verifySignature({ orderId, paymentId, signature });
  if (!valid) {
    transaction.status = 'failed';
    await transaction.save();
    return sendError(res, 'Payment signature verification failed', 400);
  }

  transaction.status = 'paid';
  transaction.gatewayPaymentId = paymentId;
  transaction.purchasedAt = new Date();
  await transaction.save();

  if (transaction.product) {
    transaction.product.metrics.purchases += 1;
    await transaction.product.save();
  }

  return sendSuccess(res, { transaction }, 'Payment verified');
});

const getMyTransactions = asyncHandler(async (req, res) => {
  const transactions = await Transaction.find({
    $or: [{ buyer: req.user._id }, { seller: req.user._id }]
  })
    .populate('product', 'title slug')
    .populate('service', 'title')
    .populate('bounty', 'title')
    .sort({ createdAt: -1 })
    .limit(200);

  return sendSuccess(res, { transactions }, 'Transactions fetched');
});

// Admin: all transactions
const getAllTransactions = asyncHandler(async (req, res) => {
  const transactions = await Transaction.find({})
    .populate('buyer', 'fullName email username')
    .populate('seller', 'fullName email username')
    .populate('product', 'title slug')
    .sort({ createdAt: -1 })
    .limit(500);

  return sendSuccess(res, { transactions }, 'All transactions fetched');
});

module.exports = {
  createPaymentOrder,
  verifyPayment,
  getMyTransactions,
  getAllTransactions
};
