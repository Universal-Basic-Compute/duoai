const airtableService = require('../../airtable-service');
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
    
    // Check for authentication
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        // Extract token
        const token = authHeader.substring(7);
        
        // Verify and decode the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'duoai-jwt-secret');
        
        // Get user data from the token
        const userEmail = decoded.email;
        
        // Get the user from Airtable to get the username
        const user = await airtableService.findUserByEmail(userEmail);
        const username = user ? user.Username : userEmail;
        
        const { character } = req.query;
        
        if (!character) {
            return res.status(400).json({ error: 'Character name is required' });
        }
        
        // Get completed quests
        const completed = await airtableService.getCompletedQuests(username, character);
        
        // Get active quests
        const active = await airtableService.getUserActiveQuests(username, character);
        
        // Calculate relationship level
        const highestTier = Math.max(...completed.map(q => q.Tier || 1), 1);
        const completedCount = completed.length;
        
        const relationshipLevels = [
            "New Acquaintance", "Casual Friend", "Gaming Buddy", 
            "Trusted Companion", "Kindred Spirit", "Inseparable Duo"
        ];
        
        const levelIndex = Math.min(Math.floor(completedCount / 3) + highestTier - 1, relationshipLevels.length - 1);
        
        // Format quest data for the response
        const formatQuestData = (quest) => ({
            id: quest.id,
            questId: quest.QuestId,
            name: quest.QuestName,
            description: quest.QuestDescription || '',
            tier: quest.Tier || 1,
            status: quest.Status,
            activatedAt: quest.ActivatedAt,
            completedAt: quest.CompletedAt || null,
            evidence: quest.Evidence ? JSON.parse(quest.Evidence) : null
        });
        
        res.json({
            active: active.map(formatQuestData),
            completed: completed.map(formatQuestData),
            relationship: {
                tier: highestTier,
                level: relationshipLevels[levelIndex],
                progress: completedCount % 3 / 3
            }
        });
    } catch (error) {
        console.error('Error fetching quest journal:', error);
        res.status(500).json({ error: 'Failed to fetch quest journal' });
    }
};
