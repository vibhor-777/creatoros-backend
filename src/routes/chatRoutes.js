const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { chatWithAssistant } = require('../controllers/chatController');

const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many chat requests. Try again later.' }
});

router.post('/', chatLimiter, chatWithAssistant);

module.exports = router;
