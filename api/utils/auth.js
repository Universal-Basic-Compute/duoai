const crypto = require('crypto');
const axios = require('axios');

// Function to hash passwords securely
function hashPassword(password, salt = null) {
  // Generate a salt if not provided
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  
  // Use PBKDF2 for secure password hashing
  const hash = crypto.pbkdf2Sync(password, useSalt, 10000, 64, 'sha512').toString('hex');
  
  // Return both hash and salt
  return {
    hash,
    salt: useSalt
  };
}

// Function to verify a password against stored hash
function verifyPassword(password, storedHash, storedSalt) {
  const { hash } = hashPassword(password, storedSalt);
  return hash === storedHash;
}

// Function to check if a user exists in Airtable
async function getUserByUsername(username) {
  try {
    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;
    
    if (!apiKey || !baseId) {
      throw new Error('Airtable configuration missing');
    }
    
    // Encode the username for the filter formula
    const encodedUsername = encodeURIComponent(username);
    const filterFormula = encodeURIComponent(`{Username}="${encodedUsername}"`);
    
    const response = await axios({
      method: 'GET',
      url: `https://api.airtable.com/v0/${baseId}/USERS?filterByFormula=${filterFormula}`,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data && response.data.records && response.data.records.length > 0) {
      return response.data.records[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error checking user existence:', error);
    throw error;
  }
}

// Function to check if an email exists in Airtable
async function getUserByEmail(email) {
  try {
    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;
    
    if (!apiKey || !baseId) {
      throw new Error('Airtable configuration missing');
    }
    
    // Encode the email for the filter formula
    const encodedEmail = encodeURIComponent(email);
    const filterFormula = encodeURIComponent(`{Email}="${encodedEmail}"`);
    
    const response = await axios({
      method: 'GET',
      url: `https://api.airtable.com/v0/${baseId}/USERS?filterByFormula=${filterFormula}`,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data && response.data.records && response.data.records.length > 0) {
      return response.data.records[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error checking email existence:', error);
    throw error;
  }
}

// Function to generate a JWT token
function generateToken(username) {
  // Simple token generation for now - in production use a proper JWT library
  const payload = {
    username,
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days expiration
  };
  
  // In a real app, use a proper JWT library and a secure secret
  const token = Buffer.from(JSON.stringify(payload)).toString('base64');
  return token;
}

// Function to verify a token
function verifyToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    
    // Check if token is expired
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  getUserByUsername,
  getUserByEmail,
  generateToken,
  verifyToken
};
