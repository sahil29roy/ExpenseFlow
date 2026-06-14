const express = require('express');
const { body } = require('express-validator');
const AuthController = require('../controllers/authController');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Register route validations
const registerValidations = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Provide a valid email address').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
];

// Login route validations
const loginValidations = [
  body('email').isEmail().withMessage('Provide a valid email address').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const authMiddleware = require('../middleware/auth');

router.post('/register', validate(registerValidations), AuthController.register);
router.post('/login', validate(loginValidations), AuthController.login);

router.get('/profile', authMiddleware, AuthController.getProfile);
router.get('/users', authMiddleware, AuthController.getUsers);

module.exports = router;
