const Airtable = require('airtable');

// Initialize variables
let airtableEnabled = false;
let base;
let usersTable;

try {
  // Configure Airtable
  if (process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID) {
    Airtable.configure({
      apiKey: process.env.AIRTABLE_API_KEY
    });
    
    base = Airtable.base(process.env.AIRTABLE_BASE_ID);
    usersTable = base('USERS');
    airtableEnabled = true;
    console.log('Airtable initialized successfully');
  } else {
    console.warn('Airtable API key or Base ID not provided. Using mock data instead.');
  }
} catch (error) {
  console.warn('Failed to initialize Airtable:', error.message);
}

/**
 * Find a user by their Google ID
 * @param {string} googleId - The Google ID to search for
 * @returns {Promise<Object|null>} - The user object or null if not found
 */
async function findUserByGoogleId(googleId) {
    if (!airtableEnabled) {
        // Return mock user data
        console.log('Using mock user data for Google ID:', googleId);
        return {
            id: 'mock-id-' + googleId,
            GoogleId: googleId,
            Username: 'Mock User',
            Email: 'mock@example.com',
            ProfilePicture: '',
            CreatedAt: new Date().toISOString(),
            LastLogin: new Date().toISOString(),
            SubscriptionPlan: 'basic',
            SubscriptionStatus: 'active',
            HoursUsed: 0
        };
    }
    
    try {
        const records = await usersTable.select({
            filterByFormula: `{GoogleId} = '${googleId}'`,
            maxRecords: 1
        }).firstPage();
        
        if (records && records.length > 0) {
            return {
                id: records[0].id,
                ...records[0].fields
            };
        }
        return null;
    } catch (error) {
        console.error('Error finding user by Google ID:', error);
        throw error;
    }
}

/**
 * Find a user by their email address
 * @param {string} email - The email address to search for
 * @returns {Promise<Object|null>} - The user object or null if not found
 */
async function findUserByEmail(email) {
    if (!airtableEnabled) {
        // Return mock user data
        console.log('Using mock user data for email:', email);
        return {
            id: 'mock-id-' + email,
            Email: email,
            Username: 'Mock User',
            PasswordHash: '', // No password for mock user
            CreatedAt: new Date().toISOString(),
            LastLogin: new Date().toISOString(),
            SubscriptionPlan: 'basic',
            SubscriptionStatus: 'active',
            HoursUsed: 0
        };
    }
    
    try {
        const records = await usersTable.select({
            filterByFormula: `{Email} = '${email}'`,
            maxRecords: 1
        }).firstPage();
        
        if (records && records.length > 0) {
            return {
                id: records[0].id,
                ...records[0].fields
            };
        }
        return null;
    } catch (error) {
        console.error('Error finding user by email:', error);
        throw error;
    }
}

/**
 * Find a user by their username
 * @param {string} username - The username to search for
 * @returns {Promise<Object|null>} - The user object or null if not found
 */
async function findUserByUsername(username) {
    if (!airtableEnabled) {
        // Return mock user data
        console.log('Using mock user data for username:', username);
        return {
            id: 'mock-id-' + username,
            Username: username,
            Email: 'mock@example.com',
            PasswordHash: '', // No password for mock user
            CreatedAt: new Date().toISOString(),
            LastLogin: new Date().toISOString(),
            SubscriptionPlan: 'basic',
            SubscriptionStatus: 'active',
            HoursUsed: 0
        };
    }
    
    try {
        const records = await usersTable.select({
            filterByFormula: `{Username} = '${username}'`,
            maxRecords: 1
        }).firstPage();
        
        if (records && records.length > 0) {
            return {
                id: records[0].id,
                ...records[0].fields
            };
        }
        return null;
    } catch (error) {
        console.error('Error finding user by username:', error);
        throw error;
    }
}

/**
 * Create a new user with email and password credentials
 * @param {Object} userData - User data to create
 * @param {string} userData.email - User's email
 * @param {string} userData.password - User's password (will be hashed)
 * @param {string} userData.username - User's username
 * @returns {Promise<Object>} - The created user object
 */
