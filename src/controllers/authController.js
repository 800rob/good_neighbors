const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const jwtConfig = require('../config/jwt');

const SALT_ROUNDS = 10;

/**
 * Register a new user
 * POST /api/auth/register
 */
async function register(req, res) {
  const { email, password, fullName, phoneNumber, address, latitude, longitude, neighborhood } = req.body;

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  // Check if phone number already exists (if provided)
  if (phoneNumber) {
    const existingPhone = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (existingPhone) {
      return res.status(409).json({ error: 'Phone number already registered' });
    }
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      phoneNumber,
      address,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      neighborhood,
    },
  });

  // Generate JWT
  const token = jwt.sign({ userId: user.id }, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
  });

  res.status(201).json({
    message: 'User registered successfully',
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      neighborhood: user.neighborhood,
    },
  });
}

/**
 * Login user
 * POST /api/auth/login
 */
async function login(req, res) {
  const { email, password } = req.body;

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.passwordHash);

  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Generate JWT
  const token = jwt.sign({ userId: user.id }, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
  });

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      neighborhood: user.neighborhood,
    },
  });
}

/**
 * Logout user (client-side token removal, server-side placeholder)
 * POST /api/auth/logout
 */
async function logout(req, res) {
  // In a production app, you might want to:
  // - Add token to a blacklist
  // - Clear refresh tokens from database
  // For now, logout is handled client-side by removing the token
  res.json({ message: 'Logout successful' });
}

module.exports = { register, login, logout };
