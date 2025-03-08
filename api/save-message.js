const airtableService = require('./airtable-service');

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
    // Extract message data from request body
    const { role, content, character } = req.body;
    
    if (!role || !content) {
      return res.status(400).json({ error: 'Role and content are required' });
    }
    
    // Extract username from token or request
    const username = req.user ? req.user.name : 'mock-user';
    
    // Save message to Airtable
    const message = await airtableService.saveMessage(username, role, content, character);
    
    if (!message) {
      return res.status(500).json({ error: 'Failed to save message' });
    }
    
    res.json({ success: true, message });
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
};
