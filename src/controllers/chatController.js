const { GoogleGenerativeAI } = require('@google/generative-ai');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const chatWithAssistant = asyncHandler(async (req, res) => {
  const { message, history } = req.body;

  if (!message) {
    return sendError(res, 'Message is required', 400);
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const systemContext = `You are StudioZ Assistant, a helpful guide for India's student 
marketplace. Help users with: selling notes/products, verification process (EDU email, 
DigiLocker, or School ID), subscription tiers (Starter free, Core ₹199, Elite ₹399, 
Nexus ₹599), and general platform questions. Keep responses short, friendly, and in 
simple language. If asked about something outside StudioZ, politely redirect.`;

  const chat = model.startChat({
    history: history || [],
    systemInstruction: systemContext
  });

  const result = await chat.sendMessage(message);
  const reply = result.response.text();

  return sendSuccess(res, { reply }, 'Response generated');
});

module.exports = { chatWithAssistant };
