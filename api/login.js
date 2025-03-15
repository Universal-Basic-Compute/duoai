const axios = require('axios');
const { handleCors, validateMethod } = require('./utils/common');
const { verifyPassword, getUserByUsername, generateToken } = require('./utils/auth');

module.exports = async function handler(req, res) {
  console.log('Login API handler called');
  
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
    console.log('Processing login request');
    
    // Extract parameters
    const { username, password } = req.body;
    
    // Validate required parameters
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username and password are required' 
      });
    }
    
    // Get API keys from environment variables
    const airtableApiKey = process.env.AIRTABLE_API_KEY;
    if (!airtableApiKey) {
      return res.status(500).json({ 
        success: false, 
        error: 'Airtable API key not configured' 
      });
    }
    
    const airtableBaseId = process.env.AIRTABLE_BASE_ID;
    if (!airtableBaseId) {
      return res.status(500).json({ 
        success: false, 
        error: 'Airtable base ID not configured' 
      });
    }
    
    // Check if user exists
    const user = await getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid username or password' 
      });
    }
    
    // Verify password
    const passwordHash = user.fields.PasswordHash;
    const passwordSalt = user.fields.PasswordSalt;
    
    if (!verifyPassword(password, passwordHash, passwordSalt)) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid username or password' 
      });
    }
    
    // Update last login timestamp
    const timestamp = new Date().toISOString();
    await axios({
      method: 'PATCH',
      url: `https://api.airtable.com/v0/${airtableBaseId}/USERS`,
      headers: {
        'Authorization': `Bearer ${airtableApiKey}`,
        'Content-Type': 'application/json'
      },
      data: {
        records: [
          {
            id: user.id,
            fields: {
              LastLogin: timestamp
            }
          }
        ]
      }
    });
    
    // Generate authentication token
    const token = generateToken(username);
    
    // Return success response with token
    return res.status(200).json({ 
      success: true, 
      message: 'Login successful',
      username,
      token
    });
  } catch (error) {
    console.error('Error in login API:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({ 
      success: false,
      error: 'Error during login',
      details: error.response?.data || error.message
    });
  }
}
