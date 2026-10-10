const store = require('../data/store');

function auth(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) {
    return res.status(401).json({ error: { code: 401, message: 'Missing X-API-Key header' } });
  }
  const apiKey = store.validateApiKey(key);
  if (!apiKey) {
    return res.status(401).json({ error: { code: 401, message: 'Invalid API key' } });
  }
  req.apiKey = apiKey;
  next();
}

module.exports = auth;
