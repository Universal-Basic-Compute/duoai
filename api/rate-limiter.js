const airtableService = require('./airtable-service');

// In-memory store for rate limiting
const rateLimits = new Map();

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimits.entries()) {
    // Remove entries older than 4 hours
    if (now - data.timestamp > 4 * 60 * 60 * 1000) {
      rateLimits.delete(key);
    }
  }
}, 15 * 60 * 1000); // Clean up every 15 minutes

/**
 * Rate limiting middleware
 * @param {string} username - Username to check rate limit for
 * @returns {Object} - Rate limit status
 */
async function checkRateLimit(username) {
  if (!username) {
    return { limited: false }; // Skip rate limiting if no username
  }
  
  const now = Date.now();
  const fourHoursAgo = now - 4 * 60 * 60 * 1000;
  const key = `${username}_${Math.floor(now / (4 * 60 * 60 * 1000))}`;
  
  // Get current rate limit data
  let limitData = rateLimits.get(key);
  
  if (!limitData) {
    // If no data exists for this time block, create new entry
    limitData = {
      count: 0,
      timestamp: now
    };
    rateLimits.set(key, limitData);
  }
  
  // Check if user has subscription that bypasses rate limits
  try {
    const user = await airtableService.findUserByUsername(username);
    if (user && user.SubscriptionPlan && user.SubscriptionPlan !== 'free') {
      // Paid users bypass rate limits
      return { limited: false };
    }
  } catch (error) {
    console.error('Error checking user subscription:', error);
    // Continue with rate limiting if there's an error
  }
  
  // Increment count
  limitData.count += 1;
  
  // Check if rate limit exceeded
  if (limitData.count > 50) {
    return {
      limited: true,
      reset: new Date(Math.ceil(now / (4 * 60 * 60 * 1000)) * 4 * 60 * 60 * 1000),
      limit: 50,
      remaining: 0
    };
  }
  
  return {
    limited: false,
    reset: new Date(Math.ceil(now / (4 * 60 * 60 * 1000)) * 4 * 60 * 60 * 1000),
    limit: 50,
    remaining: 50 - limitData.count
  };
}

module.exports = { checkRateLimit };
