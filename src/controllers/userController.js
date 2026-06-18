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
  const creators = await User.find({ 
    role: { $in: ['creator', 'student'] }, 
    isActive: true, 
    verificationStatus: 'verified' 
  })
    .select('fullName username bio avatarUrl stats')
    .sort({ 'stats.rating': -1, createdAt: -1 })
    .limit(100);

  return sendSuccess(res, { creators, count: creators.length }, 'Creators listed');
});

module.exports = {
  getProfile,
  updateProfile,
  listCreators
};
