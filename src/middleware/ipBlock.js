const BlockedIp = require('../models/BlockedIp');
const { sendError } = require('../utils/responseHelper');

const checkIpBlock = async (req, res, next) => {
  try {
    // Get client IP
    let clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    
    // Normalize IP address (handle IPv6 mapping to IPv4 like ::ffff:127.0.0.1)
    if (clientIp && clientIp.includes('::ffff:')) {
      clientIp = clientIp.split('::ffff:')[1];
    }
    
    // Clean up IP string (e.g. if multiple IPs in x-forwarded-for, get the first one)
    if (clientIp && clientIp.includes(',')) {
      clientIp = clientIp.split(',')[0].trim();
    }

    if (!clientIp) {
      return next();
    }

    // Check if IP is blocked
    const blockedRecord = await BlockedIp.findOne({ ip: clientIp });
    if (blockedRecord) {
      console.warn(`[IP Block] Blocked request from client IP: ${clientIp}. Reason: ${blockedRecord.reason}`);
      return sendError(res, `Forbidden: Your IP address (${clientIp}) is blocked. Reason: ${blockedRecord.reason}`, 403);
    }

    return next();
  } catch (error) {
    console.error('[IP Block Error] Error in checkIpBlock middleware:', error);
    return next(); // Fail-safe: allow request to proceed if middleware fails
  }
};

module.exports = { checkIpBlock };
