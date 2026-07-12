import jwt from 'jsonwebtoken';

// Demo-scoped: single JWT, no refresh rotation, cookie-based.
// Harden before real patient data: short-lived access token + refresh token
// pair, token revocation list, rate limiting on /auth routes.
export function requireAuth(req, res, next) {
  const token = req.cookies?.token || (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized for this resource' });
    }
    next();
  };
}
