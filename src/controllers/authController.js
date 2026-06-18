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

  // --- VERIFICATION LOGIC START ---
  const isEdu = isEduEmail(normalizedEmail);
  const verificationMethod = req.body.verificationMethod || 'email';

  // Block if not edu email AND no alternative method selected
  if (!isEdu && verificationMethod === 'email') {
    return sendError(
      res,
      'Only .edu.in or .ac.in emails are allowed. Alternatively use DigiLocker or upload your School ID card.',
      403
    );
  }

  // Set verification status based on method
  let verificationStatus = 'unverified';
  let eduVerified = false;

  if (isEdu) {
    // .EDU email — instant verification
    verificationStatus = 'verified';
    eduVerified = true;
  } else if (verificationMethod === 'digilocker') {
    // DigiLocker — government verified, instant
    verificationStatus = 'verified';
    eduVerified = true;
  } else if (verificationMethod === 'id_card') {
    // School ID card — pending 24hr manual review
    verificationStatus = 'pending';
    eduVerified = false;
  }
  // --- VERIFICATION LOGIC END ---

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
    eduVerified,
    verificationStatus,
    verificationMethod,
    idCardUrl: req.body.idCardUrl || null,
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
        wallet: user.wallet,
        eduVerified: user.eduVerified,
        verificationStatus: user.verificationStatus
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

module.exports = {
  register,
  login,
  refreshToken,
  getMe,
  adminSetup
};
