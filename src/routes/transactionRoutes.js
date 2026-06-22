const express = require('express');
const { auth, optionalAuth } = require('../middleware/auth');
const transactionController = require('../controllers/transactionController');

const router = express.Router();

router.post('/order', auth, transactionController.createPaymentOrder);
router.post('/verify', auth, transactionController.verifyPayment);
router.get('/my', auth, transactionController.getMyTransactions);
router.get('/all', auth, transactionController.getAllTransactions); // admin only
router.post('/:transactionId/release', auth, transactionController.releaseEscrow);
router.post('/mock-purchase', optionalAuth, transactionController.mockPurchase);

module.exports = router;
