const Wallet = require('../models/Wallet');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');

const ensureWallet = async (userId) => {
  let wallet = await Wallet.findOne({ user: userId });
  if (!wallet) {
    wallet = await Wallet.create({ user: userId });
    await User.findByIdAndUpdate(userId, { wallet: wallet._id });
  }

  return wallet;
};

const getWallet = asyncHandler(async (req, res) => {
  const wallet = await ensureWallet(req.user._id);
  return sendSuccess(res, { wallet }, 'Wallet fetched');
});

const addFunds = asyncHandler(async (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return sendError(res, 'Valid amount is required', 400);
  }

  const wallet = await ensureWallet(req.user._id);
  wallet.availableBalance += amount;
  wallet.addEntry({
    type: 'credit',
    source: 'topup',
    amount,
    note: 'Wallet topup'
  });

  const transaction = await Transaction.create({
    buyer: req.user._id,
    seller: req.user._id,
    transactionType: 'wallet_topup',
    paymentGateway: 'wallet',
    amount,
    status: 'paid',
    purchasedAt: new Date()
  });

  wallet.ledger[0].referenceTransaction = transaction._id;
  await wallet.save();

  return sendSuccess(res, { wallet, transaction }, 'Funds added');
});

const withdrawFunds = asyncHandler(async (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return sendError(res, 'Valid amount is required', 400);
  }

  const wallet = await ensureWallet(req.user._id);
  if (wallet.availableBalance < amount) {
    return sendError(res, 'Insufficient balance', 400);
  }

  wallet.availableBalance -= amount;
  wallet.addEntry({
    type: 'debit',
    source: 'payout',
    amount,
    note: 'Wallet withdrawal'
  });

  const transaction = await Transaction.create({
    buyer: req.user._id,
    seller: req.user._id,
    transactionType: 'wallet_withdrawal',
    paymentGateway: 'wallet',
    amount,
    status: 'paid',
    purchasedAt: new Date()
  });

  wallet.ledger[0].referenceTransaction = transaction._id;
  await wallet.save();

  return sendSuccess(res, { wallet, transaction }, 'Withdrawal initiated');
});

const transferFunds = asyncHandler(async (req, res) => {
  const amount = Number(req.body.amount);
  const recipientUsername = req.body.recipientUsername;

  if (!recipientUsername || !Number.isFinite(amount) || amount <= 0) {
    return sendError(res, 'recipientUsername and valid amount are required', 400);
  }

  const recipient = await User.findOne({ username: recipientUsername.toLowerCase() });
  if (!recipient) {
    return sendError(res, 'Recipient not found', 404);
  }

  if (recipient._id.toString() === req.user._id.toString()) {
    return sendError(res, 'Cannot transfer to self', 400);
  }

  const [senderWallet, recipientWallet] = await Promise.all([
    ensureWallet(req.user._id),
    ensureWallet(recipient._id)
  ]);

  if (senderWallet.availableBalance < amount) {
    return sendError(res, 'Insufficient balance', 400);
  }

  senderWallet.availableBalance -= amount;
  senderWallet.addEntry({
    type: 'debit',
    source: 'transfer_out',
    amount,
    note: `Transfer to ${recipient.username}`
  });

  recipientWallet.availableBalance += amount;
  recipientWallet.addEntry({
    type: 'credit',
    source: 'transfer_in',
    amount,
    note: `Transfer from ${req.user.username}`
  });

  const transaction = await Transaction.create({
    buyer: req.user._id,
    seller: recipient._id,
    transactionType: 'wallet_transfer',
    paymentGateway: 'wallet',
    amount,
    status: 'paid',
    purchasedAt: new Date()
  });

  senderWallet.ledger[0].referenceTransaction = transaction._id;
  recipientWallet.ledger[0].referenceTransaction = transaction._id;

  await Promise.all([senderWallet.save(), recipientWallet.save()]);

  return sendSuccess(
    res,
    {
      transaction,
      senderWallet,
      recipientWallet: {
        user: recipient._id,
        availableBalance: recipientWallet.availableBalance
      }
    },
    'Funds transferred'
  );
});

module.exports = {
  getWallet,
  addFunds,
  withdrawFunds,
  transferFunds
};
