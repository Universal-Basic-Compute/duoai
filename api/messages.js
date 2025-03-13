const axios = require('axios');
const { handleCors, validateMethod } = require('./utils/common');

module.exports = async function handler(req, res) {
  console.log('Messages API handler called');
  
  // Handle CORS
  if (handleCors(req, res)) {
    console.log('CORS handled, returning early');
    return;
  }
  
  // Accept both GET and POST methods
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    console.log('Processing messages request');
    
    // Get parameters from query (GET) or body (POST)
    const params = req.method === 'GET' ? req.query : req.body;
    
    // Extract parameters with defaults
    const username = params.username || 'anonymous';
    const character = params.character || 'Zephyr';
    const count = parseInt(params.count || '10', 10);
    
    // Validate count
    if (isNaN(count) || count < 1 || count > 100) {
      return res.status(400).json({ error: 'Count must be between 1 and 100' });
    }
    
    // Get API key from environment variable
    const apiKey = process.env.AIRTABLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Airtable API key not configured' });
    }
    
    // Get base ID from environment variable
    const baseId = process.env.AIRTABLE_BASE_ID;
    if (!baseId) {
      return res.status(500).json({ error: 'Airtable base ID not configured' });
    }
    
    // Construct filter formula
    const filterFormula = encodeURIComponent(`AND({Username}="${username}", {Character}="${character}")`);
    
    // Make request to Airtable API
    const response = await axios({
      method: 'GET',
      url: `https://api.airtable.com/v0/${baseId}/MESSAGES?maxRecords=${count}&sort%5B0%5D%5Bfield%5D=Timestamp&sort%5B0%5D%5Bdirection%5D=desc&filterByFormula=${filterFormula}`,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Extract and format the messages
    const messages = response.data.records.map(record => ({
      id: record.id,
      timestamp: record.fields.Timestamp,
      role: record.fields.Role,
      content: record.fields.Content,
      username: record.fields.Username,
      character: record.fields.Character
    }));
    
    // Sort messages by timestamp (oldest first)
    messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Return the messages
    return res.status(200).json({ messages });
  } catch (error) {
    console.error('Airtable API error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({ 
      error: 'Error retrieving messages',
      details: error.response?.data || error.message
    });
  }
}
