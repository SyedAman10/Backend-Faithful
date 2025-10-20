const { pool } = require('../config/database');

async function fixEngagementSchema() {
  console.log('🔧 Fixing User Engagement Tracking schema...\n');
  
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Connected to Neon database\n');

    await client.query('BEGIN');
    console.log('📦 Transaction started\n');

    // Check existing table structure
    console.log('📋 Checking existing user_usage_stats table...');
    const existingColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_usage_stats'
      ORDER BY ordinal_position
    `);
    
    console.log('Current columns:', existingColumns.rows.map(r => r.column_name).join(', '));
    
    // Drop and recreate user_usage_stats with correct schema
    console.log('\n🗑️  Dropping old user_usage_stats table...');
    await client.query(`DROP TABLE IF EXISTS user_usage_stats CASCADE`);
    console.log('✅ Old table dropped\n');

    console.log('📋 Creating new user_usage_stats table with correct schema...');
    await client.query(`
      CREATE TABLE user_usage_stats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        total_sessions INTEGER DEFAULT 0,
        total_time_spent INTEGER DEFAULT 0,
        today_time_spent INTEGER DEFAULT 0,
        average_session_duration INTEGER DEFAULT 0,
        last_opened_at TIMESTAMP,
        recent_sessions JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT user_usage_stats_user_id_key UNIQUE (user_id),
        CONSTRAINT user_usage_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ New user_usage_stats table created\n');

    console.log('📋 Creating indexes for user_usage_stats...');
    await client.query(`
      CREATE INDEX idx_user_usage_stats_user_id ON user_usage_stats(user_id)
    `);
    await client.query(`
      CREATE INDEX idx_user_usage_stats_last_opened ON user_usage_stats(last_opened_at)
    `);
    console.log('✅ Indexes created\n');

    // Ensure user_streaks table exists with correct schema
    console.log('📋 Ensuring user_streaks table exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_streaks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
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
        CONSTRAINT user_streaks_user_id_key UNIQUE (user_id),
        CONSTRAINT user_streaks_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ user_streaks table ready\n');

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
    console.log('✅ Indexes created\n');

    // Ensure streak_milestones table exists
    console.log('📋 Ensuring streak_milestones table exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS streak_milestones (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        milestone_days INTEGER NOT NULL,
        milestone_name VARCHAR(100),
        achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reward_granted BOOLEAN DEFAULT FALSE,
        CONSTRAINT streak_milestones_user_milestone_key UNIQUE (user_id, milestone_days),
        CONSTRAINT streak_milestones_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ streak_milestones table ready\n');

    console.log('📋 Creating indexes for streak_milestones...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_streak_milestones_user_id ON streak_milestones(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_streak_milestones_days ON streak_milestones(milestone_days)
    `);
    console.log('✅ Indexes created\n');

    // Verify the schema
    console.log('🔍 Verifying new schema...');
    const newColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user_usage_stats'
      ORDER BY ordinal_position
    `);
    
    console.log('✅ New user_usage_stats columns:');
    newColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });

    await client.query('COMMIT');
    console.log('\n✅ Transaction committed\n');

    console.log('🎉 Schema fix completed successfully!\n');
    console.log('📊 Summary:');
    console.log('   ✓ user_usage_stats table recreated with correct schema');
    console.log('   ✓ user_streaks table verified');
    console.log('   ✓ streak_milestones table verified');
    console.log('   ✓ All indexes created');
    console.log('\n🚀 Your backend is now ready! Restart your server.');

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
      console.log('❌ Transaction rolled back\n');
    }
    
    console.error('❌ Schema fix failed:', error.message);
    console.error('\nError details:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
      console.log('\n🔌 Database connection released');
    }
    await pool.end();
    console.log('🔌 Database pool closed');
  }
}

// Run the fix
fixEngagementSchema()
  .then(() => {
    console.log('\n✅ All done! Restart your server now.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Schema fix failed:', error);
    process.exit(1);
  });

