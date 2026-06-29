const User = require('../models/User');
const Report = require('../models/Report');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const BlockedIp = require('../models/BlockedIp');
const emailService = require('../services/emailService');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');

const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('wallet');
  return sendSuccess(res, { user }, 'Profile fetched');
});

const updateProfile = asyncHandler(async (req, res) => {
  if (req.body.freelancerProfile && req.user.subscriptionTier === 'Starter') {
    return sendError(res, 'Freelancer profile is only available on Core, Elite, and Nexus tiers.', 403);
  }
  if (req.body.watermarkSettings && !['Elite', 'Nexus'].includes(req.user.subscriptionTier)) {
    return sendError(res, 'Custom PDF watermarks are only available on Elite and Nexus tiers.', 403);
  }

  const allowed = ['fullName', 'bio', 'avatarUrl', 'institution', 'preferredPayoutMethod', 'bankAccount', 'upiDetails', 'freelancerProfile', 'watermarkSettings'];
  const updates = Object.keys(req.body)
    .filter((key) => allowed.includes(key))
    .reduce((acc, key) => {
      acc[key] = req.body[key];
      return acc;
    }, {});

  if (Object.keys(updates).length === 0) {
    return sendError(res, 'No valid profile fields provided', 400);
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true
  });

  return sendSuccess(res, { user }, 'Profile updated');
});

const listCreators = asyncHandler(async (req, res) => {
  const { skill } = req.query;
  
  const query = {
    role: { $in: ['creator', 'student'] },
    isActive: true,
    subscriptionTier: { $ne: 'Starter' },
    'freelancerProfile.isAvailable': true
  };

  if (skill && skill !== 'all') {
    query['freelancerProfile.skills'] = skill;
  }

  const creators = await User.find(query)
    .select('fullName username bio avatarUrl stats freelancerProfile level levelBadge')
    .sort({ 'stats.rating': -1, createdAt: -1 })
    .limit(100);

  // Auto-calculate responseTime from past interaction timestamps
  const creatorsWithResponseTime = await Promise.all(creators.map(async (c) => {
    const txs = await Transaction.find({ seller: c._id, status: 'released' });
    let avgHours = 2; // Default fallback
    if (txs.length > 0) {
      const totalMs = txs.reduce((sum, t) => sum + (new Date(t.updatedAt) - new Date(t.createdAt)), 0);
      avgHours = Math.max(1, Math.round(totalMs / (txs.length * 60 * 60 * 1000)));
    }
    // Convert to plain object to modify dynamically if schema is strict
    const plain = c.toObject();
    if (plain.freelancerProfile) {
      plain.freelancerProfile.responseTime = avgHours;
    }
    return plain;
  }));

  return sendSuccess(res, { creators: creatorsWithResponseTime, count: creatorsWithResponseTime.length }, 'Creators listed');
});

const getPendingVerifications = asyncHandler(async (req, res) => {
  const users = await User.find({ verificationStatus: 'pending' })
    .select('fullName username email institution idCardUrl verificationMethod');
  return sendSuccess(res, { users }, 'Pending verifications fetched');
});

const verifyUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { action, reason } = req.body; // 'approve' or 'deny'

  const user = await User.findById(userId);
  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  if (action === 'approve') {
    user.verificationStatus = 'verified';
    user.eduVerified = true;
    user.rejectionReason = null;
    
    // Trigger 7-day Elite trial for first time verification
    if (user.subscriptionTier === 'Starter' && !user.isTrial && !user.subscriptionExpiresAt) {
      user.subscriptionTier = 'Elite';
      user.subscriptionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      user.isTrial = true;
    }

    // Check if the verified user was referred by someone (Step 3C)
    if (user.referredBy) {
      const Wallet = require('../models/Wallet');
      const referrer = await User.findById(user.referredBy);
      if (referrer) {
        const referrerWallet = await Wallet.findOne({ user: referrer._id });
        if (referrerWallet) {
          referrerWallet.availableBalance += 50;
          referrerWallet.addEntry({
            type: 'credit',
            source: 'referral',
            amount: 50,
            note: `Referral bonus for verifying user: ${user.username}`
          });
          await referrerWallet.save();
        }
        referrer.referralCount = (referrer.referralCount || 0) + 1;
        referrer.referralEarnings = (referrer.referralEarnings || 0) + 50;
        await referrer.save();
      }
    }
  } else {
    user.verificationStatus = 'rejected';
    user.eduVerified = false;
    user.rejectionReason = reason || 'No reason provided';
  }

    try {
    await user.save();
    await emailService.notifyUserVerificationResult(user, action === 'approve', user.rejectionReason);
    return sendSuccess(res, { user }, `User verification ${action}d successfully`);
  } catch (err) {
    console.error('Validation Error:', err);
    return sendError(res, 'Validation Error: ' + err.message, 400);
  }
});

