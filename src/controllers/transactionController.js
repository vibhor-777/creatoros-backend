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

  transaction.status = 'on_hold';
  transaction.holdReleaseAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
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

const releaseTransaction = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  const transaction = await Transaction.findById(transactionId);
  if (!transaction) {
    return sendError(res, 'Transaction not found', 404);
  }
  if (transaction.status !== 'on_hold') {
    return sendError(res, `Transaction status is '${transaction.status}', expected 'on_hold'`, 400);
  }
  transaction.status = 'released';
  await transaction.save();
  const Wallet = require('../models/Wallet');
  const User = require('../models/User');
  let wallet = await Wallet.findOne({ user: transaction.seller });
  if (!wallet) {
    wallet = await Wallet.create({ user: transaction.seller });
    await User.findByIdAndUpdate(transaction.seller, { wallet: wallet._id });
  }
  const payoutAmount = transaction.amount - (transaction.platformFee || 0);
  wallet.availableBalance += payoutAmount;
  wallet.addEntry({
    type: 'credit',
    source: 'payout',
    amount: payoutAmount,
    referenceTransaction: transaction._id,
    note: `Payout for transaction ${transaction._id}`
  });
  await wallet.save();
  await User.findByIdAndUpdate(transaction.seller, {
    $inc: { lifetimeEarnings: payoutAmount }
  });
  return sendSuccess(res, { transaction }, 'Transaction funds released successfully');
});

module.exports = {
  createPaymentOrder,
  verifyPayment,
  getMyTransactions,
  releaseTransaction
};
