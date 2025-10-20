const cron = require('node-cron');
const { pool } = require('../config/database');

// Daily reset job - Runs at midnight UTC (00:00)
// Resets today_completed and checks for broken streaks
const dailyStreakResetJob = cron.schedule('0 0 * * *', async () => {
  console.log('🔄 Running daily streak reset job at:', new Date().toISOString());
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Step 1: Reset today_completed and daily_goals for all users
    const resetResult = await pool.query(`
      UPDATE user_streaks 
      SET 
        today_completed = FALSE, 
        daily_goals = '{"readBible": false, "prayer": false, "reflection": false, "studyGroup": false, "note": false}'::jsonb,
        updated_at = CURRENT_TIMESTAMP
    `);
    
    console.log(`✅ Reset daily completion for ${resetResult.rowCount} users`);
    
    // Step 2: Check for broken streaks (missed more than 1 day without freezes)
    // This breaks streaks for users who:
    // - Last active date is before yesterday (missed 2+ days)
    // - Have no freezes available
    const brokenStreaksResult = await pool.query(`
      UPDATE user_streaks
      SET 
        current_streak = 0,
        streak_start_date = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE 
        last_active_date < $2
        AND (
          (last_active_date < $2 AND EXTRACT(DAY FROM ($1::date - last_active_date)) > 1)
          OR (last_active_date = $2 AND freezes_available = 0)
        )
        AND current_streak > 0
    `, [today, yesterday]);
    
    console.log(`💔 Broke ${brokenStreaksResult.rowCount} streak(s) due to inactivity`);
    
    // Step 3: Deduct freezes if missed exactly 1 day (yesterday)
    // Users who were active the day before yesterday but not yesterday
    const freezeUsedResult = await pool.query(`
      UPDATE user_streaks
      SET 
        freezes_available = freezes_available - 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE 
        last_active_date < $1
        AND last_active_date >= $1::date - INTERVAL '2 days'
        AND freezes_available > 0
        AND today_completed = FALSE
    `, [today]);
    
    console.log(`❄️ Used ${freezeUsedResult.rowCount} streak freeze(s)`);
    
    console.log('✅ Daily streak reset job completed successfully');
  } catch (error) {
    console.error('❌ Error in daily streak reset job:', error);
  }
}, {
  scheduled: false, // Don't start immediately, will be started manually
  timezone: "UTC"
});

// Daily usage reset job - Runs at 1 AM UTC (01:00)
// Resets today_time_spent for users who haven't opened app today
const dailyUsageResetJob = cron.schedule('0 1 * * *', async () => {
  console.log('🔄 Running daily usage reset job at:', new Date().toISOString());
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Reset today_time_spent to 0 for users whose last_opened_at is before today
    const resetResult = await pool.query(`
      UPDATE user_usage_stats 
      SET 
        today_time_spent = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE 
        DATE(last_opened_at) < $1::date
        OR last_opened_at IS NULL
    `, [today]);
    
    console.log(`✅ Reset daily usage for ${resetResult.rowCount} users`);
    console.log('✅ Daily usage reset job completed successfully');
  } catch (error) {
    console.error('❌ Error in daily usage reset job:', error);
  }
}, {
  scheduled: false,
  timezone: "UTC"
});

// Cleanup old sessions job - Runs weekly on Sunday at 2 AM UTC
// Removes old session data to keep database clean
const weeklyCleanupJob = cron.schedule('0 2 * * 0', async () => {
  console.log('🧹 Running weekly cleanup job at:', new Date().toISOString());
  
  try {
    // Keep only last 10 sessions for each user
    const result = await pool.query(`
      UPDATE user_usage_stats
      SET 
        recent_sessions = (
          SELECT jsonb_agg(session)
          FROM (
            SELECT jsonb_array_elements(recent_sessions) as session
            ORDER BY (session->>'startTime')::bigint DESC
            LIMIT 10
          ) sub
        ),
        updated_at = CURRENT_TIMESTAMP
      WHERE 
        jsonb_array_length(recent_sessions) > 10
    `);
    
    console.log(`✅ Cleaned up session data for ${result.rowCount} users`);
    console.log('✅ Weekly cleanup job completed successfully');
  } catch (error) {
    console.error('❌ Error in weekly cleanup job:', error);
  }
}, {
  scheduled: false,
  timezone: "UTC"
});

// Function to start all cron jobs
function startEngagementCronJobs() {
  console.log('🚀 Starting engagement tracking cron jobs...');
  
  dailyStreakResetJob.start();
  console.log('✅ Daily streak reset job scheduled (00:00 UTC)');
  
  dailyUsageResetJob.start();
  console.log('✅ Daily usage reset job scheduled (01:00 UTC)');
  
  weeklyCleanupJob.start();
  console.log('✅ Weekly cleanup job scheduled (02:00 UTC Sunday)');
  
  console.log('✅ All engagement cron jobs started successfully');
}

// Function to stop all cron jobs
function stopEngagementCronJobs() {
  dailyStreakResetJob.stop();
  dailyUsageResetJob.stop();
  weeklyCleanupJob.stop();
  console.log('⏹️ All engagement cron jobs stopped');
}

// Manual trigger functions for testing
async function manualStreakReset() {
  console.log('🔧 Manually triggering daily streak reset...');
  dailyStreakResetJob._events.onTick();
}

async function manualUsageReset() {
  console.log('🔧 Manually triggering daily usage reset...');
  dailyUsageResetJob._events.onTick();
}

async function manualCleanup() {
  console.log('🔧 Manually triggering weekly cleanup...');
  weeklyCleanupJob._events.onTick();
}

module.exports = {
  startEngagementCronJobs,
  stopEngagementCronJobs,
  manualStreakReset,
  manualUsageReset,
  manualCleanup
};

