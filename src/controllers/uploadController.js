const fs = require('fs');
const path = require('path');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');
const User = require('../models/User');

const uploadIdCard = asyncHandler(async (req, res) => {
  if (!req.file) {
    return sendError(res, 'No file uploaded', 400);
  }

  let fileUrl = '';
  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const base64Data = fileBuffer.toString('base64');
    fileUrl = `data:${req.file.mimetype};base64,${base64Data}`;
    
    // Delete temporary file from disk immediately
    fs.unlinkSync(req.file.path);
  } catch (err) {
    console.error("[Upload Controller] Error processing ID card file to Base64:", err);
    return sendError(res, 'Failed to process ID card file', 500);
  }

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
