const jwtConfig = require('./jwt');

// Parse JWT expiresIn (e.g. "24h", "7d") to milliseconds for cookie maxAge
function parseExpiresIn(expiresIn) {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return 24 * 60 * 60 * 1000; // default 24h
  const value = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}

const isProduction = process.env.NODE_ENV === 'production';

const COOKIE_NAME = 'token';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'strict' : 'lax',
  maxAge: parseExpiresIn(jwtConfig.expiresIn),
  path: '/',
};

module.exports = { COOKIE_NAME, COOKIE_OPTIONS };
