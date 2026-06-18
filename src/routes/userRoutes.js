const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = express.Router();

router.get('/creators', userController.listCreators);
router.get('/me', auth, userController.getProfile);
router.patch('/me', auth, userController.updateProfile);

// Admin verification routes
router.get('/pending-verifications', auth, authorize('admin'), userController.getPendingVerifications);
router.post('/:userId/verify', auth, authorize('admin'), userController.verifyUser);

module.exports = router;

