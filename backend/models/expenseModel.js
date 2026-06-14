const db = require('../config/db');

class ExpenseModel {
  static async create({ description, totalAmount, paidBy, splitType, groupId }, client) {
    const queryExecutor = client || db;
    const queryText = `
      INSERT INTO expenses (description, total_amount, paid_by, split_type, group_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, description, total_amount, paid_by, split_type, group_id, created_at, updated_at
    `;
    const values = [description, totalAmount, paidBy, splitType.toUpperCase(), groupId || null];
    const { rows } = await queryExecutor.query(queryText, values);
    return rows[0];
  }

  static async findById(id, client) {
    const queryExecutor = client || db;
    const queryText = `
      SELECT id, description, total_amount, paid_by, split_type, created_at, updated_at
      FROM expenses
      WHERE id = $1
    `;
    const { rows } = await queryExecutor.query(queryText, [id]);
    return rows[0];
  }

  // Get all expenses paid by or split with a specific user with optional pagination
  static async getByUserId(userId, { limit, offset } = {}, client) {
    const queryExecutor = client || db;
    let queryText = `
      SELECT DISTINCT e.id, e.description, e.total_amount, e.paid_by, e.split_type, e.created_at
      FROM expenses e
      LEFT JOIN expense_splits s ON e.id = s.expense_id
      WHERE e.paid_by = $1 OR s.user_id = $1
      ORDER BY e.created_at DESC
    `;
    const values = [userId];
    if (limit !== undefined && offset !== undefined) {
      queryText += ` LIMIT $2 OFFSET $3`;
      values.push(limit, offset);
    }
    const { rows } = await queryExecutor.query(queryText, values);
    return rows;
  }
}

module.exports = ExpenseModel;
