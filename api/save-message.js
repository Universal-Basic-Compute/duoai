const airtableService = require('./airtable-service');
const jwt = require('jsonwebtoken');

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
    // Extract token
    const token = authHeader.substring(7);
    
    // Verify and decode the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'duoai-jwt-secret');
    
    // Get user data from the token
    const userId = decoded.id;
    const userEmail = decoded.email;
    
    // Get the user from Airtable to get the username
    const user = await airtableService.findUserByEmail(userEmail);
    const username = user ? user.Username : userEmail;
    
    // Extract message data from request body
    const { role, content, character, username: requestUsername } = req.body;
    
    if (!role || !content) {
      return res.status(400).json({ error: 'Role and content are required' });
    }
    
    // Use username from request body if available, otherwise use the one from token
    const finalUsername = requestUsername || username;
    console.log('Using username for message:', finalUsername);
    
    // Save message to Airtable
    const message = await airtableService.saveMessage(finalUsername, role, content, character);
    
    if (!message) {
      return res.status(500).json({ error: 'Failed to save message' });
    }
    
    res.json({ success: true, message });
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
};
