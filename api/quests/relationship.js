const airtableService = require('../../airtable-service');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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
        const userEmail = decoded.email;
        
        // Get the user from Airtable to get the username
        const user = await airtableService.findUserByEmail(userEmail);
        const username = user ? user.Username : userEmail;
        
        // Get character from query parameters
        const character = req.query.character;
        
        if (!character) {
            return res.status(400).json({ error: 'Character parameter is required' });
        }
        
        // Get relationship depth
        const relationshipDepth = await airtableService.calculateRelationshipDepth(username, character);
        
        res.json(relationshipDepth);
    } catch (error) {
        console.error('Error fetching relationship depth:', error);
        res.status(500).json({ error: 'Failed to fetch relationship depth' });
    }
};
