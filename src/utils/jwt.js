// src/utils/jwt.js
// Thin wrappers around jsonwebtoken so the secret and options
// are only configured in one place.

const jwt = require('jsonwebtoken');

const SECRET  = process.env.JWT_SECRET;
const EXPIRES = process.env.JWT_EXPIRES_IN || '8h';

function signToken(payload) {
  if (!SECRET) throw new Error('JWT_SECRET is not set in environment variables');
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES });
}

function verifyToken(token) {
  if (!SECRET) throw new Error('JWT_SECRET is not set in environment variables');
  return jwt.verify(token, SECRET); // throws if invalid or expired
}

module.exports = { signToken, verifyToken };
