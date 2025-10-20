const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runEngagementMigration() {
  console.log('🚀 Starting User Engagement Tracking migration...\n');
  
  let client;
  try {
    // Get a client from the pool
    client = await pool.connect();
    console.log('✅ Connected to Neon database\n');

    // Begin transaction
    await client.query('BEGIN');
    console.log('📦 Transaction started\n');

    console.log('📋 Creating/Updating user_usage_stats table...');
    
    // Check if table exists
    const tableCheck = await client.query(`
      SELECT to_regclass('public.user_usage_stats') AS table_exists
    `);
    
    if (tableCheck.rows[0].table_exists) {
      console.log('ℹ️  Table user_usage_stats already exists, adding missing columns...');
      
      // Add missing columns if they don't exist
      try {
        await client.query(`
          ALTER TABLE user_usage_stats 
          ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS today_time_spent INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS average_session_duration INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMP,
          ADD COLUMN IF NOT EXISTS recent_sessions JSONB DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        `);
        console.log('✅ Missing columns added to user_usage_stats\n');
      } catch (alterError) {
        console.log('ℹ️  Columns might already exist:', alterError.message);
      }
    } else {
      // Create new table
      await client.query(`
        CREATE TABLE user_usage_stats (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL UNIQUE,
          total_sessions INTEGER DEFAULT 0,
          total_time_spent INTEGER DEFAULT 0,
          today_time_spent INTEGER DEFAULT 0,
          average_session_duration INTEGER DEFAULT 0,
          last_opened_at TIMESTAMP,
          recent_sessions JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log('✅ user_usage_stats table created\n');
    }

    console.log('📋 Creating indexes for user_usage_stats...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_usage_stats_user_id ON user_usage_stats(user_id)
    `);
    
    // Check if column exists before creating index
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_usage_stats' 
      AND column_name = 'last_opened_at'
    `);
    
    if (columnCheck.rows.length > 0) {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_user_usage_stats_last_opened ON user_usage_stats(last_opened_at)
      `);
    }
    console.log('✅ Indexes created for user_usage_stats\n');

    console.log('📋 Creating user_streaks table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_streaks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE,
        current_streak INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        total_active_days INTEGER DEFAULT 0,
        last_active_date DATE,
        today_completed BOOLEAN DEFAULT FALSE,
        daily_goals JSONB DEFAULT '{"readBible": false, "prayer": false, "reflection": false, "studyGroup": false, "note": false}'::jsonb,
        freezes_available INTEGER DEFAULT 3,
        streak_start_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ user_streaks table created\n');

    console.log('📋 Creating indexes for user_streaks...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON user_streaks(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_streaks_last_active ON user_streaks(last_active_date)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_streaks_current_streak ON user_streaks(current_streak DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_streaks_longest_streak ON user_streaks(longest_streak DESC)
    `);
    console.log('✅ Indexes created for user_streaks\n');

    console.log('📋 Creating streak_milestones table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS streak_milestones (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        milestone_days INTEGER NOT NULL,
        milestone_name VARCHAR(100),
        achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reward_granted BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE (user_id, milestone_days)
      )
    `);
    console.log('✅ streak_milestones table created\n');

    console.log('📋 Creating indexes for streak_milestones...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_streak_milestones_user_id ON streak_milestones(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_streak_milestones_days ON streak_milestones(milestone_days)
    `);
    console.log('✅ Indexes created for streak_milestones\n');

    // Commit transaction
    await client.query('COMMIT');
    console.log('✅ Transaction committed\n');

    console.log('🎉 Migration completed successfully!\n');
    console.log('📊 Summary:');
    console.log('   ✓ user_usage_stats table created');
    console.log('   ✓ user_streaks table created');
    console.log('   ✓ streak_milestones table created');
    console.log('   ✓ All indexes created');
    console.log('\n🚀 Your backend is now ready for user engagement tracking!');

  } catch (error) {
    // Rollback on error
    if (client) {
      await client.query('ROLLBACK');
      console.log('❌ Transaction rolled back due to error\n');
    }
    
    console.error('❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    throw error;
  } finally {
    // Release the client back to the pool
    if (client) {
      client.release();
      console.log('\n🔌 Database connection released');
    }
    // Close the pool
    await pool.end();
    console.log('🔌 Database pool closed');
  }
}

// Run the migration
runEngagementMigration()
  .then(() => {
    console.log('\n✅ All done! You can now restart your server.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });

