const express = require('express');
const { body, param } = require('express-validator');
const SettlementController = require('../controllers/settlementController');
const authMiddleware = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Enforce auth to all settlement routes
router.use(authMiddleware);

// Validations for recording a settlement
const createSettlementValidations = [
  body('payeeId').isUUID().withMessage('payeeId must be a valid UUID'),
  body('amount').isFloat({ gt: 0 }).withMessage('Settlement amount must be a float greater than 0'),
  body('groupId').optional({ nullable: true, checkFalsy: true }).isUUID().withMessage('groupId must be a valid UUID'),
  body('payerId').optional().isUUID().withMessage('payerId must be a valid UUID'),
];

router.route('/')
  .post(validate(createSettlementValidations), SettlementController.recordSettlement)
  .get(SettlementController.getMySettlements);

router.route('/group/:groupId')
  .get(validate([
    param('groupId').isUUID().withMessage('groupId parameter must be a valid UUID')
  ]), SettlementController.getGroupSettlements);

module.exports = router;
