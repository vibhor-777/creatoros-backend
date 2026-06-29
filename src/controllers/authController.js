const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const { isValidEmail, isEduEmail, normalizeEmail } = require('../utils/emailValidator');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');
const emailService = require('../services/emailService');

const signAccessToken = (userId) => {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

const signRefreshToken = (userId) => {
  return jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  });
};

const register = asyncHandler(async (req, res) => {
  const { fullName, username, email, password, institution } = req.body;

  if (!fullName || !username || !email || !password) {
    return sendError(res, 'fullName, username, email, and password are required', 400);
  }

  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    return sendError(res, 'Provide a valid email', 400);
  }

  // ID Card upload is required for registration
  if (!req.body.idCardUrl) {
    return sendError(res, 'Identity document upload is required', 400);
  }

  const existing = await User.findOne({
    $or: [{ email: normalizedEmail }, { username: username.toLowerCase() }]
  });

  if (existing) {
    return sendError(res, 'Email or username already registered', 409);
  }

  let referredByUser = null;
  if (req.body.referredByCode) {
    referredByUser = await User.findOne({ referralCode: req.body.referredByCode.trim() });
  }

  const generatedReferralCode = username.toLowerCase() + '_' + Math.floor(100 + Math.random() * 900);

  const user = await User.create({
    fullName,
    username,
    email: normalizedEmail,
    password,
    institution,
    eduVerified: false,
    verificationStatus: 'pending',
    verificationMethod: 'id_card',
    idCardUrl: req.body.idCardUrl,
    role: 'creator',
    referralCode: generatedReferralCode,
    referredBy: referredByUser ? referredByUser._id : null
  });

  const wallet = await Wallet.create({ user: user._id });
  user.wallet = wallet._id;
  await user.save();

  // Send admin notification
  await emailService.notifyAdminNewVerification(user);

  const accessToken = signAccessToken(user._id.toString());
  const refreshToken = signRefreshToken(user._id.toString());

  return sendSuccess(
    res,
    {
      user: {
        id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        role: user.role,
        wallet: user.wallet,
        eduVerified: user.eduVerified,
        verificationStatus: user.verificationStatus
      },
      accessToken,
      refreshToken
    },
    'Registration successful, account pending verification',
    201
  );
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return sendError(res, 'Email and password are required', 400);
  }

  const user = await User.findOne({ email: normalizeEmail(email) }).select('+password');
  if (!user) {
    return sendError(res, 'Invalid credentials', 401);
  }

  const matched = await user.comparePassword(password);
  if (!matched) {
    return sendError(res, 'Invalid credentials', 401);
  }

  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = signAccessToken(user._id.toString());
  const refreshToken = signRefreshToken(user._id.toString());

  return sendSuccess(res, {
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      role: user.role,
      eduVerified: user.eduVerified,
      verificationStatus: user.verificationStatus
    }
  }, 'Login successful');
});

const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body;
  if (!token) {
    return sendError(res, 'refreshToken is required', 400);
  }

  const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
  const user = await User.findById(decoded.sub).select('-password');

  if (!user || !user.isActive) {
    return sendError(res, 'User account unavailable', 401);
  }

  const accessToken = signAccessToken(user._id.toString());
  return sendSuccess(res, { accessToken }, 'Token refreshed');
});

const getMe = asyncHandler(async (req, res) => {
  return sendSuccess(res, { user: req.user }, 'Profile fetched');
});

// ── One-time Admin Password Force-Reset ──────────────────────────────────────
// Call: POST /api/v1/auth/admin-setup  { "setupKey": "sz-admin-init-2024" }
const adminSetup = asyncHandler(async (req, res) => {
  const { setupKey } = req.body;
  const SETUP_KEY = process.env.ADMIN_SETUP_KEY || 'sz-admin-init-2024';

  if (setupKey !== SETUP_KEY) {
    return sendError(res, 'Unauthorized', 403);
  }

  const bcrypt = require('bcryptjs');
  const Wallet = require('../models/Wallet');

  const ADMIN_EMAIL = 'admin@studio-z.in';
  const ADMIN_PASS  = 'studio@1234554321';
  const hashedPass  = await bcrypt.hash(ADMIN_PASS, 12);

  let user = await User.findOne({ email: ADMIN_EMAIL }).select('+password');

  if (!user) {
    // Create fresh admin user
    user = new User({
      fullName: 'StudioZ Admin',
      username: 'studiozadmin',   // no hyphen — schema: ^[a-z0-9_]+$
      email: ADMIN_EMAIL,
      password: ADMIN_PASS, // pre-save hook will hash
      role: 'admin',
      eduVerified: true,
      verificationStatus: 'verified',
      verificationMethod: 'email'
    });
    const wallet = await Wallet.create({ user: user._id });
    user.wallet = wallet._id;
    await user.save();
    return sendSuccess(res, { created: true, email: ADMIN_EMAIL }, 'Admin user created');
  }

  // Force update password via updateOne (bypasses pre-save hook, uses pre-hashed value)
  await User.updateOne(
    { _id: user._id },
    { $set: { password: hashedPass, role: 'admin', eduVerified: true, verificationStatus: 'verified' } }
  );

  // Verify the update worked
  const verify = await User.findOne({ email: ADMIN_EMAIL }).select('+password');
  const match = await bcrypt.compare(ADMIN_PASS, verify.password);

  return sendSuccess(res, {
    reset: true,
    email: ADMIN_EMAIL,
    passwordVerified: match,
    role: verify.role
  }, match ? 'Admin password reset successfully — login will work now' : 'Reset failed — contact developer');
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return sendError(res, 'Email and OTP code are required', 400);
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  if (user.verificationStatus !== 'pending_otp') {
    return sendError(res, 'Account is not pending OTP verification', 400);
  }

  if (user.otpCode !== otp) {
    return sendError(res, 'Invalid OTP verification code', 400);
  }

  if (user.otpExpires < new Date()) {
    return sendError(res, 'OTP verification code has expired', 400);
  }

  // OTP is valid! Activate user
  user.verificationStatus = 'verified';
  user.eduVerified = true;
  user.otpCode = null;
  user.otpExpires = null;
  await user.save();

  // Generate session tokens
  const accessToken = signAccessToken(user._id.toString());
  const refreshToken = signRefreshToken(user._id.toString());

  // Send welcome email
  await emailService.sendWelcomeEmail(user);

  return sendSuccess(
    res,
    {
      user: {
        id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        role: user.role,
        wallet: user.wallet,
        eduVerified: user.eduVerified,
        verificationStatus: user.verificationStatus
      },
      accessToken,
      refreshToken
    },
    'Email verified and account activated successfully'
  );
});

module.exports = {
  register,
  login,
  refreshToken,
  getMe,
  adminSetup,
  verifyOtp
};
