const db = require('../config/db');

class UserModel {
  static async create({ name, email, password }) {
    const queryText = `
      INSERT INTO users (name, email, password)
      VALUES ($1, $2, $3)
      RETURNING id, name, email, created_at, updated_at
    `;
    const values = [name, email.toLowerCase().trim(), password];
    const { rows } = await db.query(queryText, values);
    return rows[0];
  }

  static async findByEmail(email) {
    const queryText = `
      SELECT id, name, email, password, created_at, updated_at
      FROM users
      WHERE email = $1
    `;
    const { rows } = await db.query(queryText, [email.toLowerCase().trim()]);
    return rows[0];
  }

  static async findById(id) {
    const queryText = `
      SELECT id, name, email, created_at, updated_at
      FROM users
      WHERE id = $1
    `;
    const { rows } = await db.query(queryText, [id]);
    return rows[0];
  }

  static async getAll() {
    const queryText = `
      SELECT id, name, email
      FROM users
      ORDER BY name ASC
    `;
    const { rows } = await db.query(queryText);
    return rows;
  }
}

module.exports = UserModel;
