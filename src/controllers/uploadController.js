const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');
const User = require('../models/User');

const uploadIdCard = asyncHandler(async (req, res) => {
  if (!req.file) {
    return sendError(res, 'No file uploaded', 400);
  }

  const fileUrl = `uploads/${req.file.filename}`;

  if (req.user && req.user.id) {
    await User.findByIdAndUpdate(req.user.id, {
      idCardUrl: fileUrl,
      verificationStatus: 'pending'
    });
  }

  return sendSuccess(
    res,
    { idCardUrl: fileUrl, verificationStatus: 'pending' },
    'ID card uploaded. Your account will be verified within 24 hours.'
  );
});

module.exports = { uploadIdCard };
