const https = require('https');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');

const SYSTEM_CONTEXT = `You are StudioZ Assistant, a helpful guide for India's student 
marketplace. Help users with: selling notes/products, verification process (.EDU Email - 
instant, DigiLocker - instant, or School ID upload - 24hr review), subscription tiers 
(Starter free with 5% fee, Core ₹199/month with 3% fee, Elite ₹399/month with 1.5% fee, 
Nexus ₹599/month with 0% fee), and general platform questions. Keep responses short 
(2-3 sentences), friendly, and simple. If asked about something outside StudioZ, 
politely redirect to platform topics.`;

const queryNvidiaAI = (messages, modelName = 'meta/llama-3.1-8b-instruct') => {
  return new Promise((resolve, reject) => {
    const apiKey = getSafeApiKey();
    let model = process.env.NVIDIA_MODEL_NAME || modelName;
    if (model.includes('reasoning')) {
      model = 'meta/llama-3.1-8b-instruct';
    }
    
    const postData = JSON.stringify({
      model: model,
      messages: messages,
      temperature: 0.5,
      max_tokens: 1024
    });
    
    const options = {
      hostname: 'integrate.api.nvidia.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`NVIDIA API error (${res.statusCode}): ${body}`));
          return;
        }
        try {
          const data = JSON.parse(body);
          const content = data.choices?.[0]?.message?.content;
          resolve(content);
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', (e) => {
      reject(e);
    });
    
    req.write(postData);
    req.end();
  });
};

const getSafeApiKey = () => {
  const fs = require('fs');
  const path = require('path');
  const dotenv = require('dotenv');
  let localApiKey = '';
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const localEnv = dotenv.parse(fs.readFileSync(envPath));
      if (localEnv.GEMINI_API_KEY) {
        localApiKey = localEnv.GEMINI_API_KEY;
      }
    }
  } catch (e) {
    console.error('Error parsing local .env:', e);
  }
  return localApiKey || process.env.GEMINI_API_KEY;
};

