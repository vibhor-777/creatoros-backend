const express = require('express');
const { auth } = require('../middleware/auth');
const transactionController = require('../controllers/transactionController');

const router = express.Router();

router.post('/order', auth, transactionController.createPaymentOrder);
router.post('/verify', auth, transactionController.verifyPayment);
router.get('/my', auth, transactionController.getMyTransactions);
router.post('/:transactionId/release', auth, transactionController.releaseTransaction);

module.exports = router;
