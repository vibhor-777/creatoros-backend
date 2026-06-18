const User = require('../models/User');
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
  return sendSuccess(res, { user }, `User verification ${action}d successfully`);
});

module.exports = {
  getProfile,
  updateProfile,
  listCreators,
  getPendingVerifications,
  verifyUser
};

