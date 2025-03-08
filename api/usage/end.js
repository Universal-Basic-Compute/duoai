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
    
    const { sessionId } = req.body;
    
    if (!sessionId) {
        return res.status(400).json({ error: 'No session ID provided' });
    }
    
    try {
        // In a real app, you would calculate the actual duration
        // For now, we'll use a mock duration
        const duration = 0.1; // 6 minutes in hours
        
        // Update the user's usage in Airtable
        await airtableService.updateUsageHours(username, duration);
        
        res.json({ duration, username });
    } catch (error) {
        console.error('Error updating usage hours:', error);
        res.status(500).json({ error: 'Failed to update usage hours' });
    }
};
