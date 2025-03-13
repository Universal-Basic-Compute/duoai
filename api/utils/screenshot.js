const { handleCors, validateMethod } = require('./common');

module.exports = async function handler(req, res) {
  console.log('Screenshot API handler called');
  
  // Handle CORS and validate request method
  if (handleCors(req, res)) {
    console.log('CORS handled, returning early');
    return;
  }
  
  if (!validateMethod(req, res)) {
    console.log('Method validation failed, returning early');
    return;
  }

  try {
    console.log('Processing screenshot request');
    
    // Check if we have screenshot data
    if (!req.body || !req.body.screenshot) {
      return res.status(400).json({ error: 'Screenshot data is required' });
    }

    // Just return success - we're not storing the screenshot, just passing it through
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Screenshot API error:', error.message);
    return res.status(500).json({ 
      error: 'Error processing screenshot',
      details: error.message
    });
  }
}
