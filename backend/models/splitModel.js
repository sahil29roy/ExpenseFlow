const db = require('../config/db');

class SplitModel {
  static async create({ expenseId, userId, amount, percentage }, client) {
    const queryExecutor = client || db;
    const queryText = `
      INSERT INTO expense_splits (expense_id, user_id, amount, percentage)
      VALUES ($1, $2, $3, $4)
      RETURNING id, expense_id, user_id, amount, percentage, created_at
    `;
    const values = [expenseId, userId, amount, percentage];
    const { rows } = await queryExecutor.query(queryText, values);
    return rows[0];
  }

  static async getByExpenseId(expenseId, client) {
    const queryExecutor = client || db;
    const queryText = `
      SELECT s.id, s.expense_id, s.user_id, u.name as user_name, u.email as user_email, s.amount, s.percentage, s.created_at
      FROM expense_splits s
      JOIN users u ON s.user_id = u.id
      WHERE s.expense_id = $1
    `;
    const { rows } = await queryExecutor.query(queryText, [expenseId]);
    return rows;
  }

  // Get all splits where the user owes money
  static async getSplitsForUser(userId, client) {
    const queryExecutor = client || db;
    const queryText = `
      SELECT s.id, s.expense_id, s.user_id, s.amount, s.percentage, e.paid_by, e.description, e.total_amount, e.created_at
      FROM expense_splits s
      JOIN expenses e ON s.expense_id = e.id
      WHERE s.user_id = $1
    `;
    const { rows } = await queryExecutor.query(queryText, [userId]);
    return rows;
  }
}

module.exports = SplitModel;
