const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
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
