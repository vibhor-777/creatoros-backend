const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const financialAidController = require('../controllers/financialAidController');

const router = express.Router();

// Apply for aid
router.post('/apply', auth, financialAidController.applyFinancialAid);

// Admin operations
router.get('/applications', auth, authorize('admin'), financialAidController.getApplications);
router.get('/pending', auth, authorize('admin'), financialAidController.getApplications);
router.post('/applications/:id/resolve', auth, authorize('admin'), financialAidController.resolveApplication);
router.post('/resolve/:id', auth, authorize('admin'), financialAidController.resolveApplication);

module.exports = router;
