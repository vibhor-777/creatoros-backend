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
  const payoutMethod = req.body.payoutMethod || 'bank'; // 'bank' or 'upi'
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
    note: `Wallet withdrawal via ${payoutMethod}`
  });

  const user = await User.findById(req.user._id);
  const details = payoutMethod === 'bank' ? user.bankAccount : user.upiDetails;

  const transaction = await Transaction.create({
    buyer: req.user._id,
    seller: req.user._id,
    transactionType: 'wallet_withdrawal',
    paymentGateway: 'wallet',
    amount,
    status: 'pending',
    metadata: {
      payoutMethod,
      details,
      username: user.username,
      email: user.email,
      fullName: user.fullName
    },
    purchasedAt: new Date()
  });

  wallet.ledger[0].referenceTransaction = transaction._id;
  await wallet.save();

  return sendSuccess(res, { wallet, transaction }, 'Withdrawal initiated');
});

const getWithdrawalsForAdmin = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return sendError(res, 'Unauthorized admin access required', 403);
  }

  const withdrawals = await Transaction.find({
    transactionType: 'wallet_withdrawal'
  })
    .populate('buyer', 'fullName email username')
    .sort({ createdAt: -1 });

  return sendSuccess(res, { withdrawals }, 'Withdrawals fetched successfully');
});

const completeWithdrawalForAdmin = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return sendError(res, 'Unauthorized admin access required', 403);
  }

  const { id } = req.params;
  const transaction = await Transaction.findById(id);
  if (!transaction || transaction.transactionType !== 'wallet_withdrawal') {
    return sendError(res, 'Withdrawal transaction not found', 404);
  }

  if (transaction.status !== 'pending') {
    return sendError(res, `Transaction is already in ${transaction.status} status`, 400);
  }

  transaction.status = 'paid';
  await transaction.save();

  return sendSuccess(res, { transaction }, 'Withdrawal marked as completed');
});

const cancelWithdrawalForAdmin = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return sendError(res, 'Unauthorized admin access required', 403);
  }

  const { id } = req.params;
  const transaction = await Transaction.findById(id);
  if (!transaction || transaction.transactionType !== 'wallet_withdrawal') {
    return sendError(res, 'Withdrawal transaction not found', 404);
  }

  if (transaction.status !== 'pending') {
    return sendError(res, `Transaction is already in ${transaction.status} status`, 400);
  }

  transaction.status = 'cancelled';
  await transaction.save();

  const wallet = await ensureWallet(transaction.buyer);
  wallet.availableBalance += transaction.amount;
  wallet.addEntry({
    type: 'credit',
    source: 'refund',
    amount: transaction.amount,
    referenceTransaction: transaction._id,
    note: 'Withdrawal request cancelled and refunded'
  });
  await wallet.save();

  return sendSuccess(res, { transaction, wallet }, 'Withdrawal cancelled and refunded successfully');
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
  transferFunds,
  getWithdrawalsForAdmin,
  completeWithdrawalForAdmin,
  cancelWithdrawalForAdmin
};
