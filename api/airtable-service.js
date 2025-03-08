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
            Name: 'Mock User',
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
            Name: userData.displayName || '',
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
                    Name: userData.displayName || '',
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
 * @param {string} userId - The user ID
 * @param {string} role - The message role ('user' or 'assistant')
 * @param {string} content - The message content
 * @param {string} characterName - The AI character name
 * @returns {Promise<Object>} - The created message object
 */
async function saveMessage(userId, role, content, characterName = null) {
    console.log(`[AIRTABLE] Attempting to save ${role} message for user ${userId}`);
    console.log(`[AIRTABLE] Message length: ${content ? content.length : 0} characters`);
    console.log(`[AIRTABLE] Character: ${characterName || 'None'}`);
    console.log(`[AIRTABLE] airtableEnabled: ${airtableEnabled}`);
    
    if (!airtableEnabled) {
        // Return mock message data
        console.log('[AIRTABLE] Airtable not enabled, saving mock message');
        return {
            id: 'mock-message-' + Date.now(),
            UserId: userId,
            Role: role,
            Content: content,
            Character: characterName,
            Timestamp: new Date().toISOString()
        };
    }
    
    try {
        // Validate inputs
        if (!userId) {
            console.error('[AIRTABLE] No user ID provided for message');
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
                UserId: userId,
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
 * Get messages for a user
 * @param {string} userId - The user ID
 * @param {number} limit - Maximum number of messages to return
 * @returns {Promise<Array>} - Array of message objects
 */
async function getUserMessages(userId, limit = 100) {
    console.log(`[AIRTABLE] Getting messages for user: ${userId}, limit: ${limit}`);
    console.log(`[AIRTABLE] airtableEnabled: ${airtableEnabled}`);
    
    if (!airtableEnabled) {
        // Return mock message data
        console.log('[AIRTABLE] Airtable not enabled, returning empty messages array');
        return [];
    }
    
    try {
        console.log('[AIRTABLE] Accessing messages table');
        const messagesTable = base('MESSAGES');
        
        console.log(`[AIRTABLE] Querying messages with filter: {UserId} = '${userId}'`);
        const records = await messagesTable.select({
            filterByFormula: `{UserId} = '${userId}'`,
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

module.exports = {
    findUserByGoogleId,
    createUser,
    updateUser,
    updateLastLogin,
    updateSubscription,
    updateUsageHours,
    getSubscription,
    saveMessage,
    getUserMessages
};
