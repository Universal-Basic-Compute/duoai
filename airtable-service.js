const Airtable = require('airtable');

// Configure Airtable
Airtable.configure({
    apiKey: process.env.AIRTABLE_API_KEY
});

const base = Airtable.base(process.env.AIRTABLE_BASE_ID);
const usersTable = base('USERS');

/**
 * Find a user by their Google ID
 * @param {string} googleId - The Google ID to search for
 * @returns {Promise<Object|null>} - The user object or null if not found
 */
async function findUserByGoogleId(googleId) {
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
    try {
        // First get the current user to get current hours
        const user = await usersTable.find(recordId);
        const currentHours = user.fields.HoursUsed || 0;
        const newHours = currentHours + additionalHours;
        
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