// ─── USER REPORTS CONTROLLERS ────────────────────────────────────────────────
const reportUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { reason } = req.body;

  if (!reason) {
    return sendError(res, 'Reason is required to submit a report', 400);
  }

  const reportedUser = await User.findById(userId);
  if (!reportedUser) {
    return sendError(res, 'Reported user not found', 404);
  }

  const report = await Report.create({
    reporter: req.user._id,
    reportedUser: userId,
    reason
  });

  return sendSuccess(res, { report }, 'Report filed successfully', 201);
});

const listReportsForAdmin = asyncHandler(async (req, res) => {
  const reports = await Report.find()
    .populate('reporter', 'fullName username email')
    .populate('reportedUser', 'fullName username email')
    .sort({ createdAt: -1 });

  return sendSuccess(res, { reports }, 'All reports fetched for admin');
});

const moderateReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const { action, notes } = req.body; // 'resolve' or 'dismiss'

  const report = await Report.findById(reportId);
  if (!report) {
    return sendError(res, 'Report not found', 404);
  }

  if (action === 'resolve') {
    report.status = 'resolved';
  } else if (action === 'dismiss') {
    report.status = 'dismissed';
  } else {
    return sendError(res, 'Invalid action. Must be resolve or dismiss', 400);
  }

  if (notes) {
    report.adminNotes = notes;
  }

  await report.save();
  return sendSuccess(res, { report }, `Report status updated to ${report.status}`);
});

// ─── ADMIN DETAILED USER LIST CONTROLLER ────────────────────────────────────
const listAllUsersForAdmin = asyncHandler(async (req, res) => {
  const users = await User.find()
    .select('fullName username email role verificationStatus eduVerified createdAt idCardUrl verificationMethod subscriptionTier institution bankAccount upiDetails preferredPayoutMethod')
    .sort({ createdAt: -1 });

  const usersWithActivity = await Promise.all(
    users.map(async (user) => {
      // Find what they uploaded
      const uploads = await Product.find({ creator: user._id })
        .select('title pricing.amount category moderation.status isPublished');
      
      // Find what they purchased
      const transactions = await Transaction.find({
        buyer: user._id,
        transactionType: 'product',
        status: { $in: ['paid', 'released'] }
      }).populate('product', 'title pricing.amount category');

      return {
        ...user.toObject(),
        uploads,
        purchases: transactions.map((t) => t.product).filter(Boolean)
      };
    })
  );

  return sendSuccess(res, { users: usersWithActivity }, 'All users with activity list fetched for admin');
});

const updateUserSubscriptionForAdmin = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { subscriptionTier } = req.body;

  const validTiers = ['Starter', 'Core', 'Elite', 'Nexus'];
  if (!subscriptionTier || !validTiers.includes(subscriptionTier)) {
    return sendError(res, 'Invalid subscription tier. Must be Starter, Core, Elite, or Nexus', 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  user.subscriptionTier = subscriptionTier;
  user.subscriptionSource = 'admin';
  user.subscriptionPurchasedAt = new Date();
  user.subscriptionExpiresAt = null; // Admin-granted has no expiry
  await user.save();

  return sendSuccess(res, { user }, `User subscription tier updated to ${subscriptionTier} successfully`);
});

const purchaseSubscription = asyncHandler(async (req, res) => {
  const { subscriptionTier, billingCycle } = req.body;

  const validTiers = ['Starter', 'Core', 'Elite', 'Nexus'];
  if (!subscriptionTier || !validTiers.includes(subscriptionTier)) {
    return sendError(res, 'Invalid subscription tier. Must be Starter, Core, Elite, or Nexus', 400);
  }

  const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';

  const user = await User.findById(req.user._id);
  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  user.subscriptionTier = subscriptionTier;
  user.subscriptionSource = 'organic';
  user.subscriptionPurchasedAt = new Date();
  user.billingCycle = cycle;
  user.isTrial = false; // Buying cancels trial status
  
  if (subscriptionTier === 'Starter') {
    user.subscriptionExpiresAt = null;
    user.billingCycle = 'monthly';
  } else {
    const durationDays = cycle === 'yearly' ? 365 : 30;
    user.subscriptionExpiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
  }
  
  await user.save();
  return sendSuccess(res, { user }, `Successfully subscribed to ${subscriptionTier} (${cycle})`);
});

