const express = require('express');
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);
router.get('/me', auth, authController.getMe);

// One-time admin setup/reset endpoint (secured by secret key)
router.post('/admin-setup', authController.adminSetup);

module.exports = router;
