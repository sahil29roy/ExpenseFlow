const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../utils/errors');
const UserModel = require('../models/userModel');

module.exports = async (req, res, next) => {
  try {
    let token;
    // Extract token from header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new UnauthorizedError('Please log in to get access.'));
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_please_change_in_production');

    // Check if user still exists
    const currentUser = await UserModel.findById(decoded.id);
    if (!currentUser) {
      return next(
        new UnauthorizedError('The user belonging to this token no longer exists.')
      );
    }

    // Grant access
    req.user = currentUser;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new UnauthorizedError('Invalid token. Please log in again.'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Your token has expired. Please log in again.'));
    }
    next(error);
  }
};