const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) return sendError(res, 'User not found', 404);
  if (user.role === 'admin') return sendError(res, 'Cannot delete admin user', 400);
  await User.findByIdAndDelete(id);
  return sendSuccess(res, null, 'User deleted');
});

const clearAllUsers = asyncHandler(async (req, res) => {
  await User.deleteMany({ role: { $ne: 'admin' } });
  return sendSuccess(res, null, 'All non-admin users deleted');
});

const editUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body };
  if (updates.level !== undefined) {
    const lvl = Number(updates.level);
    const badges = {
      1: '🌱', 2: '⚡', 3: '🔥', 4: '💎', 5: '🏆',
      6: '🌟', 7: '👑', 8: '🎖️', 9: '🔱', 10: '⭐'
    };
    updates.levelBadge = badges[lvl] || '🌱';
  }
  const user = await User.findByIdAndUpdate(id, updates, { new: true });
  if (!user) return sendError(res, 'User not found', 404);
  return sendSuccess(res, user, 'User updated');
});

const blockIp = asyncHandler(async (req, res) => {
  const { ip, reason } = req.body;
  if (!ip) {
    return sendError(res, 'IP address is required', 400);
  }

  const existingBlock = await BlockedIp.findOne({ ip });
  if (existingBlock) {
    return sendError(res, 'IP is already blocked', 400);
  }

  const blocked = await BlockedIp.create({
    ip,
    reason: reason || 'No reason provided',
    blockedBy: req.user._id
  });

  return sendSuccess(res, { blocked }, `IP ${ip} blocked successfully`, 201);
});

const listBlockedIps = asyncHandler(async (req, res) => {
  const blockedIps = await BlockedIp.find()
    .populate('blockedBy', 'fullName username email')
    .sort({ blockedAt: -1 });

  return sendSuccess(res, { blockedIps }, 'Blocked IPs fetched successfully');
});

const unblockIp = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const blocked = await BlockedIp.findByIdAndDelete(id);
  if (!blocked) {
    return sendError(res, 'Blocked IP record not found', 404);
  }
  return sendSuccess(res, null, `IP ${blocked.ip} unblocked successfully`);
});

const runMonthlyJobs = asyncHandler(async (req, res) => {
  // 1. Send Monthly Reports
  const users = await User.find({ role: { $in: ['creator', 'student'] }, isActive: true });
  for (const u of users) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const txs = await Transaction.find({
      seller: u._id,
      status: 'released',
      createdAt: { $gte: thirtyDaysAgo }
    });
    const monthlyEarnings = txs.reduce((sum, t) => sum + t.amount, 0);
    const salesCount = txs.length;
    await emailService.sendMonthlyEarningsReportEmail(u, monthlyEarnings, salesCount);
  }

  // 2. Reward top 3 referrers
  const topReferrers = await User.find({
    role: { $in: ['creator', 'student'] },
    isActive: true,
    referralCount: { $gt: 0 }
  })
  .sort({ referralCount: -1 })
  .limit(3);

  const rewards = [500, 300, 100];
  for (let i = 0; i < topReferrers.length; i++) {
    const ref = topReferrers[i];
    const rewardAmt = rewards[i] || 0;
    if (rewardAmt > 0) {
      const wallet = await Wallet.findOne({ user: ref._id });
      if (wallet) {
        wallet.availableBalance += rewardAmt;
        wallet.addEntry({
          type: 'credit',
          amount: rewardAmt,
          status: 'completed',
          description: `🏆 Referral Leaderboard Rank #${i + 1} Monthly Bonus`
        });
        await wallet.save();
      }
    }
  }

  return sendSuccess(res, { topReferrers }, 'Monthly earnings reports sent and top referrers rewarded.');
});

module.exports = {
  getProfile,
  updateProfile,
  listCreators,
  getPendingVerifications,
  verifyUser,
  reportUser,
  listReportsForAdmin,
  moderateReport,
  listAllUsersForAdmin,
  updateUserSubscriptionForAdmin,
  purchaseSubscription,
  deleteUser,
  clearAllUsers,
  editUser,
  blockIp,
  listBlockedIps,
  unblockIp,
  runMonthlyJobs
};

