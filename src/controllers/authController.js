const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const { isValidEmail, isEduEmail, normalizeEmail } = require('../utils/emailValidator');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');

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

  if (!isEduEmail(normalizedEmail)) {
    return sendError(res, 'Only educational/student emails are allowed', 403);
  }

  const existing = await User.findOne({
    $or: [{ email: normalizedEmail }, { username: username.toLowerCase() }]
  });

  if (existing) {
    return sendError(res, 'Email or username already registered', 409);
  }

  const user = await User.create({
    fullName,
    username,
    email: normalizedEmail,
    password,
    institution,
    eduVerified: true,
    role: 'creator'
  });

  const wallet = await Wallet.create({ user: user._id });
  user.wallet = wallet._id;
  await user.save();

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
        wallet: user.wallet
      },
      accessToken,
      refreshToken
    },
    'Registration successful',
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

  return sendSuccess(res, { accessToken, refreshToken }, 'Login successful');
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

module.exports = {
  register,
  login,
  refreshToken,
  getMe
};
