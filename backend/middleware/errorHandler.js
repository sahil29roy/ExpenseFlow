const { AppError } = require('../utils/errors');

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log non-operational (server level) errors to the console
  if (!err.isOperational) {
    console.error('SERVER ERROR 🔥:', err);
  }

  // Development VS Production responses
  if (process.env.NODE_ENV === 'development') {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      errors: err.errors || undefined,
      stack: err.stack,
      error: err,
    });
  } else {
    // Production response
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
        errors: err.errors || undefined,
      });
    }

    // Generic response for programming or other unknown errors: don't leak details
    return res.status(500).json({
      status: 'error',
      message: 'Something went wrong on our end!',
    });
  }
};
