const jwt = require('jsonwebtoken');
const airtableService = require('../airtable-service');

module.exports = async (req, res) => {
    // Set CORS headers to allow requests from any origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Extract username from JWT token if available
    let username = 'anonymous';
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'duoai-jwt-secret');
            
            // Get user email from token
            const userEmail = decoded.email;
            
            // Get the user from Airtable to get the username
            const user = await airtableService.findUserByEmail(userEmail);
            username = user ? user.Username : userEmail;
            
            console.log('Extracted username from token:', username);
        } else {
            console.log('No auth token, using anonymous username');
        }
    } catch (error) {
        console.error('Error extracting username from token:', error);
        console.log('Using anonymous username');
    }
    
    // Start tracking session
    const sessionId = Date.now().toString();
    
    // In a real app, you would store this in a database with the username
    // For now, we'll just return the session ID
    
    res.json({ sessionId, username });
};
