const Suggestion = require('../models/Suggestion');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');

const createSuggestion = asyncHandler(async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    return sendError(res, 'Title and content are required', 400);
  }

  const suggestionData = {
    title,
    content
  };

  if (req.user) {
    suggestionData.user = req.user._id;
  }

  const suggestion = await Suggestion.create(suggestionData);
  return sendSuccess(res, { suggestion }, 'Suggestion submitted successfully', 201);
});

const listSuggestionsForAdmin = asyncHandler(async (req, res) => {
  const suggestions = await Suggestion.find()
    .populate('user', 'fullName username email')
    .sort({ createdAt: -1 });

  return sendSuccess(res, { suggestions }, 'All platform suggestions fetched for admin');
});

module.exports = {
  createSuggestion,
  listSuggestionsForAdmin
};
