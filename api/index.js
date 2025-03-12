const { setCorsHeaders } = require('./utils/common');

module.exports = function handler(req, res) {
  setCorsHeaders(res);
  res.status(200).json({ status: 'API is running' });
}
