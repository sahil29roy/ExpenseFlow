const { pool } = require('../config/db');
const ExpenseModel = require('../models/expenseModel');
const SplitModel = require('../models/splitModel');
const SplitService = require('./splitService');
const UserModel = require('../models/userModel');
const { NotFoundError, ValidationError } = require('../utils/errors');

class ExpenseService {
  static async createExpense({ description, totalAmount, paidBy, splitType, participants, groupId }, externalClient) {
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
    const client = externalClient || await pool.connect();
    const shouldManageTransaction = !externalClient;

    try {
      if (shouldManageTransaction) {
        await client.query('BEGIN');
      }

      // Verify that the paid_by user exists
      const payer = await UserModel.findById(paidBy, client);
      if (!payer) {
        throw new NotFoundError(`Paying user with ID ${paidBy} not found`);
      }

      // Verify all participants exist
      for (const split of calculatedSplits) {
        const participant = await UserModel.findById(split.userId, client);
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

      if (shouldManageTransaction) {
        await client.query('COMMIT');
      }

      return {
        ...expense,
        splits: savedSplits,
      };
    } catch (err) {
      if (shouldManageTransaction) {
        await client.query('ROLLBACK');
      }
      throw err;
    } finally {
      if (shouldManageTransaction) {
        client.release();
      }
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

  static async getUserExpenses(userId, { limit = 10, page = 1 } = {}) {
    const parsedLimit = parseInt(limit, 10) || 10;
    const parsedPage = parseInt(page, 10) || 1;
    const offset = (parsedPage - 1) * parsedLimit;

    // Get count of expenses involving user
    const countQuery = `
      SELECT COUNT(DISTINCT e.id) AS count
      FROM expenses e
      LEFT JOIN expense_splits s ON e.id = s.expense_id
      WHERE e.paid_by = $1 OR s.user_id = $1
    `;
    const countRes = await pool.query(countQuery, [userId]);
    const totalExpenses = parseInt(countRes.rows[0].count, 10);

    const expenses = await ExpenseModel.getByUserId(userId, { limit: parsedLimit, offset });
    const results = [];

    for (const exp of expenses) {
      const splits = await SplitModel.getByExpenseId(exp.id);
      results.push({
        ...exp,
        splits,
      });
    }

    const totalPages = Math.ceil(totalExpenses / parsedLimit);

    return {
      expenses: results,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        totalExpenses,
        totalPages,
        hasNextPage: parsedPage < totalPages,
        hasPrevPage: parsedPage > 1
      }
    };
  }
}

module.exports = ExpenseService;
