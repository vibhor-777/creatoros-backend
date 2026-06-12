const OpenAI = require('openai');

let openaiClient;

const getClient = () => {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
};

const generateServiceOutput = async ({ systemPrompt, userPrompt, temperature = 0.3 }) => {
  const client = getClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const response = await client.chat.completions.create({
    model,
    temperature,
    messages: [
      { role: 'system', content: systemPrompt || 'You are a helpful creator assistant.' },
      { role: 'user', content: userPrompt }
    ]
  });

  return response.choices?.[0]?.message?.content || '';
};

const summarizeProductDescription = async (description) => {
  return generateServiceOutput({
    systemPrompt: 'Summarize the following product listing for students in 120 words.',
    userPrompt: description,
    temperature: 0.2
  });
};

module.exports = {
  generateServiceOutput,
  summarizeProductDescription
};
