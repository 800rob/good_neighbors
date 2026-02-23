const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const jwtConfig = require('../config/jwt');
const { COOKIE_NAME, COOKIE_OPTIONS } = require('../config/cookie');

const SALT_ROUNDS = 10;

/**
 * Register a new user
 * POST /api/auth/register
 */
async function register(req, res) {
  const {
    email,
    password,
    firstName,
    middleName,
    lastName,
    phoneNumber,
    address,
    address2,
    city,
    state,
    zipCode,
    latitude,
    longitude,
    neighborhood
  } = req.body;

  // Validate required name fields
  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'First name and last name are required' });
  }

  // Normalize email to lowercase
  const normalizedEmail = email.trim().toLowerCase();

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
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
      email: normalizedEmail,
      passwordHash,
      firstName,
      middleName: middleName || null,
      lastName,
      phoneNumber,
      address,
      address2,
      city,
      state,
      zipCode,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      neighborhood,
    },
  });

  // Generate JWT
  const token = jwt.sign({ userId: user.id }, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
  });

  // Build full name for display
  const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');

  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
  res.status(201).json({
    message: 'User registered successfully',
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      fullName,
      phoneNumber: user.phoneNumber,
      address: user.address,
      address2: user.address2,
      city: user.city,
      state: user.state,
      zipCode: user.zipCode,
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

  // Find user by email (normalize to lowercase)
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
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

  // Build full name for display
  const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');

  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
  res.json({
    message: 'Login successful',
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      fullName,
      phoneNumber: user.phoneNumber,
      address: user.address,
      address2: user.address2,
      city: user.city,
      state: user.state,
      zipCode: user.zipCode,
      neighborhood: user.neighborhood,
      latitude: user.latitude,
      longitude: user.longitude,
    },
  });
}

/**
 * Logout user (client-side token removal, server-side placeholder)
 * POST /api/auth/logout
 */
async function logout(req, res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ message: 'Logout successful' });
}

/**
 * Change password
 * PUT /api/auth/password
 */
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({
    where: { id: req.user.id },
    data: { passwordHash },
  });

  res.json({ message: 'Password changed successfully' });
}

module.exports = { register, login, logout, changePassword };
