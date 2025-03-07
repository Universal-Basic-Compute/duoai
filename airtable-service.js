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

module.exports = {
    findUserByGoogleId,
    createUser,
    updateUser,
    updateLastLogin,
    updateSubscription,
    updateUsageHours,
    getSubscription
};
