const axios = require('axios');
const { handleCors, validateMethod } = require('./utils/common');
const { hashPassword, getUserByUsername, getUserByEmail } = require('./utils/auth');

module.exports = async function handler(req, res) {
  console.log('Register API handler called');
  
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
    console.log('Processing registration request');
    
    // Extract parameters
    const { username, email, password } = req.body;
    
    // Validate required parameters
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username, email, and password are required' 
      });
    }
    
    // Validate username format (alphanumeric, 3-20 characters)
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username must be 3-20 characters and contain only letters, numbers, and underscores' 
      });
    }
    
    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid email format' 
      });
    }
    
    // Validate password strength (at least 8 characters)
    if (password.length < 8) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 8 characters long' 
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
    
    // Check if username already exists
    const existingUser = await getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        error: 'Username already exists' 
      });
    }
    
    // Check if email already exists
    const existingEmail = await getUserByEmail(email);
    if (existingEmail) {
      return res.status(409).json({ 
        success: false, 
        error: 'Email already registered' 
      });
    }
    
    // Hash the password
    const { hash, salt } = hashPassword(password);
    
    // Create user in Airtable
    const timestamp = new Date().toISOString();
    const createResponse = await axios({
      method: 'POST',
      url: `https://api.airtable.com/v0/${airtableBaseId}/USERS`,
      headers: {
        'Authorization': `Bearer ${airtableApiKey}`,
        'Content-Type': 'application/json'
      },
      data: {
        records: [
          {
            fields: {
              Username: username,
              Email: email,
              PasswordHash: hash,
              PasswordSalt: salt,
              CreatedAt: timestamp,
              LastLogin: timestamp
            }
          }
        ]
      }
    });
    
    // Return success response
    return res.status(201).json({ 
      success: true, 
      message: 'User registered successfully',
      username
    });
  } catch (error) {
    console.error('Error in register API:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({ 
      success: false,
      error: 'Error registering user',
      details: error.response?.data || error.message
    });
  }
}
