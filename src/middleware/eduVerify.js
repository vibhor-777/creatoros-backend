const { isEduEmail } = require('../utils/emailValidator');
const { sendError } = require('../utils/responseHelper');

const eduVerify = (req, res, next) => {
  const shouldVerify = (process.env.REQUIRE_EDU_VERIFICATION || 'true') === 'true';
  if (!shouldVerify) {
    return next();
  }

  // Bypass email verification check if registered via ID Card or DigiLocker
  const method = req.body.verificationMethod || 'email';
  if (method === 'digilocker' || method === 'id_card') {
    return next();
  }

  const email = req.body.email || req.user?.email;
  if (!email) {
    return sendError(res, 'Email is required for verification', 400);
  }

  if (!isEduEmail(email)) {
    return sendError(res, 'Only verified student or educational domains are allowed', 403);
  }

  return next();
};

module.exports = eduVerify;
