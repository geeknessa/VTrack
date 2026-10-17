function requireAuth(req, res, next) {
  // If already resolved by tab session middleware in index.js:
  if (req.userId) {
    return next();
  }

  // Fall back to standard express-session cookie:
  if (req.session && req.session.userId) {
    req.userId = req.session.userId;
    return next();
  }

  return res.status(401).json({
    error: {
      message: 'Please log in or sign up to continue.',
      code: 'UNAUTHORIZED',
      action: 'auth_required'
    }
  });
}

module.exports = { requireAuth };
