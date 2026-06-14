const express = require('express');
const { query } = require('express-validator');
const DashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

router.use(authMiddleware);

const dashboardValidations = [
  query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
];

router.route('/')
  .get(validate(dashboardValidations), DashboardController.getDashboard);

module.exports = router;
