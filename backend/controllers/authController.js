const AuthService = require('../services/authService');

class AuthController {
  static async register(req, res, next) {
    try {
      const { name, email, password } = req.body;
      const data = await AuthService.register({ name, email, password });
      
      res.status(201).json({
        status: 'success',
        message: 'User registered successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const data = await AuthService.login({ email, password });

      res.status(200).json({
        status: 'success',
        message: 'User logged in successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getUsers(req, res, next) {
    try {
      const UserModel = require('../models/userModel');
      const users = await UserModel.getAll();
      res.status(200).json({
        status: 'success',
        data: { users },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getProfile(req, res, next) {
    try {
      res.status(200).json({
        status: 'success',
        data: {
          user: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            created_at: req.user.created_at,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
