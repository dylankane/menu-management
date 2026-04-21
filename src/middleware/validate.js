// src/middleware/validate.js
// Runs after express-validator rules and collects any errors.
// Returns a 422 with a structured errors array if anything is invalid.
// Usage: add validate as the last item in a route's middleware array.

const { validationResult } = require('express-validator');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      error: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

module.exports = { validate };
