const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  try {
    // Check for authentication header
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Extract token and validate
      const token = authHeader.substring(7);
      
      try {
        // Basic verification of token structure
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
        // Continue to return not authenticated
      }
    }
    
    // Not authenticated
    res.json({ isAuthenticated: false });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', isAuthenticated: false });
  }
};
