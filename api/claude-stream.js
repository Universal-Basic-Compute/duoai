/**
 * DEPRECATED: This file is no longer used.
 * The streaming functionality is now implemented directly in server.js.
 * This file can be safely deleted.
 */
module.exports = async (req, res) => {
    return res.status(410).json({ 
        error: 'This endpoint is deprecated',
        message: 'Streaming functionality is now implemented in server.js'
    });
};
