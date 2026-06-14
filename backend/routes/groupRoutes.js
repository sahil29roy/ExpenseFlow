const express = require('express');
const { body, param } = require('express-validator');
const GroupController = require('../controllers/groupController');
const authMiddleware = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Apply auth middleware to all group endpoints
router.use(authMiddleware);

// Validations for creating or updating a group
const groupInputValidations = [
  body('name').trim().notEmpty().withMessage('Group name is required'),
];

// UUID validation helper for URL parameters
const uuidParamValidations = [
  param('id').isUUID().withMessage('Invalid group ID. Must be a valid UUID'),
];

router.route('/')
  .post(validate(groupInputValidations), GroupController.createGroup)
  .get(GroupController.getUserGroups);

router.route('/:id')
  .get(validate(uuidParamValidations), GroupController.getGroupDetails)
  .put(validate([...uuidParamValidations, ...groupInputValidations]), GroupController.updateGroup)
  .delete(validate(uuidParamValidations), GroupController.deleteGroup);

module.exports = router;
