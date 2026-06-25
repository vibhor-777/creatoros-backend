const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { auth } = require('../middleware/auth');
const { optimizeListing } = require('../controllers/aiController');

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'AI request limit reached. Try again later.' }
});

router.post('/optimize', auth, aiLimiter, optimizeListing);

module.exports = router;
