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

  const User = require('../models/User');
  const sellerUser = await User.findById(transaction.seller);
  const tier = sellerUser?.subscriptionTier || 'Starter';
  let feePercent = 0.05;
  if (tier === 'Core') feePercent = 0.03;
  else if (tier === 'Elite') feePercent = 0.015;
  else if (tier === 'Nexus') feePercent = 0.0;

  const platformFee = Math.round(transaction.amount * feePercent * 100) / 100;

  transaction.status = 'on_hold'; // Held in 24hr escrow
  transaction.holdReleaseAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  transaction.platformFee = platformFee;
  transaction.gatewayPaymentId = paymentId;
  transaction.purchasedAt = new Date();
  await transaction.save();

  if (transaction.product) {
    transaction.product.metrics.purchases += 1;
    await transaction.product.save();
  }

  return sendSuccess(res, { transaction }, 'Payment verified and held in escrow');
});

const releaseEscrow = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  const transaction = await Transaction.findById(transactionId).populate('seller');
  if (!transaction) {
    return sendError(res, 'Transaction not found', 404);
  }

  if (transaction.status !== 'on_hold') {
    return sendError(res, `Transaction status is ${transaction.status}, cannot release escrow.`, 400);
  }

  const Wallet = require('../models/Wallet');
  const User = require('../models/User');

  const sellerWallet = await Wallet.findOne({ user: transaction.seller._id });
  const netAmount = transaction.amount - (transaction.platformFee || 0);

  if (sellerWallet) {
    sellerWallet.availableBalance += netAmount;
    sellerWallet.addEntry({
      type: 'credit',
      source: 'purchase',
      amount: netAmount,
      referenceTransaction: transaction._id,
      note: `Escrow release for ${transaction.product ? 'product sale' : 'transaction'}`
    });
    await sellerWallet.save();
  }

  await User.findByIdAndUpdate(transaction.seller._id, {
    $inc: { lifetimeEarnings: netAmount }
  });

  transaction.status = 'released';
  await transaction.save();

  return sendSuccess(res, { transaction }, 'Escrow released successfully');
});

const mockPurchase = asyncHandler(async (req, res) => {
  const { productId, guestEmail } = req.body;

  const product = await Product.findById(productId).populate('creator');
  if (!product) {
    return sendError(res, 'Product not found', 404);
  }

  const User = require('../models/User');
  let buyerId;
  if (req.user) {
    buyerId = req.user._id;
  } else {
    const email = guestEmail || 'guest@studio-z.in';
    let guestUser = await User.findOne({ email });
    if (!guestUser) {
      const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'guest';
      const uniqueUsername = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
      guestUser = await User.create({
        fullName: 'Guest Student',
        username: uniqueUsername,
        email: email,
        password: 'guestpassword123',
        role: 'student',
        eduVerified: false,
        verificationStatus: 'unverified'
      });
    }
    buyerId = guestUser._id;
  }

  const sellerUser = await User.findById(product.creator);
  const tier = sellerUser?.subscriptionTier || 'Starter';
  let feePercent = 0.05;
  if (tier === 'Core') feePercent = 0.03;
  else if (tier === 'Elite') feePercent = 0.015;
  else if (tier === 'Nexus') feePercent = 0.0;

  const platformFee = Math.round(product.pricing.amount * feePercent * 100) / 100;

  const transaction = await Transaction.create({
    buyer: buyerId,
    seller: product.creator._id,
    product: product._id,
    transactionType: 'product',
    paymentGateway: 'manual',
    amount: product.pricing.amount,
    currency: product.pricing.currency || 'INR',
    platformFee: platformFee,
    status: 'on_hold',
    holdReleaseAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    purchasedAt: new Date()
  });

  product.metrics.purchases += 1;
  await product.save();

  return sendSuccess(res, { transaction }, 'Mock purchase successful. Payment held in escrow.');
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
  releaseEscrow,
  mockPurchase,
  getMyTransactions,
  getAllTransactions
};
