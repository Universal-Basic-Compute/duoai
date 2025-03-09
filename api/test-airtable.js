const Airtable = require('airtable');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Verify Airtable module is loaded
    if (typeof Airtable === 'function') {
      return res.status(200).json({ 
        success: true, 
        message: 'Airtable module loaded successfully',
        version: require('airtable/package.json').version
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        message: 'Airtable module not loaded correctly',
        type: typeof Airtable
      });
    }
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Error testing Airtable module',
      error: error.message
    });
  }
};
