const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const prisma = require('../config/database');

/**
 * Middleware to verify JWT token and attach user to request
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

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
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
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
