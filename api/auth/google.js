const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
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
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ error: 'No token provided' });
        }
        
        // Verify Google token
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        
        const payload = ticket.getPayload();
        
        // Extract user info from Google payload
        const googleUser = {
            id: payload.sub,
            displayName: payload.name,
            emails: [{ value: payload.email }],
            photos: [{ value: payload.picture }]
        };
        
        // Find or create user in Airtable
        let user = await airtableService.findUserByGoogleId(googleUser.id);
        
        if (!user) {
            // Create new user
            user = await airtableService.createUser(googleUser);
        } else {
            // Update last login time
            await airtableService.updateLastLogin(user.id);
        }
        
        // Create JWT token
        const jwtPayload = {
            user: {
                id: user.id,
                name: user.Name,
                email: user.Email,
                picture: user.ProfilePicture
            }
        };
        
        // Check if we have a JWT_SECRET
        if (!process.env.JWT_SECRET) {
            console.warn('JWT_SECRET not set, using a default secret (not secure for production)');
            process.env.JWT_SECRET = 'default-development-secret';
        }
        
        // Create tokens
        const token = jwt.sign(jwtPayload, process.env.JWT_SECRET, { expiresIn: '1h' });
        const refreshToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        // Return tokens and user info
        res.json({
            token,
            refreshToken,
            user: jwtPayload.user
        });
    } catch (error) {
        console.error('Error authenticating with Google:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
};
