const airtableService = require('../../airtable-service');

module.exports = async (req, res) => {
  // Set CORS headers to allow requests from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Check for authentication
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    // Extract user ID from token or request
    const userId = req.user ? req.user.id : 'mock-user-id';
    
    // Get limit from query parameters
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    
    // Get messages from Airtable
    const messages = await airtableService.getUserMessages(userId, limit);
    
    res.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch message history' });
  }
};
