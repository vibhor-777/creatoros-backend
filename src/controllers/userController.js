const User = require('../models/User');
const Report = require('../models/Report');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const emailService = require('../services/emailService');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');

const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password').populate('wallet');
  return sendSuccess(res, { user }, 'Profile fetched');
});

const updateProfile = asyncHandler(async (req, res) => {
  const allowed = ['fullName', 'bio', 'avatarUrl', 'institution'];
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
  }).select('-password');

  return sendSuccess(res, { user }, 'Profile updated');
});

const listCreators = asyncHandler(async (req, res) => {
  const creators = await User.find({ role: { $in: ['creator', 'student'] }, isActive: true })
    .select('fullName username bio avatarUrl stats')
    .sort({ 'stats.rating': -1, createdAt: -1 })
    .limit(100);

  return sendSuccess(res, { creators, count: creators.length }, 'Creators listed');
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
  } else {
    user.verificationStatus = 'rejected';
    user.eduVerified = false;
    user.rejectionReason = reason || 'No reason provided';
  }

  await user.save();

  // Send verification result email in English
  await emailService.notifyUserVerificationResult(user, action === 'approve', user.rejectionReason);

  return sendSuccess(res, { user }, `User verification ${action}d successfully`);
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
    .select('fullName username email role verificationStatus eduVerified createdAt idCardUrl verificationMethod subscriptionTier')
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
  await user.save();

  return sendSuccess(res, { user }, `User subscription tier updated to ${subscriptionTier} successfully`);
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
  updateUserSubscriptionForAdmin
};

