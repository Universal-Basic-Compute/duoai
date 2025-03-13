const axios = require('axios');
const { handleCors, validateMethod } = require('./utils/common');

module.exports = async function handler(req, res) {
  console.log('Send Message API handler called');
  
  // Handle CORS
  if (handleCors(req, res)) {
    console.log('CORS handled, returning early');
    return;
  }
  
  // Validate request method
  if (!validateMethod(req, res)) {
    console.log('Method validation failed, returning early');
    return;
  }

  try {
    console.log('Processing send message request');
    
    // Extract parameters
    const { message, username = 'anonymous', character = 'Zephyr', screenshot } = req.body;
    
    // Validate required parameters
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Get API keys from environment variables
    const airtableApiKey = process.env.AIRTABLE_API_KEY;
    if (!airtableApiKey) {
      return res.status(500).json({ error: 'Airtable API key not configured' });
    }
    
    const airtableBaseId = process.env.AIRTABLE_BASE_ID;
    if (!airtableBaseId) {
      return res.status(500).json({ error: 'Airtable base ID not configured' });
    }
    
    // Check rate limit (20 messages per day)
    const today = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format
    const startOfDay = today + 'T00:00:00.000Z';
    const endOfDay = today + 'T23:59:59.999Z';
    
    // Construct filter formula for today's messages from this user
    const filterFormula = encodeURIComponent(`AND({Username}="${username}", {Timestamp}>="${startOfDay}", {Timestamp}<="${endOfDay}", {Role}="user")`);
    
    // Count today's messages
    const countResponse = await axios({
      method: 'GET',
      url: `https://api.airtable.com/v0/${airtableBaseId}/MESSAGES?maxRecords=100&filterByFormula=${filterFormula}`,
      headers: {
        'Authorization': `Bearer ${airtableApiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    const todayMessageCount = countResponse.data.records.length;
    
    // Check if user has exceeded daily limit
    const dailyLimit = 20;
    if (todayMessageCount >= dailyLimit) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded', 
        message: `You have reached your limit of ${dailyLimit} messages per day. Please try again tomorrow.`,
        count: todayMessageCount,
        limit: dailyLimit
      });
    }
    
    // Fetch recent conversation history (last 20 messages)
    const historyFilterFormula = encodeURIComponent(`AND({Username}="${username}", {Character}="${character}")`);
    const historyResponse = await axios({
      method: 'GET',
      url: `https://api.airtable.com/v0/${airtableBaseId}/MESSAGES?maxRecords=20&sort%5B0%5D%5Bfield%5D=Timestamp&sort%5B0%5D%5Bdirection%5D=desc&filterByFormula=${historyFilterFormula}`,
      headers: {
        'Authorization': `Bearer ${airtableApiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Format conversation history for the LLM
    const conversationHistory = historyResponse.data.records.map(record => ({
      role: record.fields.Role === 'user' ? 'user' : 'assistant',
      content: record.fields.Content
    })).reverse(); // Reverse to get oldest first
    
    // Store user message in Airtable
    const timestamp = new Date().toISOString();
    await axios({
      method: 'POST',
      url: `https://api.airtable.com/v0/${airtableBaseId}/MESSAGES`,
      headers: {
        'Authorization': `Bearer ${airtableApiKey}`,
        'Content-Type': 'application/json'
      },
      data: {
        records: [
          {
            fields: {
              Username: username,
              Character: character,
              Role: 'user',
              Content: message,
              Timestamp: timestamp
            }
          }
        ]
      }
    });
    
    // Prepare messages for LLM API
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful, friendly AI assistant. Provide concise and helpful responses.'
      },
      ...conversationHistory,
      {
        role: 'user',
        content: message
      }
    ];
    
    // Log what we're sending to the LLM API
    console.log('Sending to LLM API:', {
      messageCount: messages.length,
      character,
      hasScreenshot: !!screenshot,
      screenshotLength: screenshot ? screenshot.length : 0
    });
    
    // Call LLM API to generate response
    const llmResponse = await axios({
      method: 'POST',
      url: 'https://duogaming.ai/api/utils/llm',
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        messages,
        character,  // Pass the character name to the LLM API
        images: screenshot ? [
          {
            data: screenshot,
            media_type: 'image/jpeg'
          }
        ] : undefined
      }
    });
    
    console.log('LLM API response status:', llmResponse.status);
    
    // Extract bot response
    let botResponse = "I'm sorry, I couldn't generate a response at this time.";
    if (llmResponse.data.content && Array.isArray(llmResponse.data.content) && llmResponse.data.content.length > 0) {
      botResponse = llmResponse.data.content[0].text;
    }
    
    // Store bot response in Airtable
    await axios({
      method: 'POST',
      url: `https://api.airtable.com/v0/${airtableBaseId}/MESSAGES`,
      headers: {
        'Authorization': `Bearer ${airtableApiKey}`,
        'Content-Type': 'application/json'
      },
      data: {
        records: [
          {
            fields: {
              Username: username,
              Character: character,
              Role: 'assistant',
              Content: botResponse,
              Timestamp: new Date().toISOString()
            }
          }
        ]
      }
    });
    
    // Return response with rate limit information
    return res.status(200).json({
      response: botResponse,
      count: todayMessageCount + 1,
      limit: dailyLimit,
      remaining: dailyLimit - (todayMessageCount + 1)
    });
  } catch (error) {
    console.error('Error in send-message API:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({ 
      error: 'Error processing message',
      details: error.response?.data || error.message
    });
  }
}
