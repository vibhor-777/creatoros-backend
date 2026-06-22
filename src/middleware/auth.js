const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/responseHelper');
const User = require('../models/User');

const extractToken = (req) => {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  if (req.query && req.query.token) {
    return req.query.token;
  }

  return null;
};

const auth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return sendError(res, 'Authentication token missing', 401);
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return sendError(res, 'JWT secret is not configured', 500);
    }

    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.sub).select('-password');

    if (!user) {
      return sendError(res, 'User account not found', 401);
    }

    if (!user.isActive) {
      return sendError(res, 'User account is deactivated', 403);
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return sendError(res, 'Invalid or expired token', 401);
    }

    return next(error);
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return sendError(res, 'Authentication required', 401);
  }

  if (!roles.includes(req.user.role)) {
    return sendError(res, 'You are not authorized for this action', 403);
  }

  return next();
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return next();
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return next();
    }

    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.sub).select('-password');

    if (user && user.isActive) {
      req.user = user;
    }
    return next();
  } catch (error) {
    return next();
  }
};

module.exports = {
  auth,
  authorize,
  optionalAuth
};
