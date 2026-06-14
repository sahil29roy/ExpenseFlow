const { pool } = require('../config/db');
const ExpenseModel = require('../models/expenseModel');
const SplitModel = require('../models/splitModel');
const SplitService = require('./splitService');
const UserModel = require('../models/userModel');
const { NotFoundError, ValidationError } = require('../utils/errors');

class ExpenseService {
  static async createExpense({ description, totalAmount, paidBy, splitType, participants, groupId }) {
    // 1. Validate and calculate splits using the SplitService
    let calculatedSplits = [];
    const calcArgs = { totalAmount, participants };

    switch (splitType.toUpperCase()) {
      case 'EQUAL':
        calculatedSplits = SplitService.calculateEqualSplit(calcArgs);
        break;
      case 'EXACT':
      case 'UNEQUAL':
        calculatedSplits = SplitService.calculateUnequalSplit(calcArgs);
        break;
      case 'PERCENTAGE':
        calculatedSplits = SplitService.calculatePercentageSplit(calcArgs);
        break;
      default:
        throw new ValidationError(`Invalid split type: ${splitType}. Must be EQUAL, UNEQUAL, EXACT, or PERCENTAGE.`);
    }

    // 2. Perform DB operations inside a secure Transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify that the paid_by user exists
      const payer = await UserModel.findById(paidBy);
      if (!payer) {
        throw new NotFoundError(`Paying user with ID ${paidBy} not found`);
      }

      // Verify all participants exist
      for (const split of calculatedSplits) {
        const participant = await UserModel.findById(split.userId);
        if (!participant) {
          throw new NotFoundError(`Participant user with ID ${split.userId} not found`);
        }
      }

      // If groupId is provided, validate group existence and memberships
      if (groupId) {
        const GroupModel = require('../models/groupModel');
        const { ForbiddenError } = require('../utils/errors');

        // Check group exists
        const group = await GroupModel.findById(groupId, client);
        if (!group) {
          throw new NotFoundError(`Group with ID ${groupId} not found`);
        }

        // Check if payer is a member of the group
        const isPayerMember = await GroupModel.isMember(groupId, paidBy, client);
        if (!isPayerMember) {
          throw new ForbiddenError('The paying user is not a member of this group');
        }

        // Check if all split participants are members of the group
        for (const split of calculatedSplits) {
          const isMember = await GroupModel.isMember(groupId, split.userId, client);
          if (!isMember) {
            throw new ForbiddenError(`Participant ${split.userId} is not a member of this group`);
          }
        }
      }

      // Create the core expense
      const expense = await ExpenseModel.create({
        description,
        totalAmount,
        paidBy,
        splitType,
        groupId,
      }, client);

      // Create each split
      const savedSplits = [];
      for (const split of calculatedSplits) {
        const savedSplit = await SplitModel.create({
          expenseId: expense.id,
          userId: split.userId,
          amount: split.amount,
          percentage: split.percentage,
        }, client);
        savedSplits.push(savedSplit);
      }

      await client.query('COMMIT');

      return {
        ...expense,
        splits: savedSplits,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async getExpenseById(expenseId) {
    const expense = await ExpenseModel.findById(expenseId);
    if (!expense) {
      throw new NotFoundError(`Expense with ID ${expenseId} not found`);
    }

    const splits = await SplitModel.getByExpenseId(expenseId);
    return {
      ...expense,
      splits,
    };
  }

  static async getUserExpenses(userId) {
    const expenses = await ExpenseModel.getByUserId(userId);
    const results = [];

    for (const exp of expenses) {
      const splits = await SplitModel.getByExpenseId(exp.id);
      results.push({
        ...exp,
        splits,
      });
    }

    return results;
  }
}

module.exports = ExpenseService;
