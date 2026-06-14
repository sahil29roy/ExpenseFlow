const { AppError, ConflictError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.stack = err.stack;

  // Handle PostgreSQL database errors
  if (err.code === '23505') {
    const detail = err.detail || '';
    const match = detail.match(/\((.*?)\)=\((.*?)\)/);
    const message = match 
      ? `Duplicate value: '${match[2]}' for field '${match[1]}' already exists.`
      : 'Resource already exists with this key.';
    error = new ConflictError(message);
  } else if (err.code === '23503') {
    const detail = err.detail || '';
    const message = `Invalid reference constraint: ${detail}`;
    error = new ValidationError(message);
  } else if (err.code === '23514') {
    const message = `Invalid data value: constraint check failed (${err.constraint || 'check constraint'}).`;
    error = new ValidationError(message);
  } else if (err.code === '22P02') {
    const message = `Malformed request input syntax: ${err.message}`;
    error = new ValidationError(message);
  }

  error.statusCode = error.statusCode || 500;
  error.status = error.status || 'error';

  // Log non-operational (server level) or internal errors
  if (error.statusCode >= 500) {
    logger.error('Unhandled System Error:', error);
  } else {
    logger.warn(`Operational Fail (${error.statusCode}): ${error.message}`);
  }

  // Development VS Production responses
  if (process.env.NODE_ENV === 'development') {
    return res.status(error.statusCode).json({
      status: error.status,
      message: error.message,
      errors: error.errors || undefined,
      stack: error.stack,
      error: error,
    });
  } else {
    // Production response
    if (error.isOperational) {
      return res.status(error.statusCode).json({
        status: error.status,
        message: error.message,
        errors: error.errors || undefined,
      });
    }

    // Generic response for programming or other unknown errors: don't leak details
    return res.status(500).json({
      status: 'error',
      message: 'Something went wrong on our end!',
    });
  }
};
