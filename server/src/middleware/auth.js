import { getSessionUser } from '../utils/token.js';

export function requireAuth(req, res, next) {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }
  req.sessionUser = user;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    const user = getSessionUser(req);
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ message: 'Access denied.' });
      return;
    }
    req.sessionUser = user;
    next();
  };
}

export function requireAdmin(req, res, next) {
  const user = getSessionUser(req);
  if (!user || user.role !== 'inorins') {
    res.status(403).json({ message: 'Access denied.' });
    return;
  }
  req.sessionUser = user;
  next();
}
