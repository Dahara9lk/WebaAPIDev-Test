const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: { code: 401, message: 'Missing Authorization header' } });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: { code: 401, message: 'Invalid Authorization header format. Use: Bearer <token>' } });
  }

  const token = parts[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: { code: 401, message: 'Token has expired' } });
    }
    return res.status(401).json({ error: { code: 401, message: 'Invalid or expired token' } });
  }
}

module.exports = authenticate;
