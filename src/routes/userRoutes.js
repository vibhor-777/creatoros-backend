const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = express.Router();

router.get('/creators', userController.listCreators);
router.get('/me', auth, userController.getProfile);
router.patch('/me', auth, userController.updateProfile);

// Admin verification & management routes
router.get('/pending-verifications', auth, authorize('admin'), userController.getPendingVerifications);
router.post('/:userId/verify', auth, authorize('admin'), userController.verifyUser);
router.get('/admin/all', auth, authorize('admin'), userController.listAllUsersForAdmin);
router.post('/admin/users/:userId/subscription', auth, authorize('admin'), userController.updateUserSubscriptionForAdmin);

// User reporting routes
router.post('/:userId/report', auth, userController.reportUser);
router.get('/admin/reports', auth, authorize('admin'), userController.listReportsForAdmin);
router.post('/admin/reports/:reportId/action', auth, authorize('admin'), userController.moderateReport);

module.exports = router;

