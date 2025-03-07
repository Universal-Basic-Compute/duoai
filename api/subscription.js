module.exports = async (req, res) => {
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
