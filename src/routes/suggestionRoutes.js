const express = require('express');
const { auth, authorize, optionalAuth } = require('../middleware/auth');
const suggestionController = require('../controllers/suggestionController');

const router = express.Router();

router.post('/', optionalAuth, suggestionController.createSuggestion);
router.get('/admin', auth, authorize('admin'), suggestionController.listSuggestionsForAdmin);

module.exports = router;
