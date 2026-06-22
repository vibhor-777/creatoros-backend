const express = require('express');
const { auth } = require('../middleware/auth');
const walletController = require('../controllers/walletController');

const router = express.Router();

router.get('/', auth, walletController.getWallet);
router.post('/add-funds', auth, walletController.addFunds);
router.post('/withdraw', auth, walletController.withdrawFunds);
router.post('/transfer', auth, walletController.transferFunds);

// Admin Payout Management
router.get('/admin/withdrawals', auth, walletController.getWithdrawalsForAdmin);
router.post('/admin/withdrawals/:id/complete', auth, walletController.completeWithdrawalForAdmin);
router.post('/admin/withdrawals/:id/cancel', auth, walletController.cancelWithdrawalForAdmin);

module.exports = router;
