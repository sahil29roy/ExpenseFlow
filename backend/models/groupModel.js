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

  static async update(id, { name, description }, client) {
    const queryExecutor = client || db;
    const queryText = `
      UPDATE groups
      SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, name, description, created_by, created_at, updated_at
    `;
    const { rows } = await queryExecutor.query(queryText, [name, description || null, id]);
    return rows[0];
  }

  static async delete(id, client) {
    const queryExecutor = client || db;
    const queryText = `
      DELETE FROM groups
      WHERE id = $1
      RETURNING id
    `;
    const { rows } = await queryExecutor.query(queryText, [id]);
    return rows[0];
  }

  static async findById(id, client) {
    const queryExecutor = client || db;
    const queryText = `
      SELECT id, name, description, created_by, created_at, updated_at
      FROM groups
      WHERE id = $1
    `;
    const { rows } = await queryExecutor.query(queryText, [id]);
    return rows[0];
  }

  // Get all groups where user is a member with optional pagination
  static async findByUserId(userId, { limit, offset } = {}, client) {
    const queryExecutor = client || db;
    let queryText = `
      SELECT g.id, g.name, g.description, g.created_by, g.created_at, g.updated_at, m.joined_at
      FROM groups g
      JOIN group_members m ON g.id = m.group_id
      WHERE m.user_id = $1
      ORDER BY g.created_at DESC
    `;
    const values = [userId];
    if (limit !== undefined && offset !== undefined) {
      queryText += ` LIMIT $2 OFFSET $3`;
      values.push(limit, offset);
    }
    const { rows } = await queryExecutor.query(queryText, values);
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

  // Remove member from group_members table
  static async removeMember(groupId, userId, client) {
    const queryExecutor = client || db;
    const queryText = `
      DELETE FROM group_members
      WHERE group_id = $1 AND user_id = $2
      RETURNING group_id, user_id
    `;
    const { rows } = await queryExecutor.query(queryText, [groupId, userId]);
    return rows[0];
  }

  // Check if a user is a member of a group
  static async isMember(groupId, userId, client) {
    const queryExecutor = client || db;
    const queryText = `
      SELECT 1 FROM group_members
      WHERE group_id = $1 AND user_id = $2
    `;
    const { rows } = await queryExecutor.query(queryText, [groupId, userId]);
    return rows.length > 0;
  }

  // Get all members of a group
  static async getMembers(groupId, client) {
    const queryExecutor = client || db;
    const queryText = `
      SELECT u.id, u.name, u.email, m.joined_at
      FROM users u
      JOIN group_members m ON u.id = m.user_id
      WHERE m.group_id = $1
      ORDER BY u.name ASC
    `;
    const { rows } = await queryExecutor.query(queryText, [groupId]);
    return rows;
  }
}

module.exports = GroupModel;
