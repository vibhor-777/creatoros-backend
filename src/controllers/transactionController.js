const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const emailService = require('../services/emailService');
const { createOrder, verifySignature } = require('../services/razorpayService');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');

async function recomputeUserLevel(user) {
  const earnings = user.lifetimeEarnings || 0;
  let newLevel = 1;
  let newBadge = '🌱';

  if (earnings >= 1000000) { newLevel = 10; newBadge = '⭐'; }
  else if (earnings >= 500000) { newLevel = 9; newBadge = '🔱'; }
  else if (earnings >= 300000) { newLevel = 8; newBadge = '🎖️'; }
  else if (earnings >= 150000) { newLevel = 7; newBadge = '👑'; }
  else if (earnings >= 80000) { newLevel = 6; newBadge = '🌟'; }
  else if (earnings >= 40000) { newLevel = 5; newBadge = '🏆'; }
  else if (earnings >= 15000) { newLevel = 4; newBadge = '💎'; }
  else if (earnings >= 5000) { newLevel = 3; newBadge = '🔥'; }
  else if (earnings >= 1000) { newLevel = 2; newBadge = '⚡'; }

  const oldLevel = user.level || 1;
  user.level = newLevel;
  user.levelBadge = newBadge;
  await user.save();
  return { levelUp: newLevel > oldLevel, newLevel, newBadge };
}

async function processTransactionCompletion(transaction, buyerUser, sellerUser) {
  const product = await Product.findById(transaction.product).populate('creator');
  
  if (product && product.productType === 'digital') {
    // Digital products: Go straight to released, credit wallet instantly!
    transaction.status = 'released';
    await transaction.save();

    // Credit seller's wallet
    const netAmount = transaction.amount - (transaction.platformFee || 0);
    const sellerWallet = await Wallet.findOne({ user: transaction.seller });
    if (sellerWallet) {
      sellerWallet.availableBalance += netAmount;
      sellerWallet.addEntry({
        type: 'credit',
        source: 'purchase',
        amount: netAmount,
        referenceTransaction: transaction._id,
        note: `Instant release for digital product sale: ${product.title}`
      });
      await sellerWallet.save();
    }

    // Increment seller lifetime earnings and recompute level
    if (sellerUser) {
      sellerUser.lifetimeEarnings = (sellerUser.lifetimeEarnings || 0) + netAmount;
      await recomputeUserLevel(sellerUser);
    }

    // Send product delivery email to buyer!
    await emailService.sendProductDeliveryEmail(buyerUser, product, transaction);

  } else {
    // Physical products: keep on_hold with 24h escrow hold
    transaction.status = 'on_hold';
    transaction.holdReleaseAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await transaction.save();
  }
}

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

  const sellerUser = await User.findById(transaction.seller);
  const tier = sellerUser?.subscriptionTier || 'Starter';
  let feePercent = 0.15;
  if (tier === 'Core') feePercent = 0.08;
  else if (tier === 'Elite') feePercent = 0.03;
  else if (tier === 'Nexus') feePercent = 0.0;

  const platformFee = Math.round(transaction.amount * feePercent * 100) / 100;

  transaction.platformFee = platformFee;
  transaction.gatewayPaymentId = paymentId;
  transaction.purchasedAt = new Date();

  const buyerUser = await User.findById(transaction.buyer);
  await processTransactionCompletion(transaction, buyerUser, sellerUser);

  if (transaction.product) {
    transaction.product.metrics.purchases += 1;
    await transaction.product.save();
  }

  return sendSuccess(res, { transaction }, 'Payment verified successfully');
});

const releaseEscrow = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  const transaction = await Transaction.findById(transactionId).populate('seller').populate('product');
  if (!transaction) {
    return sendError(res, 'Transaction not found', 404);
  }

  if (transaction.status !== 'on_hold') {
    return sendError(res, `Transaction status is ${transaction.status}, cannot release escrow.`, 400);
  }

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

  const sellerUser = await User.findById(transaction.seller._id);
  if (sellerUser) {
    sellerUser.lifetimeEarnings = (sellerUser.lifetimeEarnings || 0) + netAmount;
    await recomputeUserLevel(sellerUser);
  }

  transaction.status = 'released';
  await transaction.save();

  // If digital product, send email as fallback
  if (transaction.product && transaction.product.productType === 'digital') {
    const buyerUser = await User.findById(transaction.buyer);
    if (buyerUser) {
      await emailService.sendProductDeliveryEmail(buyerUser, transaction.product, transaction);
    }
  }

  return sendSuccess(res, { transaction }, 'Escrow released successfully');
});

const mockPurchase = asyncHandler(async (req, res) => {
  const { productId, guestEmail } = req.body;

  const product = await Product.findById(productId).populate('creator');
  if (!product) {
    return sendError(res, 'Product not found', 404);
  }

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
  let feePercent = 0.15;
  if (tier === 'Core') feePercent = 0.08;
  else if (tier === 'Elite') feePercent = 0.03;
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
    purchasedAt: new Date()
  });

  const buyerUser = await User.findById(buyerId);
  await processTransactionCompletion(transaction, buyerUser, sellerUser);

  product.metrics.purchases += 1;
  await product.save();

  return sendSuccess(res, { transaction }, 'Mock purchase completed.');
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
  getAllTransactions,
  recomputeUserLevel
};
