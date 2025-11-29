const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runXPAndGoalsMigration() {
  console.log('🚀 Starting XP and Daily Goals Migration...');
  
  try {
    const migrationPath = path.join(__dirname, '../config/xp-and-goals-migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration SQL loaded');
    
    // Create user_xp table
    console.log('⚙️  Creating user_xp table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_xp (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE,
        total_xp INTEGER DEFAULT 0,
        today_xp INTEGER DEFAULT 0,
        last_xp_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ user_xp table created');
    
    // Create user_daily_goals table
    console.log('⚙️  Creating user_daily_goals table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_daily_goals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        goal_date DATE NOT NULL,
        goals_completed JSONB DEFAULT '{}'::jsonb,
        total_goals INTEGER DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, goal_date)
      )
    `);
    console.log('✅ user_daily_goals table created');
    
    // Create user_activities_log table
    console.log('⚙️  Creating user_activities_log table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_activities_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        activity_type VARCHAR(50) NOT NULL,
        xp_earned INTEGER DEFAULT 0,
        activity_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ user_activities_log table created');
    
    // Create indexes
    console.log('⚙️  Creating indexes...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_xp_user_id ON user_xp(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_xp_total_xp ON user_xp(total_xp DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_daily_goals_user_id ON user_daily_goals(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_daily_goals_date ON user_daily_goals(goal_date DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_activities_log_user_id ON user_activities_log(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_activities_log_timestamp ON user_activities_log(activity_timestamp DESC)');
    console.log('✅ Indexes created');
    
    // Verify tables
    const verify = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('user_xp', 'user_daily_goals', 'user_activities_log')
      ORDER BY table_name
    `);
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Tables created:');
    console.table(verify.rows);
    
    console.log('\n📝 Summary:');
    console.log('   - user_xp: XP tracking (total, today, level)');
    console.log('   - user_daily_goals: Daily goals completion tracking');
    console.log('   - user_activities_log: Detailed activity history');
    
    console.log('\n🎯 Updated endpoint:');
    console.log('   POST /api/users/app-session');
    console.log('   - Now accepts "activities" array');
    console.log('   - Calculates XP and levels');
    console.log('   - Tracks daily goals completion');
    console.log('   - Returns gamification data');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

runXPAndGoalsMigration();

