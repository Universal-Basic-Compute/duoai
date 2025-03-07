// This is a simplified version for Vercel deployment
// In a production environment, you would use a proper session store
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  try {
    // For Vercel deployment, we'll use a simplified authentication check
    // In production, integrate with a proper auth service like Auth0 or NextAuth
    
    // Check for authentication cookie or header
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Extract token and validate
      const token = authHeader.substring(7);
      
      // In production, verify the token with your auth provider
      // For now, we'll do a basic verification if the token exists and is valid JWT format
      try {
        // Verify token structure (this doesn't validate signature in this example)
        // In production, use proper JWT verification with a secret
        const decoded = jwt.decode(token);
        
        if (decoded && decoded.exp && decoded.exp > Date.now() / 1000) {
          // Token is valid and not expired
          return res.json({
            isAuthenticated: true,
            user: {
              id: decoded.sub || 'mock-user-id',
              name: decoded.name || 'Demo User',
              email: decoded.email || 'demo@example.com',
              picture: decoded.picture || 'https://ui-avatars.com/api/?name=Demo+User&background=7e57c2&color=fff'
            }
          });
        }
      } catch (tokenError) {
        console.error('Token validation error:', tokenError);
        // Continue to return not authenticated
      }
    }
    
    // Not authenticated
    res.json({ isAuthenticated: false });
  } catch (error) {
    console.error('Auth status error:', error);
    res.status(500).json({ error: 'Internal server error', isAuthenticated: false });
  }
};