const chatWithAssistant = asyncHandler(async (req, res) => {
  const { message, history } = req.body;

  if (!message) {
    return sendError(res, 'message is required', 400);
  }

  const apiKey = getSafeApiKey();

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return sendError(res, 'GEMINI_API_KEY is not configured', 400);
  }

  try {
    let reply;
    if (apiKey && apiKey.startsWith('nvapi-')) {
      const messages = [
        { role: 'system', content: SYSTEM_CONTEXT }
      ];
      
      if (Array.isArray(history)) {
        history.forEach(h => {
          const role = h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user';
          const content = h.parts?.[0]?.text || h.content || '';
          if (content) {
            messages.push({ role, content });
          }
        });
      }
      
      messages.push({ role: 'user', content: message });
      
      reply = await queryNvidiaAI(messages);
    } else {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: SYSTEM_CONTEXT
      });

      const chat = model.startChat({
        history: Array.isArray(history) ? history : []
      });

      const result = await chat.sendMessage(message);
      reply = result.response.text();
    }

    return sendSuccess(res, { reply }, 'Response generated');
  } catch (err) {
    console.error('Chat error:', err.message);
    
    // Write diagnostics to local log file
    try {
      const fs = require('fs');
      const path = require('path');
      const logPath = path.join(process.cwd(), 'chat_error.log');
      fs.appendFileSync(logPath, `${new Date().toISOString()} - Message: "${message}"\nError: ${err.message}\nStack: ${err.stack}\n\n`);
    } catch (logErr) {
      console.error('Failed to write chat_error.log:', logErr.message);
    }
    
    // Heuristic response fallback
    let reply = "Hello! I am the StudioZ AI assistant. I can help you with notes uploads, student verification, physical/digital products, and payouts. What can I answer for you today?";
    const msgLower = message.toLowerCase();
    
    if (msgLower.includes('hello') || msgLower.includes('hi') || msgLower.includes('hey') || msgLower.includes('hii')) {
      reply = "Hello! I am the StudioZ AI assistant. I can help you with notes uploads, verification badges, and understanding escrow payout timelines. Feel free to ask me anything about the platform!";
    } else if (msgLower.includes('upload') || msgLower.includes('sell') || msgLower.includes('publish') || msgLower.includes('listing') || msgLower.includes('list')) {
      reply = "To upload a product on StudioZ:\n1. Go to your **Dashboard** and select the product type (**Digital** or **Physical**).\n2. Fill in the title, description, category, and price.\n3. For **Digital products**, upload the PDF/ZIP file.\n4. For **Physical products**, upload a mandatory **10s Video Proof** and choose handover options. Make sure you have linked your Bank Account or UPI ID first in your settings!";
    } else if (msgLower.includes('physical') || msgLower.includes('handover') || msgLower.includes('qr') || msgLower.includes('video') || msgLower.includes('ambassador')) {
      reply = "StudioZ physical product transactions are secured by 4 campus-specific safeguards:\n1. **College-Handover:** Meet directly on campus to inspect the item.\n2. **Dynamic QR Code:** Buyer scans the pickup QR code on meet-up to instantly release the held escrow.\n3. **Mandatory Video Proof:** Sellers must upload a 10s video of the item's condition.\n4. **Campus Ambassadors:** Student reps verify transactions on-site.";
    } else if (msgLower.includes('edu') || msgLower.includes('verify') || msgLower.includes('verification') || msgLower.includes('school id') || msgLower.includes('id card')) {
      reply = "StudioZ verification has two methods: \n1. **.EDU Email**: Instant verification if your email ends in `.edu.in` or `.ac.in`.\n2. **School ID card upload**: Manual validation which we review and approve within 24 hours. Normal emails like Gmail/Yahoo are allowed with this method.";
    } else if (msgLower.includes('fee') || msgLower.includes('charges') || msgLower.includes('commission') || msgLower.includes('payout')) {
      reply = "The standard StudioZ account has a 5% platform fee. If you upgrade to the Nexus subscription tier (₹599/month), you get a 0% platform fee and keep 100% of your earnings in your wallet.";
    } else if (msgLower.includes('escrow') || msgLower.includes('hold') || msgLower.includes('safe') || msgLower.includes('lock') || msgLower.includes('purchase') || msgLower.includes('buy') || msgLower.includes('puchare')) {
      reply = "Our platform features a 24-hour Escrow hold system for transaction safety. When a buyer makes a purchase, the payment is held securely in the escrow wallet and is automatically released to the creator's available balance after 24 hours.";
    } else if (msgLower.includes('nexus') || msgLower.includes('subscription') || msgLower.includes('tier') || msgLower.includes('pricing')) {
      reply = "StudioZ offers 4 plans: Starter (₹0/month, 5% fee), Core (₹199/month, 3% fee, AI Optimizer), Elite (₹399/month, 1.5% fee), and Nexus (₹599/month, 0% fee, Dev Zone, and AI Architect access).";
    }

    return sendSuccess(res, { 
      reply,
      debugInfo: {
        errorMessage: err.message,
        errorStack: err.stack,
        hasApiKey: !!apiKey,
        keyLength: apiKey ? apiKey.length : 0,
        isNvidiaKey: apiKey ? apiKey.startsWith('nvapi-') : false
      }
    }, 'Fallback heuristic response');
  }
});

const runDiagnostic = asyncHandler(async (req, res) => {
  const apiKey = getSafeApiKey();
  const model = 'meta/llama-3.1-8b-instruct';
  
  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'test health check' }],
        temperature: 0.5,
        max_tokens: 10
      })
    });
    const status = response.status;
    const body = await response.text();
    return res.status(200).json({ success: true, status, body, keyLength: apiKey ? apiKey.length : 0 });
  } catch (err) {
    return res.status(200).json({ success: false, error: err.message, stack: err.stack });
  }
});

module.exports = { chatWithAssistant, runDiagnostic };
