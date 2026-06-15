const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload')
const { uploadIdCard } = require('../controllers/uploadController');

router.post('/file', auth, upload.single('document'), ... )

module.exports = router;
