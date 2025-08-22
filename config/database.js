const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
const testConnection = async () => {
    try {
      const client = await pool.connect();
      console.log('✅ Connected to Neon PostgreSQL successfully');
      client.release();
    } catch (err) {
      console.error('❌ Database connection failed:', err);
    }
  };
  
  // Initialize database tables
  const initializeDatabase = async () => {
    try {
      await testConnection();
      
      // Create users table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          google_id VARCHAR(255) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          picture VARCHAR(500),
          google_access_token TEXT,
          google_refresh_token TEXT,
          google_meet_access BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
  
      // Create index for better performance
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      `);
  
      console.log('✅ Database tables initialized successfully');
    } catch (err) {
      console.error('❌ Database initialization failed:', err);
    }
  };
  
  module.exports = { pool, initializeDatabase };