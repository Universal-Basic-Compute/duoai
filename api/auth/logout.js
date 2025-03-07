module.exports = async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // In a real app, you would invalidate the token
    // For now, we'll just return success
    
    res.json({ success: true });
};
