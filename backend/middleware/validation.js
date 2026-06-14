const { validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errors');

const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const formattedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));

    next(new ValidationError('Validation failed', formattedErrors));
  };
};

module.exports = {
  validate,
};
