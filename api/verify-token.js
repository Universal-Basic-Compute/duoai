const { handleCors, validateMethod } = require('./utils/common');
const { verifyToken, getUserByUsername } = require('./utils/auth');

module.exports = async function handler(req, res) {
  console.log('Verify Token API handler called');
  
  // Handle CORS
  if (handleCors(req, res)) {
    console.log('CORS handled, returning early');
    return;
  }
  
  // Accept both GET and POST methods
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
    return;
  }

  try {
    console.log('Processing token verification request');
    
    // Get token from request (either query or body)
    const token = req.method === 'GET' ? req.query.token : req.body.token;
    
    if (!token) {
      return res.status(400).json({ 
        success: false, 
        error: 'Token is required' 
      });
    }
    
    // Verify token
    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      });
    }
    
    // Check if user still exists
    const user = await getUserByUsername(payload.username);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    // Return success response
    return res.status(200).json({ 
      success: true, 
      username: payload.username,
      exp: payload.exp
    });
  } catch (error) {
    console.error('Error in verify-token API:', error.message);
    return res.status(500).json({ 
      success: false,
      error: 'Error verifying token',
      details: error.message
    });
  }
}
