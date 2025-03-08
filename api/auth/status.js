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
        // Check if we have a JWT_SECRET
        if (!process.env.JWT_SECRET) {
            console.warn('JWT_SECRET not set, using mock verification');
            // Use a mock user when JWT_SECRET is not set
            const user = {
                id: 'mock-user-id',
                name: 'Mock User',
                email: 'mock@example.com',
                picture: 'https://ui-avatars.com/api/?name=Mock+User&background=7e57c2&color=fff'
            };
            
            return res.json({
                isAuthenticated: true,
                user
            });
        }
        
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if token is expired
        if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
            return res.json({ isAuthenticated: false, tokenExpired: true });
        }
        
        // Return user info from token
        res.json({
            isAuthenticated: true,
            user: decoded.user
        });
    } catch (error) {
        console.error('Error verifying token:', error);
        
        // Check if token is expired
        if (error.name === 'TokenExpiredError') {
            return res.json({ isAuthenticated: false, tokenExpired: true });
        }
        
        res.json({ isAuthenticated: false });
    }
};
