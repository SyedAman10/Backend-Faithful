const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const initializeDatabase = async () => {
  try {
    // Test connection
    const client = await pool.connect();
    console.log('✅ Database connected successfully');

    // Create users table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        google_id VARCHAR(255) UNIQUE,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        picture TEXT,
        google_access_token TEXT,
        google_refresh_token TEXT,
        google_meet_access BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create user_sessions table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER NOT NULL,
        session_start TIMESTAMP NOT NULL,
        session_end TIMESTAMP,
        duration_seconds INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create user_usage_stats table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_usage_stats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL,
        total_time_seconds INTEGER DEFAULT 0,
        current_streak INTEGER DEFAULT 0,
        weekly_streak BOOLEAN[] DEFAULT ARRAY[false, false, false, false, false, false, false],
        last_updated TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create study_groups table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS study_groups (
        id SERIAL PRIMARY KEY,
        creator_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        theme VARCHAR(100),
        meet_link TEXT,
        meet_id VARCHAR(255),
        max_participants INTEGER DEFAULT 10,
        is_active BOOLEAN DEFAULT TRUE,
        scheduled_time TIMESTAMP,
        duration_minutes INTEGER DEFAULT 60,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Add recurring meeting columns to study_groups table if they don't exist
    try {
      await client.query(`
        ALTER TABLE study_groups 
        ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE
      `);
    } catch (error) {
      console.log('ℹ️ is_recurring column already exists or could not be added');
    }

    try {
      await client.query(`
        ALTER TABLE study_groups 
        ADD COLUMN IF NOT EXISTS recurrence_pattern VARCHAR(50)
      `);
    } catch (error) {
      console.log('ℹ️ recurrence_pattern column already exists or could not be added');
    }

    try {
      await client.query(`
        ALTER TABLE study_groups 
        ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER DEFAULT 1
      `);
    } catch (error) {
      console.log('ℹ️ recurrence_interval column already exists or could not be added');
    }

    try {
      await client.query(`
        ALTER TABLE study_groups 
        ADD COLUMN IF NOT EXISTS recurrence_days_of_week INTEGER[]
      `);
    } catch (error) {
      console.log('ℹ️ recurrence_days_of_week column already exists or could not be added');
    }

    try {
      await client.query(`
        ALTER TABLE study_groups 
        ADD COLUMN IF NOT EXISTS recurrence_end_date DATE
      `);
    } catch (error) {
      console.log('ℹ️ recurrence_end_date column already exists or could not be added');
    }

    try {
      await client.query(`
        ALTER TABLE study_groups 
        ADD COLUMN IF NOT EXISTS next_occurrence TIMESTAMP
      `);
    } catch (error) {
      console.log('ℹ️ next_occurrence column already exists or could not be added');
    }

    // Create recurring_meetings table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS recurring_meetings (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL,
        meeting_date TIMESTAMP NOT NULL,
        meet_link TEXT,
        meet_id VARCHAR(255),
        google_event_id VARCHAR(255),
        attendees_count INTEGER DEFAULT 0,
        is_cancelled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE
      )
    `);

    // Create study_group_members table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS study_group_members (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role VARCHAR(50) DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(group_id, user_id)
      )
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_created_at ON user_sessions(created_at)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_study_groups_creator_id ON study_groups(creator_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_study_groups_meet_id ON study_groups(meet_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_study_group_members_group_id ON study_group_members(group_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_study_group_members_user_id ON study_group_members(user_id)
    `);

    // Create indexes for recurring meetings (only after columns exist)
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_recurring_meetings_group_id ON recurring_meetings(group_id)
      `);
    } catch (error) {
      console.log('ℹ️ Could not create recurring_meetings_group_id index:', error.message);
    }

    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_recurring_meetings_meeting_date ON recurring_meetings(meeting_date)
      `);
    } catch (error) {
      console.log('ℹ️ Could not create recurring_meetings_meeting_date index:', error.message);
    }

    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_study_groups_recurring ON study_groups(is_recurring, next_occurrence)
      `);
    } catch (error) {
      console.log('ℹ️ Could not create study_groups_recurring index:', error.message);
    }

    // Create function to generate UUID if not exists (for older PostgreSQL versions)
    await client.query(`
      CREATE OR REPLACE FUNCTION gen_random_uuid()
      RETURNS uuid AS $$
      BEGIN
        RETURN uuid_generate_v4();
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Enable uuid-ossp extension if not exists
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp"
    `);

    console.log('✅ Database tables and indexes created successfully');
    client.release();
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
};

module.exports = { pool, initializeDatabase };