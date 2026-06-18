const { GoogleGenerativeAI } = require('@google/generative-ai');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');

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

  try {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_CONTEXT
    });

    const chat = model.startChat({
      history: Array.isArray(history) ? history : []
    });

    const result = await chat.sendMessage(message);
    const reply = result.response.text();

    return sendSuccess(res, { reply }, 'Response generated');
  } catch (err) {
    console.error('Chat error:', err.message);
    
    // Heuristic response fallback
    let reply = "Hi! I am the StudioZ AI assistant. I can help you with notes uploads, verification badges, and understanding escrow payout timelines. Feel free to ask me anything about the platform!";
    const msgLower = message.toLowerCase();
    
    if (msgLower.includes('hello') || msgLower.includes('hi') || msgLower.includes('hey')) {
      reply = "Hello! I am the StudioZ AI assistant. I can help you with notes uploads, verification badges, and understanding escrow payout timelines. Feel free to ask me anything about the platform!";
    } else if (msgLower.includes('edu') || msgLower.includes('verify') || msgLower.includes('verification') || msgLower.includes('school id') || msgLower.includes('id card')) {
      reply = "StudioZ verification has two methods: \n1. **.EDU Email**: Instant verification if your email ends in `.edu.in` or `.ac.in`.\n2. **School ID card upload**: Manual validation which we review and approve within 24 hours. Normal emails like Gmail/Yahoo are allowed with this method.";
    } else if (msgLower.includes('fee') || msgLower.includes('charges') || msgLower.includes('commission') || msgLower.includes('payout')) {
      reply = "The standard StudioZ account has a 5% platform fee. If you upgrade to the Nexus subscription tier (₹599/month), you get a 0% platform fee and keep 100% of your earnings in your wallet.";
    } else if (msgLower.includes('escrow') || msgLower.includes('hold') || msgLower.includes('safe') || msgLower.includes('lock') || msgLower.includes('purchase') || msgLower.includes('buy') || msgLower.includes('puchare')) {
      reply = "Our platform features a 24-hour Escrow hold system for transaction safety. When a buyer makes a purchase, the payment is held securely in the escrow wallet and is automatically released to the creator's available balance after 24 hours.";
    } else if (msgLower.includes('nexus') || msgLower.includes('subscription') || msgLower.includes('tier') || msgLower.includes('pricing')) {
      reply = "StudioZ offers 4 plans: Starter (₹0/month, 5% fee), Core (₹199/month, 3% fee, AI Optimizer), Elite (₹399/month, 1.5% fee), and Nexus (₹599/month, 0% fee, Dev Zone, and AI Architect access).";
    }

    return sendSuccess(res, { reply }, 'Fallback heuristic response');
  }
});

module.exports = { chatWithAssistant };
