const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = express.Router();

router.get('/creators', userController.listCreators);
router.get('/me', auth, userController.getProfile);
router.patch('/me', auth, userController.updateProfile);
router.post('/me/subscription', auth, userController.purchaseSubscription);

// Admin verification & management routes
router.get('/pending-verifications', auth, authorize('admin'), userController.getPendingVerifications);
router.post('/:userId/verify', auth, authorize('admin'), userController.verifyUser);
router.get('/admin/all', auth, authorize('admin'), userController.listAllUsersForAdmin);
router.post('/admin/users/:userId/subscription', auth, authorize('admin'), userController.updateUserSubscriptionForAdmin);
router.post('/admin/blocked-ips', auth, authorize('admin'), userController.blockIp);
router.get('/admin/blocked-ips', auth, authorize('admin'), userController.listBlockedIps);
router.delete('/admin/blocked-ips/:id', auth, authorize('admin'), userController.unblockIp);
router.post('/admin/run-monthly-jobs', auth, authorize('admin'), userController.runMonthlyJobs);


// User reporting routes
router.post('/:userId/report', auth, userController.reportUser);
router.get('/admin/reports', auth, authorize('admin'), userController.listReportsForAdmin);
router.post('/admin/reports/:reportId/action', auth, authorize('admin'), userController.moderateReport);


router.delete('/admin/clear-all', auth, authorize('admin'), userController.clearAllUsers);
router.delete('/:id', auth, authorize('admin'), userController.deleteUser);
router.patch('/:id/edit', auth, authorize('admin'), userController.editUser);
module.exports = router;

