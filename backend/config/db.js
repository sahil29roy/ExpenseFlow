const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// PostgreSQL connection config using environment variables
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_DATABASE || 'expense_sharing',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

const createDatabaseIfNotExists = async () => {
  const targetDb = process.env.DB_DATABASE || 'expense_sharing';
  
  // Validate database name to prevent sql injection
  if (!/^[a-zA-Z0-9_-]+$/.test(targetDb)) {
    throw new Error(`Invalid database name in configuration: ${targetDb}`);
  }

  const adminPool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: 'postgres', // connect to default admin database
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432', 10),
  });

  let client;
  try {
    client = await adminPool.connect();
    const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDb]);
    if (res.rowCount === 0) {
      console.log(`Database "${targetDb}" does not exist. Creating database...`);
      await client.query(`CREATE DATABASE ${targetDb}`);
      console.log(`Database "${targetDb}" created successfully.`);
    }
  } catch (err) {
    console.error('Error checking/creating database:', err.message);
    throw err;
  } finally {
    if (client) client.release();
    await adminPool.end();
  }
};

// Verify connection and run tables schema initialization
const initializeDatabase = async () => {
  let client;
  try {
    // 1. Auto-create database if missing
    await createDatabaseIfNotExists();

    // 2. Establish connection to the target database
    client = await pool.connect();
    console.log('Successfully connected to the PostgreSQL database.');

    // 3. Automatically check and run schema if tables don't exist
    const schemaPath = path.join(__dirname, '../schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await client.query(schemaSql);
      console.log('Database tables verified/initialized successfully.');
    } else {
      console.warn('Warning: schema.sql file not found. Skipping auto-table initialization.');
    }
  } catch (err) {
    console.error('Database connection error during initialization:', err.message);
    throw err;
  } finally {
    if (client) client.release();
  }
};

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  initializeDatabase,
};

