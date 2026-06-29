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

const getLeaderboards = asyncHandler(async (req, res) => {
  // Top sellers: sorted by lifetimeEarnings desc, limit 5
  // We can include a fallback to show top creators overall if there are no Level 8+ users yet
  let topSellers = await User.find({
    role: { $in: ['creator', 'student'] },
    isActive: true,
    level: { $gte: 8 }
  })
  .select('fullName username avatarUrl level levelBadge lifetimeEarnings')
  .sort({ lifetimeEarnings: -1 })
  .limit(5);

  if (topSellers.length === 0) {
    // Fallback: show top earners overall so the leaderboard isn't empty during testing/bootstrap
    topSellers = await User.find({
      role: { $in: ['creator', 'student'] },
      isActive: true
    })
    .select('fullName username avatarUrl level levelBadge lifetimeEarnings')
    .sort({ lifetimeEarnings: -1 })
    .limit(5);
  }

  // Top referrers: sorted by referralCount desc, limit 5
  const topReferrers = await User.find({
    role: { $in: ['creator', 'student'] },
    isActive: true,
    referralCount: { $gt: 0 }
  })
  .select('fullName username avatarUrl referralCount referralEarnings')
  .sort({ referralCount: -1 })
  .limit(5);

  return sendSuccess(res, {
    topSellers,
    topReferrers
  }, 'Leaderboards fetched');
});

module.exports = {
  getPublicStats,
  getLeaderboards
};
