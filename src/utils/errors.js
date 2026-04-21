// src/utils/errors.js
// Custom error class that carries an HTTP status code.
// Throw this anywhere in a controller and the global error handler in
// server.js will pick it up and send the right response.

class AppError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
    this.name = 'AppError';
  }
}

module.exports = { AppError };
