const { GoogleGenerativeAI } = require('@google/generative-ai');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_CONTEXT = `You are StudioZ Assistant, a helpful guide for India's student 
marketplace. Help users with: selling notes/products, verification process (.EDU Email - 
instant, DigiLocker - instant, or School ID upload - 24hr review), subscription tiers 
(Starter free with 5% fee, Core ₹199/month with 3% fee, Elite ₹399/month with 1.5% fee, 
Nexus ₹599/month with 0% fee), and general platform questions. Keep responses short 
(2-3 sentences), friendly, and simple. If asked about something outside StudioZ, 
politely redirect to platform topics.`;

const chatWithAssistant = asyncHandler(async (req, res) => {
  const { message, history } = req.body;

  if (!message) {
    return sendError(res, 'message is required', 400);
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: SYSTEM_CONTEXT
  });

  try {
    const chat = model.startChat({
      history: Array.isArray(history) ? history : []
    });

    const result = await chat.sendMessage(message);
    const reply = result.response.text();

    return sendSuccess(res, { reply }, 'Response generated');
  } catch (err) {
    console.error('Chat error:', err.message);
    return sendSuccess(
      res,
      { reply: "Sorry, I'm having trouble right now. Please try again in a moment." },
      'Fallback response'
    );
  }
});

module.exports = { chatWithAssistant };
