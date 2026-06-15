const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth');
const { optimizeListing } = require('../controllers/aiController');

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'AI request limit reached. Try again later.' }
});

console.log("[DEBUG VARS] protect type:", typeof protect);
console.log("[DEBUG VARS] optimizeListing type:", typeof optimizeListing);
router.post('/optimize', protect, aiLimiter, optimizeListing);

module.exports = router;
