const db = require('../config/db');

class SettlementModel {
  static async create({ groupId, payerId, payeeId, amount }, client) {
    const queryExecutor = client || db;
    const queryText = `
      INSERT INTO settlements (group_id, payer_id, payee_id, amount)
      VALUES ($1, $2, $3, $4)
      RETURNING id, group_id, payer_id, payee_id, amount, settled_at
    `;
    const { rows } = await queryExecutor.query(queryText, [groupId || null, payerId, payeeId, amount]);
    return rows[0];
  }

  static async getByGroupId(groupId, client) {
    const queryExecutor = client || db;
    const queryText = `
      SELECT s.id, s.group_id, s.payer_id, p.name as payer_name, s.payee_id, r.name as payee_name, s.amount, s.settled_at
      FROM settlements s
      JOIN users p ON s.payer_id = p.id
      JOIN users r ON s.payee_id = r.id
      WHERE s.group_id = $1
      ORDER BY s.settled_at DESC
    `;
    const { rows } = await queryExecutor.query(queryText, [groupId]);
    return rows;
  }

  static async getByUserId(userId, client) {
    const queryExecutor = client || db;
    const queryText = `
      SELECT s.id, s.group_id, s.payer_id, p.name as payer_name, s.payee_id, r.name as payee_name, s.amount, s.settled_at
      FROM settlements s
      JOIN users p ON s.payer_id = p.id
      JOIN users r ON s.payee_id = r.id
      WHERE s.payer_id = $1 OR s.payee_id = $1
      ORDER BY s.settled_at DESC
    `;
    const { rows } = await queryExecutor.query(queryText, [userId]);
    return rows;
  }
}

module.exports = SettlementModel;
