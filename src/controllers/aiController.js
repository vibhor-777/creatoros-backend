const { GoogleGenerativeAI } = require('@google/generative-ai');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const optimizeListing = asyncHandler(async (req, res) => {
  const { title, description, price } = req.body;

  if (!title || !description) {
    return sendError(res, 'title and description are required', 400);
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `You are an expert Indian e-commerce SEO consultant for a student 
marketplace (StudioZ). Optimize this product listing.

Title: ${title}
Description: ${description}
Current Price: ${price || 'not set'}

Return ONLY valid JSON (no markdown, no code fences) with these exact fields:
{
  "optimizedTitle": "string, max 80 chars",
  "optimizedDescription": "string, max 150 words",
  "seoTags": ["array", "of", "5", "strings"],
  "suggestedPrice": number,
  "instagramCaption": "string, max 150 chars",
  "whatsappCaption": "string, max 100 chars"
}`;

  try {
    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    text = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const optimized = JSON.parse(text);
    return sendSuccess(res, optimized, 'Listing optimized successfully');
  } catch (err) {
    console.error('AI Optimization error:', err.message);
    return sendSuccess(
      res,
      {
        optimizedTitle: title,
        optimizedDescription: description,
        seoTags: [],
        suggestedPrice: price || 0,
        instagramCaption: '',
        whatsappCaption: ''
      },
      'AI optimization unavailable, returning original listing'
    );
  }
});

module.exports = { optimizeListing };
