const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { uploadImage } = require('../middleware/uploadMiddleware');
const { uploadIdCard } = require('../controllers/uploadController');

router.post('/id-card', protect, uploadImage.single('idCard'), uploadIdCard);

module.exports = router;
