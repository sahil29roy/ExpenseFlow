const express = require('express');
const { body } = require('express-validator');
const ExpenseController = require('../controllers/expenseController');
const authMiddleware = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Apply auth middleware to all expense routes
router.use(authMiddleware);

// Validations for creating an expense
const createExpenseValidations = [
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('totalAmount').isFloat({ gt: 0 }).withMessage('Total amount must be a number greater than 0'),
  body('splitType')
    .toUpperCase()
    .isIn(['EQUAL', 'EXACT', 'PERCENTAGE'])
    .withMessage('Split type must be EQUAL, EXACT, or PERCENTAGE'),
  body('participants')
    .isArray({ min: 1 })
    .withMessage('Participants must be a non-empty array')
    .custom((participants, { req }) => {
      const splitType = req.body.splitType ? req.body.splitType.toUpperCase() : '';
      
      for (const p of participants) {
        if (!p.userId || !Number.isInteger(p.userId)) {
          throw new Error('Each participant must have a valid integer userId');
        }

        if (splitType === 'EXACT') {
          if (p.amount === undefined || isNaN(Number(p.amount)) || Number(p.amount) < 0) {
            throw new Error('For EXACT split, each participant must have a non-negative numeric amount');
          }
        }

        if (splitType === 'PERCENTAGE') {
          if (p.percentage === undefined || isNaN(Number(p.percentage)) || Number(p.percentage) < 0 || Number(p.percentage) > 100) {
            throw new Error('For PERCENTAGE split, each participant must have a percentage between 0 and 100');
          }
        }
      }
      return true;
    }),
];

router.route('/')
  .post(validate(createExpenseValidations), ExpenseController.createExpense)
  .get(ExpenseController.getMyExpenses);

router.route('/balances')
  .get(ExpenseController.getMyBalances);

router.route('/settlements')
  .get(ExpenseController.getSettlements);

router.route('/:id')
  .get(ExpenseController.getExpense);

module.exports = router;
