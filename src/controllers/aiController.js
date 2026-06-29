const { GoogleGenerativeAI } = require('@google/generative-ai');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');

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
    console.error('Error reading local .env for AI:', e);
  }
  return localApiKey || process.env.GEMINI_API_KEY;
};

const queryNvidiaAI = async (messages, modelName = 'meta/llama-3.1-8b-instruct') => {
  const apiKey = getSafeApiKey();
  let model = process.env.NVIDIA_MODEL_NAME || modelName;
  if (model.includes('reasoning')) {
    model = 'meta/llama-3.1-8b-instruct';
  }
  
  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: 0.2,
      max_tokens: 1024
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`NVIDIA API error (${response.status}): ${errorText}`);
  }
  
  const data = await response.json();
  return data.choices?.[0]?.message?.content;
};

const optimizeListing = asyncHandler(async (req, res) => {
  const { title, description, price } = req.body;

  if (!title || !description) {
    return sendError(res, 'title and description are required', 400);
  }

  // Enforce Subscription Limits for AI Optimizer
  const User = require('../models/User');
  const user = await User.findById(req.user._id);
  if (!user) {
    return sendError(res, 'User session not found', 401);
  }

  const tier = user.subscriptionTier || 'Starter';
  if (tier === 'Starter') {
    return sendError(res, 'AI Optimizer is not available on the Starter plan. Please upgrade to Core, Elite, or Nexus.', 403);
  }

  const now = new Date();
  const lastUsed = user.aiOptimizerUsage?.lastUsedAt;
  const isSameDay = lastUsed && 
    now.getDate() === lastUsed.getDate() && 
    now.getMonth() === lastUsed.getMonth() && 
    now.getFullYear() === lastUsed.getFullYear();

  let dailyCount = isSameDay ? (user.aiOptimizerUsage?.count || 0) : 0;
  if (tier === 'Core' && dailyCount >= 1) {
    return sendError(res, 'Daily AI Optimizer limit (1×/day) reached for Core tier. Please upgrade to Elite or Nexus.', 403);
  } else if (tier === 'Elite' && dailyCount >= 5) {
    return sendError(res, 'Daily AI Optimizer limit (5×/day) reached for Elite tier. Please upgrade to Nexus.', 403);
  }

  // Increment usage count
  user.aiOptimizerUsage = {
    count: dailyCount + 1,
    lastUsedAt: now
  };
  await user.save();

  const apiKey = getSafeApiKey();
  if (!apiKey) {
    console.warn('GEMINI_API_KEY not configured, returning original values as fallback.');
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
    let text;
    if (apiKey.startsWith('nvapi-')) {
      const messages = [
        { role: 'user', content: prompt }
      ];
      text = await queryNvidiaAI(messages);
    } else {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      text = result.response.text();
    }
    
    text = text.trim();
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
