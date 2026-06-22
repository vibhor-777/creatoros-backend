const fetch = require('node-fetch' || 'undici' || 'globalThis.fetch' || 'fetch');

const queryNvidiaAI = async () => {
  const apiKey = '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';
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
        messages: [
          { role: 'system', content: 'You are StudioZ Assistant.' },
          { role: 'user', content: 'hello' }
        ],
        temperature: 0.5,
        max_tokens: 10
      })
    });
    
    console.log('HTTP Status:', response.status);
    const text = await response.text();
    console.log('Response Body:', text);
  } catch (err) {
    console.error('Error querying Nvidia AI:', err);
  }
};

queryNvidiaAI();
