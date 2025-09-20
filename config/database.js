const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Ensure timezone is set to UTC to prevent automatic timezone conversion
  options: '-c timezone=UTC'
});

const initializeDatabase = async () => {
  try {
    // Test connection
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    
    // Set timezone to UTC to prevent automatic timezone conversion
    await client.query('SET timezone = UTC');
    console.log('✅ Database timezone set to UTC');
    
    // Verify timezone setting
    const timezoneResult = await client.query('SHOW timezone');
    console.log('🌍 Database timezone verification:', timezoneResult.rows[0]);

    // Migrate timestamp columns to TEXT to avoid timezone conversion issues
    try {
      await client.query(`
        ALTER TABLE study_groups 
        ALTER COLUMN scheduled_time TYPE TEXT
      `);
      console.log('✅ Migrated scheduled_time to TEXT');
    } catch (error) {
      console.log('ℹ️ scheduled_time column migration:', error.message);
    }

    try {
      await client.query(`
        ALTER TABLE study_groups 
        ALTER COLUMN next_occurrence TYPE TEXT
      `);
      console.log('✅ Migrated next_occurrence to TEXT');
    } catch (error) {
      console.log('ℹ️ next_occurrence column migration:', error.message);
    }

    try {
      await client.query(`
        ALTER TABLE study_groups 
        ALTER COLUMN recurrence_end_date TYPE TEXT
      `);
      console.log('✅ Migrated recurrence_end_date to TEXT');
    } catch (error) {
      console.log('ℹ️ recurrence_end_date column migration:', error.message);
    }

    // Add local time columns for easy access
    try {
      await client.query(`
        ALTER TABLE study_groups 
        ADD COLUMN IF NOT EXISTS scheduled_time_local TEXT
      `);
      console.log('✅ Added scheduled_time_local column');
    } catch (error) {
      console.log('ℹ️ scheduled_time_local column:', error.message);
    }

    try {
      await client.query(`
        ALTER TABLE study_groups 
        ADD COLUMN IF NOT EXISTS next_occurrence_local TEXT
      `);
      console.log('✅ Added next_occurrence_local column');
    } catch (error) {
      console.log('ℹ️ next_occurrence_local column:', error.message);
    }

    try {
      await client.query(`
        ALTER TABLE study_groups 
        ADD COLUMN IF NOT EXISTS recurrence_end_date_local TEXT
      `);
      console.log('✅ Added recurrence_end_date_local column');
    } catch (error) {
      console.log('ℹ️ recurrence_end_date_local column:', error.message);
    }

    try {
      await client.query(`
        ALTER TABLE study_groups 
        ADD COLUMN IF NOT EXISTS timezone TEXT
      `);
      console.log('✅ Added timezone column');
    } catch (error) {
      console.log('ℹ️ timezone column:', error.message);
    }

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
        denomination VARCHAR(100),
        bible_version VARCHAR(50),
        age_group VARCHAR(20),
        referral_source VARCHAR(100),
        bible_answers TEXT,
        bible_specific TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add new columns to users table if they don't exist
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS denomination VARCHAR(100),
      ADD COLUMN IF NOT EXISTS bible_version VARCHAR(50),
      ADD COLUMN IF NOT EXISTS age_group VARCHAR(20),
      ADD COLUMN IF NOT EXISTS referral_source VARCHAR(100),
      ADD COLUMN IF NOT EXISTS bible_answers TEXT,
      ADD COLUMN IF NOT EXISTS bible_specific TEXT,
      ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE
    `);

    // Add parent_response_id column to prayer_responses table if it doesn't exist
    await client.query(`
      ALTER TABLE prayer_responses 
      ADD COLUMN IF NOT EXISTS parent_response_id INTEGER
    `);

    // Add foreign key constraint if it doesn't exist
    try {
      await client.query(`
        ALTER TABLE prayer_responses 
        ADD CONSTRAINT fk_prayer_responses_parent 
        FOREIGN KEY (parent_response_id) REFERENCES prayer_responses(id) ON DELETE CASCADE
      `);
    } catch (error) {
      // Constraint might already exist, ignore the error
      if (error.code !== '42710') { // 42710 = duplicate_object
        throw error;
      }
    }

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

    try {
      await client.query(`
        ALTER TABLE study_groups 
        ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT TRUE
      `);
    } catch (error) {
      console.log('ℹ️ requires_approval column already exists or could not be added');
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

    // Create study_group_join_requests table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS study_group_join_requests (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
        message TEXT, -- Optional message from requester
        requested_at TIMESTAMP DEFAULT NOW(),
        responded_at TIMESTAMP,
        responded_by INTEGER, -- User ID who responded (group owner/admin)
        FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (responded_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(group_id, user_id) -- One request per user per group
      )
    `);

    // Create user_prayer_history table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_prayer_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        version VARCHAR(50) NOT NULL,
        book VARCHAR(100) NOT NULL,
        chapter INTEGER NOT NULL,
        verse INTEGER NOT NULL,
        text TEXT NOT NULL,
        reference VARCHAR(200) NOT NULL,
        category VARCHAR(100),
        prayed_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, version, book, chapter, verse) -- One prayer per verse per user
      )
    `);

    // Create user_reflection_history table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_reflection_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        version VARCHAR(50) NOT NULL,
        book VARCHAR(100) NOT NULL,
        chapter INTEGER NOT NULL,
        verse INTEGER NOT NULL,
        text TEXT NOT NULL,
        reference VARCHAR(200) NOT NULL,
        theme VARCHAR(100) NOT NULL,
        reflection_prompt TEXT NOT NULL,
        reflection_questions TEXT[] NOT NULL,
        reflected_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, version, book, chapter, verse, theme) -- One reflection per verse per theme per user
      )
    `);

    // Create user_weekly_study_plans table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_weekly_study_plans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        plan_id VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        content TEXT NOT NULL,
        week_start_date DATE NOT NULL,
        week_end_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, week_start_date) -- One plan per user per week
      )
    `);

    // Create user_prayer_notes table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_prayer_notes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(100),
        tags TEXT[],
        is_private BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create user_daily_activities table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_daily_activities (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        activity_date DATE NOT NULL,
        verses_read INTEGER DEFAULT 0,
        prayers_said INTEGER DEFAULT 0,
        reflections_completed INTEGER DEFAULT 0,
        study_hours DECIMAL(4,2) DEFAULT 0.00,
        notes_created INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, activity_date) -- One record per user per day
      )
    `);

    // Create prayer_requests table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS prayer_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'General',
        is_anonymous BOOLEAN DEFAULT FALSE,
        is_urgent BOOLEAN DEFAULT FALSE,
        is_public BOOLEAN DEFAULT TRUE,
        prayer_count INTEGER DEFAULT 0,
        response_count INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create prayer_responses table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS prayer_responses (
        id SERIAL PRIMARY KEY,
        prayer_request_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        parent_response_id INTEGER,
        response_type VARCHAR(20) DEFAULT 'prayer',
        message TEXT,
        is_anonymous BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (prayer_request_id) REFERENCES prayer_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_response_id) REFERENCES prayer_responses(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)
    `);

    // Prayer requests indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_prayer_requests_user_id ON prayer_requests(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_prayer_requests_status ON prayer_requests(status)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_prayer_requests_category ON prayer_requests(category)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_prayer_requests_public ON prayer_requests(is_public)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_prayer_requests_created_at ON prayer_requests(created_at DESC)
    `);

    // Prayer responses indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_prayer_responses_prayer_id ON prayer_responses(prayer_request_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_prayer_responses_user_id ON prayer_responses(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_prayer_responses_type ON prayer_responses(response_type)
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

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_study_group_join_requests_group_id ON study_group_join_requests(group_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_study_group_join_requests_user_id ON study_group_join_requests(user_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_study_group_join_requests_status ON study_group_join_requests(status)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_prayer_history_user_id ON user_prayer_history(user_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_prayer_history_prayed_at ON user_prayer_history(prayed_at)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_reflection_history_user_id ON user_reflection_history(user_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_reflection_history_reflected_at ON user_reflection_history(reflected_at)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_reflection_history_theme ON user_reflection_history(theme)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_weekly_study_plans_user_id ON user_weekly_study_plans(user_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_weekly_study_plans_week_start ON user_weekly_study_plans(week_start_date)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_prayer_notes_user_id ON user_prayer_notes(user_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_prayer_notes_created_at ON user_prayer_notes(created_at)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_prayer_notes_category ON user_prayer_notes(category)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_daily_activities_user_id ON user_daily_activities(user_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_daily_activities_date ON user_daily_activities(activity_date)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_daily_activities_user_date ON user_daily_activities(user_id, activity_date)
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