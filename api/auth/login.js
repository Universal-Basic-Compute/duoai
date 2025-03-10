const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const airtableService = require('../airtable-service');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email/Username and password are required' });
    }

    console.log('Login attempt with:', email); // Add logging

    // Find user by email or username
    let user;
    // Check if input is an email (contains @ symbol)
    if (email.includes('@')) {
      console.log('Treating input as email');
      user = await airtableService.findUserByEmail(email);
    } else {
      // If no @ symbol, treat as username
      console.log('Treating input as username');
      user = await airtableService.findUserByUsername(email);
    }
  
    if (!user) {
      console.log('User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('User found, checking password');

    // Check if password is correct
    const isMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!isMatch) {
      console.log('Password does not match');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log('Login successful for user:', user.Username || user.Email);

    // Update last login time
    await airtableService.updateLastLogin(user.id);

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.Email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { id: user.id, email: user.Email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return user data and tokens
    return res.status(200).json({
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.Email,
        name: user.Username
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Server error during login' });
  }
};