async function createUserWithCredentials(userData) {
    if (!airtableEnabled) {
        // Return mock user data
        console.log('Creating mock user with credentials for:', userData.email);
        return {
            id: 'mock-id-' + userData.email,
            Email: userData.email,
            Username: userData.username || '',
            PasswordHash: 'mock-password-hash',
            CreatedAt: new Date().toISOString(),
            LastLogin: new Date().toISOString(),
            SubscriptionPlan: 'free', // Default subscription plan
            SubscriptionStatus: 'inactive',
            HoursUsed: 0
        };
    }
    
    try {
        const records = await usersTable.create([
            {
                fields: {
                    Email: userData.email,
                    Username: userData.username || '',
                    PasswordHash: userData.passwordHash, // Already hashed password
                    CreatedAt: new Date().toISOString(),
                    LastLogin: new Date().toISOString(),
                    SubscriptionPlan: 'free', // Default subscription plan
                    SubscriptionStatus: 'inactive',
                    HoursUsed: 0
                }
            }
        ]);
        
        if (records && records.length > 0) {
            return {
                id: records[0].id,
                ...records[0].fields
            };
        }
        throw new Error('Failed to create user');
    } catch (error) {
        console.error('Error creating user with credentials:', error);
        throw error;
    }
}

/**
 * Create a new user in Airtable
 * @param {Object} userData - User data to create
 * @returns {Promise<Object>} - The created user object
 */
