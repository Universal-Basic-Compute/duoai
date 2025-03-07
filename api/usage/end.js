const airtableService = require('../../airtable-service');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // In a real app, you would authenticate the user here
    // For now, we'll use a mock user ID
    const userId = 'mock-user-id';
    
    const { sessionId } = req.body;
    
    if (!sessionId) {
        return res.status(400).json({ error: 'No session ID provided' });
    }
    
    try {
        // In a real app, you would calculate the actual duration
        // For now, we'll use a mock duration
        const duration = 0.1; // 6 minutes in hours
        
        // Update the user's usage in Airtable
        await airtableService.updateUsageHours(userId, duration);
        
        res.json({ duration });
    } catch (error) {
        console.error('Error updating usage hours:', error);
        res.status(500).json({ error: 'Failed to update usage hours' });
    }
};
