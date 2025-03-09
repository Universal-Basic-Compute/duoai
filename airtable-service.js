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
 * @param {string} context - The message context ('standard' or 'onboarding')
 * @param {boolean} triggeredQuest - Whether this message has triggered quest verification
 * @param {boolean} triggeredAdaptation - Whether this message has triggered adaptation
 * @returns {Promise<Object>} - The created message object
 */
async function saveMessage(username, role, content, characterName = null, context = 'standard', triggeredQuest = false, triggeredAdaptation = false) {
    console.log(`[AIRTABLE] Attempting to save ${role} message for user ${username}`);
    console.log(`[AIRTABLE] Message length: ${content ? content.length : 0} characters`);
    console.log(`[AIRTABLE] Character: ${characterName || 'None'}`);
    console.log(`[AIRTABLE] airtableEnabled: ${airtableEnabled}`);
    console.log(`[AIRTABLE] Triggered Quest: ${triggeredQuest}`);
    console.log(`[AIRTABLE] Triggered Adaptation: ${triggeredAdaptation}`);
    
    if (!airtableEnabled) {
        // Return mock message data
        console.log('[AIRTABLE] Airtable not enabled, saving mock message');
        return {
            id: 'mock-message-' + Date.now(),
            Username: username,
            Role: role,
            Content: content,
            Character: characterName,
            Timestamp: new Date().toISOString(),
            Context: context,
            TriggeredQuest: triggeredQuest,
            TriggeredAdaptation: triggeredAdaptation
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
                Timestamp: new Date().toISOString(),
                Context: context,
                TriggeredQuest: triggeredQuest,
                TriggeredAdaptation: triggeredAdaptation
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
        // Replace single quotes with double single quotes (Airtable's escape syntax)
        const escapedUsername = username.replace(/'/g, "''");
        let filterFormula = `{Username} = '${escapedUsername}'`;
        
        if (characterName) {
            const escapedCharacterName = characterName.replace(/'/g, "''");
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
 * Get completed quests for a user and character
 * @param {string} username - Username to get quests for
 * @param {string} characterName - Character name to filter by
 * @returns {Promise<Array>} - Array of completed quest records
 */
async function getCompletedQuests(username, characterName) {
    if (!airtableEnabled) return [];
    
    try {
        const questsTable = base('USER_QUESTS');
        const records = await questsTable.select({
            filterByFormula: `AND({Username} = '${username}', {Character} = '${characterName}', {Status} = 'completed')`,
            maxRecords: 50,
            sort: [{ field: 'CompletedAt', direction: 'desc' }]
        }).firstPage();
        
        return records.map(record => ({
            id: record.id,
            ...record.fields
        }));
    } catch (error) {
        console.error('Error getting completed quests:', error);
        return [];
    }
}

/**
 * Check for quest triggers in a conversation
 * @param {string} username - Username
 * @param {string} characterName - Character name
 * @param {string} userMessage - User's message
 * @param {string} aiResponse - AI's response
 * @returns {Promise<Object|null>} - Quest completion info or null
 */
async function checkQuestTriggers(username, characterName, userMessage, aiResponse) {
    if (!airtableEnabled) return null;
    
    try {
        // Get active quests
        const activeQuests = await getUserActiveQuests(username, characterName);
        
        // If no active quests, activate initial ones
        if (activeQuests.length === 0) {
            await activateInitialQuests(username, characterName);
            return null;
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
                
                // Return quest completion info
                return {
                    completed: true,
                    questName: questName,
                    tier: quest.Tier || 1
                };
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error checking quest triggers:', error);
        return null;
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

/**
 * Get active quests formatted for system prompt
 * @param {string} username - Username to get quests for
 * @param {string} characterName - Character name to filter by
 * @returns {Promise<string>} - Formatted quests text for system prompt
 */
async function getActiveQuestsForPrompt(username, characterName) {
    if (!airtableEnabled) return '';
    
    try {
        const activeQuests = await getUserActiveQuests(username, characterName);
        
        if (!activeQuests || activeQuests.length === 0) {
            console.log(`[QUESTS] No active quests found for ${username} with ${characterName}`);
            return '';
        }
        
        console.log(`[QUESTS] Found ${activeQuests.length} active quests for system prompt`);
        
        // Format quests for the system prompt
        let questsText = 'ACTIVE QUESTS (subtly pursue these objectives through natural conversation):\n';
        
        activeQuests.forEach((quest, index) => {
            questsText += `${index + 1}. ${quest.QuestName}`;
            
            // Add description if available
            if (quest.QuestDescription) {
                questsText += `: ${quest.QuestDescription}`;
            }
            
            questsText += '\n';
        });
        
        return questsText;
    } catch (error) {
        console.error('[QUESTS] Error getting active quests for prompt:', error);
        return '';
    }
}

/**
 * Calculate relationship depth score for a user and character
 * @param {string} username - Username
 * @param {string} characterName - Character name
 * @returns {Promise<Object>} - Relationship depth information
 */
async function calculateRelationshipDepth(username, characterName) {
    if (!airtableEnabled) return { score: 0, level: "New Acquaintance", tier: 1, progress: 0 };
    
    try {
        // Get completed quests
        const completedQuests = await getCompletedQuests(username, characterName);
        
        if (!completedQuests || completedQuests.length === 0) {
            return { score: 0, level: "New Acquaintance", tier: 1, progress: 0 };
        }
        
        // Calculate base score (1 point per completed quest)
        let baseScore = completedQuests.length;
        
        // Add tier bonuses (higher tier quests are worth more)
        let tierBonus = 0;
        let highestTier = 1;
        
        // Count quests by tier
        const questsByTier = {};
        
        completedQuests.forEach(quest => {
            const tier = quest.Tier || 1;
            questsByTier[tier] = (questsByTier[tier] || 0) + 1;
            
            // Track highest tier
            if (tier > highestTier) highestTier = tier;
            
            // Add tier-based bonus points
            tierBonus += (tier - 1) * 2; // Tier 1: +0, Tier 2: +2, Tier 3: +4, etc.
        });
        
        // Calculate total score
        const totalScore = baseScore + tierBonus;
        
        // Determine relationship level based on score and highest tier
        const relationshipLevels = [
            "New Acquaintance",    // 0-5 points
            "Casual Friend",       // 6-15 points
            "Gaming Buddy",        // 16-30 points
            "Trusted Companion",   // 31-50 points
            "Kindred Spirit",      // 51-75 points
            "Inseparable Duo"      // 76+ points
        ];
        
        // Calculate level index based on score ranges
        let levelIndex = 0;
        if (totalScore > 5) levelIndex = 1;
        if (totalScore > 15) levelIndex = 2;
        if (totalScore > 30) levelIndex = 3;
        if (totalScore > 50) levelIndex = 4;
        if (totalScore > 75) levelIndex = 5;
        
        // Adjust level based on highest tier (can't be more than highest tier + 1)
        levelIndex = Math.min(levelIndex, highestTier);
        
        // Calculate progress to next level (as a percentage)
        const levelThresholds = [0, 5, 15, 30, 50, 75];
        const currentThreshold = levelThresholds[levelIndex];
        const nextThreshold = levelIndex < 5 ? levelThresholds[levelIndex + 1] : currentThreshold * 1.5;
        
        const progress = levelIndex < 5 
            ? (totalScore - currentThreshold) / (nextThreshold - currentThreshold)
            : 1; // Max level
        
        return {
            score: totalScore,
            level: relationshipLevels[levelIndex],
            tier: highestTier,
            progress: Math.min(1, Math.max(0, progress)), // Ensure between 0-1
            completedCount: completedQuests.length,
            questsByTier
        };
    } catch (error) {
        console.error('Error calculating relationship depth:', error);
        return { score: 0, level: "New Acquaintance", tier: 1, progress: 0 };
    }
}

/**
 * Verify quest completions using LLM analysis
 * @param {string} username - Username to check quests for
 * @param {string} characterName - Character name
 * @returns {Promise<Object>} - Results of quest verification
 */
async function verifyQuestsWithLLM(username, characterName) {
    if (!airtableEnabled) return { verified: [] };
    
    try {
        // Get active quests
        const activeQuests = await getUserActiveQuests(username, characterName);
        
        if (activeQuests.length === 0) {
            console.log(`[QUESTS] No active quests for ${username}, activating initial quests`);
            await activateInitialQuests(username, characterName);
            return { verified: [] };
        }
        
        // Get recent conversation history (last 20 messages)
        const recentMessages = await getUserMessages(username, 20, characterName);
        
        if (!recentMessages || recentMessages.length === 0) {
            console.log(`[QUESTS] No recent messages found for ${username}`);
            return { verified: [] };
        }
        
        // Format the conversation for the LLM
        const conversationText = recentMessages
            .sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp))
            .map(msg => `${msg.Role === 'user' ? 'Player' : 'AI'}: ${msg.Content}`)
            .join('\n\n');
        
        // Format the quests for the LLM
        const questsText = activeQuests.map(quest => 
            `Quest: ${quest.QuestName}\nDescription: ${quest.QuestDescription || 'No description available'}\nID: ${quest.QuestId}`
        ).join('\n\n');
        
        // Create the prompt for the LLM
        const prompt = `
You are analyzing a gaming conversation to determine if any quests have been completed.

ACTIVE QUESTS:
${questsText}

RECENT CONVERSATION:
${conversationText}

For each quest, determine if it has been completed based on the conversation. 
A quest is completed when there is clear evidence in the conversation that matches the quest's objective.

Respond with a JSON object in this format:
{
  "verified": [
    {
      "questId": "quest-id-1",
      "completed": true,
      "evidence": "Clear explanation of why this quest is considered completed, citing specific parts of the conversation",
      "confidence": 0.95
    },
    {
      "questId": "quest-id-2",
      "completed": false,
      "evidence": "Explanation of why this quest is not considered completed",
      "confidence": 0.8
    }
  ]
}

Only mark a quest as completed if there is strong evidence (confidence > 0.8). Include all active quests in your response.
`;

        // Call Claude API for verification
        const payload = {
            model: 'claude-3-7-sonnet-latest',
            system: "You are an AI assistant that analyzes gaming conversations to verify quest completions. Respond only with valid JSON.",
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: prompt
                        }
                    ]
                }
            ],
            max_tokens: 2000
        };
        
        console.log('[QUESTS] Sending quest verification request to Claude API');
        
        const response = await axios.post('https://api.anthropic.com/v1/messages', payload, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            }
        });
        
        // Extract the JSON response
        const verificationText = response.data.content[0].text;
        console.log('[QUESTS] Received verification response');
        
        // Parse the JSON
        let verificationData;
        try {
            verificationData = JSON.parse(verificationText);
            console.log('[QUESTS] Successfully parsed verification JSON');
            
            // Process completed quests
            for (const result of verificationData.verified) {
                if (result.completed && result.confidence >= 0.8) {
                    console.log(`[QUESTS] Quest ${result.questId} verified as completed with confidence ${result.confidence}`);
                    
                    // Complete the quest
                    await completeQuest(username, characterName, result.questId, {
                        evidence: result.evidence,
                        confidence: result.confidence,
                        verifiedByLLM: true,
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
            return verificationData;
        } catch (parseError) {
            console.error('[QUESTS] Error parsing verification JSON:', parseError);
            console.error('[QUESTS] Raw response:', verificationText);
            return { verified: [] };
        }
    } catch (error) {
        console.error('[QUESTS] Error verifying quests with LLM:', error);
        return { verified: [] };
    }
}

/**
 * Find messages that need quest or adaptation verification
 * @param {string} username - Username to check messages for
 * @param {string} characterName - Character name
 * @param {number} messageCount - Number of messages to check
 * @returns {Promise<Object>} - Messages that need verification
 */
async function findMessagesNeedingVerification(username, characterName, messageCount = 10) {
    if (!airtableEnabled) return { needsQuestVerification: false, needsAdaptationVerification: false };
    
    try {
        // Get recent messages
        const messagesTable = base('MESSAGES');
        
        // Build filter formula
        let filterFormula = `AND({Username} = '${username}', {Character} = '${characterName}')`;
        
        // Query Airtable
        const records = await messagesTable.select({
            filterByFormula: filterFormula,
            sort: [{ field: 'Timestamp', direction: 'desc' }],
            maxRecords: messageCount
        }).firstPage();
        
        // Check if we have enough messages
        if (records.length < 10) {
            return { needsQuestVerification: false, needsAdaptationVerification: false };
        }
        
        // Count messages that have triggered quest/adaptation
        const questTriggered = records.filter(record => record.fields.TriggeredQuest).length;
        const adaptationTriggered = records.filter(record => record.fields.TriggeredAdaptation).length;
        
        // If less than half have triggered, we need verification
        return {
            needsQuestVerification: questTriggered < 5,
            needsAdaptationVerification: adaptationTriggered < 5
        };
    } catch (error) {
        console.error('[AIRTABLE] Error finding messages needing verification:', error);
        return { needsQuestVerification: false, needsAdaptationVerification: false };
    }
}

/**
 * Mark recent messages as having triggered verification
 * @param {string} username - Username
 * @param {string} characterName - Character name
 * @param {string} verificationType - Type of verification ('quest' or 'adaptation')
 * @returns {Promise<void>}
 */
async function markRecentMessagesAsVerified(username, characterName, verificationType) {
    if (!airtableEnabled) return;
    
    try {
        // Get recent messages
        const messagesTable = base('MESSAGES');
        
        // Build filter formula
        let filterFormula = `AND({Username} = '${username}', {Character} = '${characterName}')`;
        
        if (verificationType === 'quest') {
            filterFormula += `, {TriggeredQuest} = FALSE()`;
        } else if (verificationType === 'adaptation') {
            filterFormula += `, {TriggeredAdaptation} = FALSE()`;
        }
        
        // Query Airtable
        const records = await messagesTable.select({
            filterByFormula: filterFormula,
            sort: [{ field: 'Timestamp', direction: 'desc' }],
            maxRecords: 10
        }).firstPage();
        
        // Update records
        const updates = records.map(record => ({
            id: record.id,
            fields: verificationType === 'quest' 
                ? { TriggeredQuest: true }
                : { TriggeredAdaptation: true }
        }));
        
        if (updates.length > 0) {
            await messagesTable.update(updates);
            console.log(`[AIRTABLE] Marked ${updates.length} messages as having triggered ${verificationType} verification`);
        }
    } catch (error) {
        console.error(`[AIRTABLE] Error marking messages as verified for ${verificationType}:`, error);
    }
}

/**
 * Periodically check for quest completions and adaptations
 * @param {string} username - Username to check quests for
 * @param {string} characterName - Character name
 * @param {number} messageCount - Current message count
 * @returns {Promise<Object>} - Results of verification
 */
async function periodicQuestAndAdaptationCheck(username, characterName, messageCount) {
    if (!airtableEnabled) return { questsVerified: false, adaptationRun: false };
    
    try {
        console.log(`[QUESTS] Performing periodic check for user ${username} with ${characterName}, message count: ${messageCount}`);
        
        // Check if we have enough messages to run verification
        if (messageCount < 10) {
            console.log(`[QUESTS] Not enough messages (${messageCount}) to run verification`);
            return { questsVerified: false, adaptationRun: false };
        }
        
        // Check if we need to run verification based on message flags
        const { needsQuestVerification, needsAdaptationVerification } = 
            await findMessagesNeedingVerification(username, characterName);
        
        let questsVerified = false;
        let adaptationRun = false;
        
        // Run quest verification if needed
        if (needsQuestVerification) {
            console.log(`[QUESTS] Running quest verification for ${username}`);
            const verificationResults = await verifyQuestsWithLLM(username, characterName);
            
            // Mark messages as having triggered quest verification
            await markRecentMessagesAsVerified(username, characterName, 'quest');
            
            questsVerified = true;
        }
        
        // Run adaptation if needed
        if (needsAdaptationVerification) {
            console.log(`[ADAPTATION] Running adaptation analysis for ${username}`);
            
            // Mark messages as having triggered adaptation
            await markRecentMessagesAsVerified(username, characterName, 'adaptation');
            
            adaptationRun = true;
        }
        
        return { questsVerified, adaptationRun };
    } catch (error) {
        console.error('Error in periodic quest and adaptation check:', error);
        return { questsVerified: false, adaptationRun: false };
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
    getCompletedQuests,
    checkQuestTriggers,
    activateInitialQuests,
    completeQuest,
    checkTierProgression,
    activateNextTierQuests,
    verifyQuestsWithLLM,
    findMessagesNeedingVerification,
    markRecentMessagesAsVerified,
    periodicQuestAndAdaptationCheck,
    getActiveQuestsForPrompt,
    calculateRelationshipDepth
};
