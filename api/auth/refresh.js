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
    
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(400).json({ error: 'No refresh token provided' });
        }
        
        // Check if we have a JWT_SECRET
        if (!process.env.JWT_SECRET) {
            console.warn('JWT_SECRET not set, using a default secret (not secure for production)');
            process.env.JWT_SECRET = 'dI5dZ7cvp9'; // Use a more secure default secret
        }
        
        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        
        // Get user from Airtable
        let user;
        if (decoded.userId) {
            user = await airtableService.findUserByEmail(decoded.email);
        }
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Create new tokens
        const jwtPayload = {
            user: {
                id: user.id,
                name: user.Name,
                email: user.Email,
                picture: user.ProfilePicture
            }
        };
        
        const newToken = jwt.sign(jwtPayload, process.env.JWT_SECRET, { expiresIn: '1h' });
        const newRefreshToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        // Return new tokens
        res.json({
            token: newToken,
            refreshToken: newRefreshToken
        });
    } catch (error) {
        console.error('Error refreshing token:', error);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Refresh token expired' });
        }
        
        res.status(500).json({ error: 'Token refresh failed' });
    }
};
