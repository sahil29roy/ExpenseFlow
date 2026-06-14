const db = require('../config/db');

class GroupModel {
  static async create({ name, description, createdBy }, client) {
    const queryExecutor = client || db;
    const queryText = `
      INSERT INTO groups (name, description, created_by)
      VALUES ($1, $2, $3)
      RETURNING id, name, description, created_by, created_at, updated_at
    `;
    const { rows } = await queryExecutor.query(queryText, [name, description || null, createdBy]);
    return rows[0];
  }

  static async update(id, { name, description }) {
    const queryText = `
      UPDATE groups
      SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, name, description, created_by, created_at, updated_at
    `;
    const { rows } = await db.query(queryText, [name, description || null, id]);
    return rows[0];
  }

  static async delete(id) {
    const queryText = `
      DELETE FROM groups
      WHERE id = $1
      RETURNING id
    `;
    const { rows } = await db.query(queryText, [id]);
    return rows[0];
  }

  static async findById(id) {
    const queryText = `
      SELECT id, name, description, created_by, created_at, updated_at
      FROM groups
      WHERE id = $1
    `;
    const { rows } = await db.query(queryText, [id]);
    return rows[0];
  }

  // Get all groups where user is a member
  static async findByUserId(userId) {
    const queryText = `
      SELECT g.id, g.name, g.description, g.created_by, g.created_at, g.updated_at, m.joined_at
      FROM groups g
      JOIN group_members m ON g.id = m.group_id
      WHERE m.user_id = $1
      ORDER BY g.created_at DESC
    `;
    const { rows } = await db.query(queryText, [userId]);
    return rows;
  }

  // Add member to group_members table
  static async addMember(groupId, userId, client) {
    const queryExecutor = client || db;
    const queryText = `
      INSERT INTO group_members (group_id, user_id)
      VALUES ($1, $2)
      RETURNING group_id, user_id, joined_at
    `;
    const { rows } = await queryExecutor.query(queryText, [groupId, userId]);
    return rows[0];
  }

  // Get all members of a group
  static async getMembers(groupId) {
    const queryText = `
      SELECT u.id, u.name, u.email, m.joined_at
      FROM users u
      JOIN group_members m ON u.id = m.user_id
      WHERE m.group_id = $1
      ORDER BY u.name ASC
    `;
    const { rows } = await db.query(queryText, [groupId]);
    return rows;
  }
}

module.exports = GroupModel;
