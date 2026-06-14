const ExpenseService = require('../services/expenseService');
const BalanceService = require('../services/balanceService');

class ExpenseController {
  static async createExpense(req, res, next) {
    try {
      const { description, totalAmount, paidBy, splitType, participants, groupId } = req.body;
      
      // Default paidBy to current logged-in user if not provided
      const payerId = paidBy || req.user.id;

      const expense = await ExpenseService.createExpense({
        description,
        totalAmount,
        paidBy: payerId,
        splitType,
        participants,
        groupId,
      });

      res.status(201).json({
        status: 'success',
        message: 'Expense created successfully',
        data: { expense },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getExpense(req, res, next) {
    try {
      const expenseId = req.params.id;
      const expense = await ExpenseService.getExpenseById(expenseId);

      res.status(200).json({
        status: 'success',
        data: { expense },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMyExpenses(req, res, next) {
    try {
      const userId = req.user.id;
      const { limit, page } = req.query;
      const result = await ExpenseService.getUserExpenses(userId, { limit, page });

      res.status(200).json({
        status: 'success',
        data: {
          expenses: result.expenses,
          pagination: result.pagination,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMyBalances(req, res, next) {
    try {
      const userId = req.user.id;
      const balances = await BalanceService.getUserBalances(userId);

      res.status(200).json({
        status: 'success',
        data: { balances },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSettlements(req, res, next) {
    try {
      const settlements = await BalanceService.getGlobalSettlements();

      res.status(200).json({
        status: 'success',
        data: { settlements },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ExpenseController;
