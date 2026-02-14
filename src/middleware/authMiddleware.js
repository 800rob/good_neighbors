const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const prisma = require('../config/database');
const { COOKIE_NAME } = require('../config/cookie');

/**
 * Extract JWT token from cookie or Authorization header.
 * Cookie takes precedence; header is kept for backward compatibility.
 */
function extractToken(req) {
  // 1. Try HTTP-only cookie
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }
  // 2. Fall back to Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return null;
}

/**
 * Middleware to verify JWT token and attach user to request
 */
async function authenticate(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, jwtConfig.secret);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Optional authentication - attaches user if token present, continues if not
 */
async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, jwtConfig.secret);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (user) {
      req.user = user;
    }

    next();
  } catch (error) {
    // Token present but invalid — log for debugging, continue without user
    console.warn(`[optionalAuth] Invalid token ignored: ${error.name} — ${error.message}`);
    next();
  }
}

module.exports = { authenticate, optionalAuth };
