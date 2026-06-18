const User = require('../models/User');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const { sendSuccess, asyncHandler } = require('../utils/responseHelper');
const getPublicStats = asyncHandler(async (req, res) => {
  // count of User documents (excluding admins)
  const totalStudentsEnrolled = await User.countDocuments({ role: { $ne: 'admin' } });
  // sum from User.lifetimeEarnings across all users
  const earningsSum = await User.aggregate([
    { $group: { _id: null, total: { $sum: '$lifetimeEarnings' } } }
  ]);
  const totalEarningsPaid = earningsSum[0]?.total || 0;
  // count of Product documents
  const totalProductsListed = await Product.countDocuments({ isPublished: true });
  // count of Transaction where status='released'
  const totalTransactionsCompleted = await Transaction.countDocuments({ status: 'released' });
  return sendSuccess(res, {
    totalStudentsEnrolled,
    totalEarningsPaid,
    totalProductsListed,
    totalTransactionsCompleted
  }, 'Public stats fetched');
});
module.exports = {
  getPublicStats
};
