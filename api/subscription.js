// This is a simplified version for Vercel deployment
// In a production environment, you would connect to your database
module.exports = async (req, res) => {
  // For Vercel deployment, we'll return mock subscription data
  // In production, fetch this from your database
  
  // Check for authentication
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  // Mock subscription data
  const subscription = {
    userId: 'mock-user-id',
    plan: 'pro',
    status: 'active',
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    hoursUsed: 5,
    hoursTotal: 30
  };
  
  res.json(subscription);
};
