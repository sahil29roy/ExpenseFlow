const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/userModel');
const { ConflictError, UnauthorizedError } = require('../utils/errors');

class AuthService {
  static generateToken(userId) {
    return jwt.sign(
      { id: userId },
      process.env.JWT_SECRET || 'super_secret_jwt_key_please_change_in_production',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
  }

  static async register({ name, email, password }) {
    // Check if user already exists
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      throw new ConflictError('Email already in use.');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user in DB
    const newUser = await UserModel.create({
      name,
      email,
      password: hashedPassword,
    });

    // Generate JWT
    const token = this.generateToken(newUser.id);

    return {
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
      },
      token,
    };
  }

  static async login({ email, password }) {
    // Check if user exists
    const user = await UserModel.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    // Verify password
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    // Generate JWT
    const token = this.generateToken(user.id);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      token,
    };
  }
}

module.exports = AuthService;