async function createUser(userData) {
    if (!airtableEnabled) {
        // Return mock user data
        console.log('Creating mock user for:', userData.displayName || userData.id);
        return {
            id: 'mock-id-' + userData.id,
            GoogleId: userData.id,
            Username: userData.displayName || '',
            Email: userData.emails && userData.emails[0] ? userData.emails[0].value : '',
            ProfilePicture: userData.photos && userData.photos[0] ? userData.photos[0].value : '',
            CreatedAt: new Date().toISOString(),
            LastLogin: new Date().toISOString(),
            SubscriptionPlan: 'free', // Default subscription plan
            SubscriptionStatus: 'inactive',
            HoursUsed: 0
        };
    }
    
    try {
        const records = await usersTable.create([
            {
                fields: {
                    GoogleId: userData.id,
                    Username: userData.displayName || '',
                    Email: userData.emails && userData.emails[0] ? userData.emails[0].value : '',
                    ProfilePicture: userData.photos && userData.photos[0] ? userData.photos[0].value : '',
                    CreatedAt: new Date().toISOString(),
                    LastLogin: new Date().toISOString(),
                    SubscriptionPlan: 'free', // Default subscription plan
                    SubscriptionStatus: 'inactive',
                    HoursUsed: 0
                }
            }
        ]);
        
        if (records && records.length > 0) {
            return {
                id: records[0].id,
                ...records[0].fields
            };
        }
        throw new Error('Failed to create user');
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
}

/**
 * Update a user in Airtable
 * @param {string} recordId - The Airtable record ID
 * @param {Object} userData - User data to update
 * @returns {Promise<Object>} - The updated user object
 */
async function updateUser(recordId, userData) {
    if (!airtableEnabled) {
        // Return mock updated user data
        console.log('Updating mock user:', recordId, userData);
        return {
            id: recordId,
            ...userData,
            LastUpdated: new Date().toISOString()
        };
    }
    
    try {
        const records = await usersTable.update([
            {
                id: recordId,
                fields: userData
            }
        ]);
        
        if (records && records.length > 0) {
            return {
                id: records[0].id,
                ...records[0].fields
            };
        }
        throw new Error('Failed to update user');
    } catch (error) {
        console.error('Error updating user:', error);
        throw error;
    }
}

/**
 * Update user's last login time
 * @param {string} recordId - The Airtable record ID
 * @returns {Promise<Object>} - The updated user object
 */
async function updateLastLogin(recordId) {
    console.log('Updating last login for user:', recordId);
    return updateUser(recordId, {
        LastLogin: new Date().toISOString()
    });
}

/**
 * Update user's subscription
 * @param {string} recordId - The Airtable record ID
 * @param {string} plan - The subscription plan
 * @param {string} status - The subscription status
 * @param {Date} expiryDate - The subscription expiry date
 * @returns {Promise<Object>} - The updated user object
 */
async function updateSubscription(recordId, plan, status, expiryDate) {
    console.log('Updating subscription for user:', recordId, plan, status);
    return updateUser(recordId, {
        SubscriptionPlan: plan,
        SubscriptionStatus: status,
        SubscriptionExpiry: expiryDate.toISOString()
    });
}

/**
 * Update user's usage hours
 * @param {string} recordId - The Airtable record ID
 * @param {number} additionalHours - Hours to add to the current usage
 * @returns {Promise<Object>} - The updated user object
 */
async function updateUsageHours(recordId, additionalHours) {
    if (!airtableEnabled) {
        console.log('Updating mock usage hours for user:', recordId, additionalHours);
        return {
            id: recordId,
            HoursUsed: additionalHours,
            LastUpdated: new Date().toISOString()
        };
    }
    
    try {
        // First get the current user to get current hours
        const user = await usersTable.find(recordId);
        const currentHours = user.fields.HoursUsed || 0;
        const newHours = currentHours + additionalHours;
        
        console.log(`Updating hours for user ${recordId}: ${currentHours} + ${additionalHours} = ${newHours}`);
        
        return updateUser(recordId, {
            HoursUsed: newHours
        });
    } catch (error) {
        console.error('Error updating usage hours:', error);
        throw error;
    }
}

/**
 * Get user's subscription details
 * @param {string} recordId - The Airtable record ID
 * @returns {Promise<Object>} - The subscription details
 */
async function getSubscription(recordId) {
    if (!airtableEnabled) {
        console.log('Getting mock subscription for user:', recordId);
        return {
            plan: 'basic',
            status: 'active',
            expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            hoursUsed: 2
        };
    }
    
    try {
        const user = await usersTable.find(recordId);
        
        return {
            plan: user.fields.SubscriptionPlan || 'free',
            status: user.fields.SubscriptionStatus || 'inactive',
            expiryDate: user.fields.SubscriptionExpiry ? new Date(user.fields.SubscriptionExpiry) : null,
            hoursUsed: user.fields.HoursUsed || 0
        };
    } catch (error) {
        console.error('Error getting subscription:', error);
        throw error;
    }
}

/**
 * Save a message to Airtable
 * @param {string} username - The username
 * @param {string} role - The message role ('user' or 'assistant')
 * @param {string} content - The message content
 * @param {string} characterName - The AI character name
 * @returns {Promise<Object>} - The created message object
 */
async function saveMessage(username, role, content, characterName = null) {
    console.log(`[AIRTABLE] Attempting to save ${role} message for user ${username}`);
    console.log(`[AIRTABLE] Message length: ${content ? content.length : 0} characters`);
    console.log(`[AIRTABLE] Character: ${characterName || 'None'}`);
    console.log(`[AIRTABLE] airtableEnabled: ${airtableEnabled}`);
    
    if (!airtableEnabled) {
        // Return mock message data
        console.log('[AIRTABLE] Airtable not enabled, saving mock message');
        return {
            id: 'mock-message-' + Date.now(),
            Username: username,
            Role: role,
            Content: content,
            Character: characterName,
            Timestamp: new Date().toISOString()
        };
    }
    
    try {
        // Validate inputs
        if (!username) {
            console.error('[AIRTABLE] No username provided for message');
            return null;
        }
        
        if (!content) {
            console.error('[AIRTABLE] No content provided for message');
            return null;
        }
        
        // Truncate content if it's too long for Airtable (100,000 character limit)
        const truncatedContent = content.length > 95000 
            ? content.substring(0, 95000) + '... [truncated]' 
            : content;
        
        console.log('[AIRTABLE] Creating message in Airtable...');
        console.log('[AIRTABLE] Base ID:', process.env.AIRTABLE_BASE_ID ? process.env.AIRTABLE_BASE_ID.substring(0, 5) + '...' : 'undefined');
        console.log('[AIRTABLE] API Key exists:', !!process.env.AIRTABLE_API_KEY);
        
        // Check if base is initialized
        if (!base) {
            console.error('[AIRTABLE] Airtable base not initialized');
            return null;
        }
        
        const messagesTable = base('MESSAGES');
        console.log('[AIRTABLE] Messages table accessed');
        
        // Log the record we're trying to create
        const recordToCreate = {
            fields: {
                Username: username,
                Role: role,
                Content: truncatedContent,
                Character: characterName || '',
                Timestamp: new Date().toISOString()
            }
        };
        console.log('[AIRTABLE] Record to create:', JSON.stringify(recordToCreate, null, 2));
        
        try {
            const records = await messagesTable.create([recordToCreate]);
            
            if (records && records.length > 0) {
                console.log(`[AIRTABLE] Message saved successfully with ID: ${records[0].id}`);
                return {
                    id: records[0].id,
                    ...records[0].fields
                };
            }
            
            console.error('[AIRTABLE] Failed to save message - no records returned');
            throw new Error('Failed to save message - no records returned');
        } catch (airtableError) {
            console.error('[AIRTABLE] Error in Airtable create operation:', airtableError);
            console.error('[AIRTABLE] Error message:', airtableError.message);
            console.error('[AIRTABLE] Error stack:', airtableError.stack);
            
            if (airtableError.error) {
                console.error('[AIRTABLE] Airtable error details:', airtableError.error);
            }
            
            throw airtableError;
        }
    } catch (error) {
        console.error('[AIRTABLE] Error saving message to Airtable:', error);
        console.error('[AIRTABLE] Error message:', error.message);
        console.error('[AIRTABLE] Error stack:', error.stack);
        
        // Log more details if available
        if (error.response) {
            console.error('[AIRTABLE] Airtable API response:', error.response.data);
        }
        
        // Return null instead of throwing to prevent breaking the main flow
        return null;
    }
}

/**
 * Get messages for a user, optionally filtered by character
 * @param {string} username - The username
 * @param {number} limit - Maximum number of messages to return
 * @param {string} character - Optional character name to filter by
 * @returns {Promise<Array>} - Array of message objects
 */
async function getUserMessages(username, limit = 100, character = null) {
    console.log(`[AIRTABLE] Getting messages for user: ${username}, limit: ${limit}, character: ${character || 'All'}`);
    console.log(`[AIRTABLE] airtableEnabled: ${airtableEnabled}`);
    
    if (!airtableEnabled) {
        // Return mock message data
        console.log('[AIRTABLE] Airtable not enabled, returning empty messages array');
        return [];
    }
    
    try {
        console.log('[AIRTABLE] Accessing messages table');
        const messagesTable = base('MESSAGES');
        
        // Build the filter formula based on whether a character is specified
        let filterFormula;
        if (character) {
            // Filter by both username and character
            filterFormula = `AND({Username} = '${username}', {Character} = '${character}')`;
            console.log(`[AIRTABLE] Querying messages with filter: ${filterFormula}`);
        } else {
            // Filter by username only
            filterFormula = `{Username} = '${username}'`;
            console.log(`[AIRTABLE] Querying messages with filter: ${filterFormula}`);
        }
        
        const records = await messagesTable.select({
            filterByFormula: filterFormula,
            sort: [{ field: 'Timestamp', direction: 'desc' }],
            maxRecords: limit
        }).firstPage();
        
        console.log(`[AIRTABLE] Found ${records.length} messages`);
        
        return records.map(record => ({
            id: record.id,
            ...record.fields
        }));
    } catch (error) {
        console.error('[AIRTABLE] Error getting user messages:', error);
        console.error('[AIRTABLE] Error message:', error.message);
        console.error('[AIRTABLE] Error stack:', error.stack);
        throw error;
    }
}

/**
 * Get adaptations for a specific user and character
 * @param {string} username - Username to get adaptations for
 * @param {string} characterName - Character name to filter by (optional)
 * @returns {Promise<Array>} - Array of adaptation records
 */
async function getUserAdaptations(username, characterName = null) {
    if (!airtableEnabled) {
        console.log('[AIRTABLE] Using mock adaptations for user:', username);
        return [];
    }
    
    try {
        console.log(`[AIRTABLE] Getting adaptations for user: ${username}, character: ${characterName || 'All'}`);
        
        // Check if base is initialized
        if (!base) {
            console.error('[AIRTABLE] Airtable base not initialized');
            return [];
        }
        
        // Get adaptations table
        const adaptationsTable = base('ADAPTATIONS');
        
        // Build filter formula with proper escaping of single quotes
        // Replace single quotes with escaped single quotes
        const escapedUsername = username.replace(/'/g, "\\'");
        let filterFormula = `{Username} = '${escapedUsername}'`;
        
        if (characterName) {
            const escapedCharacterName = characterName.replace(/'/g, "\\'");
            filterFormula += ` AND {Character} = '${escapedCharacterName}'`;
        }
        
        // Query Airtable
        const records = await adaptationsTable.select({
            filterByFormula: filterFormula,
            sort: [{ field: 'CreatedAt', direction: 'desc' }],
            maxRecords: 10
        }).firstPage();
        
        console.log(`[AIRTABLE] Found ${records.length} adaptations`);
        
        // Format records
        return records.map(record => ({
            id: record.id,
            ...record.fields
        }));
    } catch (error) {
        console.error('[AIRTABLE] Error getting adaptations:', error);
        return [];
    }
}

/**
 * Save adaptation data for a user
 * @param {string} username - Username to save adaptation for
 * @param {string} characterName - Character name
 * @param {Object} adaptationData - Adaptation data
 * @returns {Promise<Object>} - Saved adaptation record
 */
async function saveAdaptation(username, characterName, adaptationData) {
    if (!airtableEnabled) {
        console.log('[AIRTABLE] Using mock adaptation for user:', username);
        return {
            id: 'mock-adaptation-id',
            Username: username,
            Character: characterName,
            CompanionCharacter: adaptationData.companionCharacter || '',
            PlayerProfile: adaptationData.playerProfile || '',
            Memories: adaptationData.memories || '',
            Requests: adaptationData.requests || '',
            Ideas: adaptationData.ideas || '',
            Notes: adaptationData.notes || '',
            CreatedAt: new Date().toISOString()
        };
    }
    
    try {
        console.log(`[AIRTABLE] Saving adaptation for user: ${username}, character: ${characterName}`);
        
        // Check if base is initialized
        if (!base) {
            console.error('[AIRTABLE] Airtable base not initialized');
            return null;
        }
        
        // Get adaptations table
        const adaptationsTable = base('ADAPTATIONS');
        
        // Create record in Airtable
        const records = await adaptationsTable.create([{
            fields: {
                Username: username,
                Character: characterName,
                CompanionCharacter: adaptationData.companionCharacter || '',
                PlayerProfile: adaptationData.playerProfile || '',
                Memories: adaptationData.memories || '',
                Requests: adaptationData.requests || '',
                Ideas: adaptationData.ideas || '',
                Notes: adaptationData.notes || '',
                CreatedAt: new Date().toISOString()
            }
        }]);
        
        if (records && records.length > 0) {
            console.log(`[AIRTABLE] Adaptation saved with ID: ${records[0].id}`);
            return {
                id: records[0].id,
                ...records[0].fields
            };
        }
        
        console.error('[AIRTABLE] Failed to save adaptation - no records returned');
        return null;
    } catch (error) {
        console.error('[AIRTABLE] Error saving adaptation:', error);
        return null;
    }
}

/**
 * Get active quests for a user and character
 * @param {string} username - Username to get quests for
 * @param {string} characterName - Character name to filter by
 * @returns {Promise<Array>} - Array of active quest records
 */
async function getUserActiveQuests(username, characterName) {
    if (!airtableEnabled) return [];
    
    try {
        const questsTable = base('USER_QUESTS');
        const records = await questsTable.select({
            filterByFormula: `AND({Username} = '${username}', {Character} = '${characterName}', {Status} = 'active')`,
            maxRecords: 10
        }).firstPage();
        
        return records.map(record => ({
            id: record.id,
            ...record.fields
        }));
    } catch (error) {
        console.error('Error getting active quests:', error);
        return [];
    }
}

/**
 * Check for quest triggers in a conversation
 * @param {string} username - Username
 * @param {string} characterName - Character name
 * @param {string} userMessage - User's message
 * @param {string} aiResponse - AI's response
 * @returns {Promise<void>}
 */
async function checkQuestTriggers(username, characterName, userMessage, aiResponse) {
    if (!airtableEnabled) return;
    
    try {
        // Get active quests
        const activeQuests = await getUserActiveQuests(username, characterName);
        
        // If no active quests, activate initial ones
        if (activeQuests.length === 0) {
            await activateInitialQuests(username, characterName);
            return;
        }
        
        // Simple keyword-based trigger system
        const triggers = {
            'Ice Breaker': ['haha', 'lol', '😂', 'funny', 'laugh'],
            'Gaming Origin': ['first game', 'started gaming', 'childhood game'],
            'Current Obsession': ['playing now', 'current game', 'addicted to'],
            'Gaming Memory': ['remember when', 'best moment', 'favorite memory'],
            'Hidden Gem': ['underrated', 'hidden gem', 'not many people'],
            'Gaming Frustration': ['annoying', 'frustrating', 'hate when'],
            'Breakthrough Moment': ['finally beat', 'figured out', 'solved']
        };
        
        // Check each active quest
        for (const quest of activeQuests) {
            const questName = quest.QuestName;
            
            // Skip if no triggers defined
            if (!triggers[questName]) continue;
            
            // Check if any trigger keywords are in the message
            const keywords = triggers[questName];
            const messageMatches = keywords.some(keyword => 
                userMessage.toLowerCase().includes(keyword.toLowerCase()));
                
            // If message matches, complete the quest
            if (messageMatches) {
                await completeQuest(username, characterName, quest.QuestId, {
                    userMessage,
                    aiResponse,
                    evidence: `Matched keyword in user message: "${userMessage}"`
                });
                
                console.log(`Completed quest "${questName}" for ${username}`);
            }
        }
    } catch (error) {
        console.error('Error checking quest triggers:', error);
    }
}

/**
 * Activate initial quests for a new user
 * @param {string} username - Username
 * @param {string} characterName - Character name
 * @returns {Promise<void>}
 */
async function activateInitialQuests(username, characterName) {
    if (!airtableEnabled) return;
    
    try {
        // Get Tier 1 quests
        const questsTable = base('QUESTS');
        const tier1Quests = await questsTable.select({
            filterByFormula: `{Tier} = 1`,
            maxRecords: 5
        }).firstPage();
        
        // Activate 3 random quests
        const selectedQuests = tier1Quests
            .sort(() => 0.5 - Math.random())
            .slice(0, 3);
            
        // Create user quest records
        const userQuestsTable = base('USER_QUESTS');
        
        for (const quest of selectedQuests) {
            await userQuestsTable.create([{
                fields: {
                    Username: username,
                    QuestId: quest.id,
                    QuestName: quest.fields.Name,
                    Character: characterName,
                    Status: 'active',
                    ActivatedAt: new Date().toISOString()
                }
            }]);
        }
        
        console.log(`Activated ${selectedQuests.length} initial quests for ${username}`);
    } catch (error) {
        console.error('Error activating initial quests:', error);
    }
}

/**
 * Complete a quest
 * @param {string} username - Username
 * @param {string} characterName - Character name
 * @param {string} questId - Quest ID
 * @param {Object} data - Evidence data
 * @returns {Promise<void>}
 */
async function completeQuest(username, characterName, questId, data) {
    if (!airtableEnabled) return;
    
    try {
        // Update quest status
        const userQuestsTable = base('USER_QUESTS');
        const records = await userQuestsTable.select({
            filterByFormula: `AND({Username} = '${username}', {Character} = '${characterName}', {QuestId} = '${questId}', {Status} = 'active')`
        }).firstPage();
        
        if (records.length === 0) return;
        
        // Mark as completed
        await userQuestsTable.update([{
            id: records[0].id,
            fields: {
                Status: 'completed',
                CompletedAt: new Date().toISOString(),
                Evidence: JSON.stringify(data)
            }
        }]);
        
        // Check if we should activate next tier quests
        await checkTierProgression(username, characterName);
    } catch (error) {
        console.error('Error completing quest:', error);
    }
}

/**
 * Check if we should activate next tier quests
 * @param {string} username - Username
 * @param {string} characterName - Character name
 * @returns {Promise<void>}
 */
async function checkTierProgression(username, characterName) {
    if (!airtableEnabled) return;
    
    try {
        // Get completed quests
        const userQuestsTable = base('USER_QUESTS');
        const completedQuests = await userQuestsTable.select({
            filterByFormula: `AND({Username} = '${username}', {Character} = '${characterName}', {Status} = 'completed')`
        }).firstPage();
        
        // Get quest details to check tiers
        const questIds = completedQuests.map(record => record.fields.QuestId);
        
        if (questIds.length === 0) return;
        
        // Get quest details
        const questsTable = base('QUESTS');
        const quests = await questsTable.select({
            filterByFormula: `OR(${questIds.map(id => `RECORD_ID() = '${id}'`).join(',')})`
        }).firstPage();
        
        // Count completed quests by tier
        const completedByTier = {};
        quests.forEach(quest => {
            const tier = quest.fields.Tier;
            completedByTier[tier] = (completedByTier[tier] || 0) + 1;
        });
        
        // Check if we should activate next tier
        // Require at least 3 completed quests to unlock next tier
        for (let tier = 1; tier <= 4; tier++) {
            if ((completedByTier[tier] || 0) >= 3) {
                // Activate next tier quests
                await activateNextTierQuests(username, characterName, tier + 1);
            }
        }
    } catch (error) {
        console.error('Error checking tier progression:', error);
    }
}

/**
 * Activate quests from the next tier
 * @param {string} username - Username
 * @param {string} characterName - Character name
 * @param {number} tier - Tier to activate
 * @returns {Promise<void>}
 */
async function activateNextTierQuests(username, characterName, tier) {
    if (!airtableEnabled) return;
    
    try {
        // Check if user already has active quests from this tier
        const userQuestsTable = base('USER_QUESTS');
        const existingQuests = await userQuestsTable.select({
            filterByFormula: `AND({Username} = '${username}', {Character} = '${characterName}', {Tier} = ${tier})`
        }).firstPage();
        
        if (existingQuests.length > 0) return; // Already has quests from this tier
        
        // Get quests from the next tier
        const questsTable = base('QUESTS');
        const nextTierQuests = await questsTable.select({
            filterByFormula: `{Tier} = ${tier}`,
            maxRecords: 5
        }).firstPage();
        
        // Activate 2 random quests
        const selectedQuests = nextTierQuests
            .sort(() => 0.5 - Math.random())
            .slice(0, 2);
            
        // Create user quest records
        for (const quest of selectedQuests) {
            await userQuestsTable.create([{
                fields: {
                    Username: username,
                    QuestId: quest.id,
                    QuestName: quest.fields.Name,
                    Character: characterName,
                    Tier: tier,
                    Status: 'active',
                    ActivatedAt: new Date().toISOString()
                }
            }]);
        }
        
        console.log(`Activated ${selectedQuests.length} tier ${tier} quests for ${username}`);
    } catch (error) {
        console.error('Error activating next tier quests:', error);
    }
}

module.exports = {
    findUserByGoogleId,
    findUserByEmail,
    findUserByUsername,
    createUser,
    createUserWithCredentials,
    updateUser,
    updateLastLogin,
    updateSubscription,
    updateUsageHours,
    getSubscription,
    saveMessage,
    getUserMessages,
    getUserAdaptations,
    saveAdaptation,
    getUserActiveQuests,
    checkQuestTriggers,
    activateInitialQuests,
    completeQuest,
    checkTierProgression,
    activateNextTierQuests
};
