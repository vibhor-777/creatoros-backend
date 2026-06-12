const express = require('express');
const { auth } = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = express.Router();

router.get('/creators', userController.listCreators);
router.get('/me', auth, userController.getProfile);
router.patch('/me', auth, userController.updateProfile);

module.exports = router;
