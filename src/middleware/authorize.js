function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { code: 401, message: 'Authentication required' } });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: { code: 403, message: 'Forbidden: insufficient permissions' } });
    }
    next();
  };
}

module.exports = authorize;
