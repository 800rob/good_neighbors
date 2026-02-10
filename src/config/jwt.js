if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

module.exports = {
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
};
