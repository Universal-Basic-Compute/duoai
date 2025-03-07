const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
    // Set CORS headers to allow requests from any origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Check for authentication token
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.json({ isAuthenticated: false });
    }
    
    const token = authHeader.substring(7);
    
    try {
        // In a real app, you would verify the token with your secret
        // For now, we'll use a mock user
        const user = {
            id: 'mock-user-id',
            name: 'Mock User',
            email: 'mock@example.com',
            picture: ''
        };
        
        res.json({
            isAuthenticated: true,
            user
        });
    } catch (error) {
        console.error('Error verifying token:', error);
        res.json({ isAuthenticated: false });
    }
};
