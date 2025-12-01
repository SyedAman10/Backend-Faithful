const cron = require('node-cron');
const { pool } = require('../config/database');
const { sendJourneyReminderNotification } = require('./pushNotifications');

/**
 * Cron job to send journey reminders to users
 * Runs every day at 9 AM local server time
 * 
 * Logic:
 * 1. Find users who completed a journey day 24 hours ago
 * 2. Check if they have push notifications and journey reminders enabled
 * 3. Send push notification with next day information
 */

// Cron schedule: "0 9 * * *" = Every day at 9:00 AM
const CRON_SCHEDULE = '0 9 * * *'; // Adjust as needed

let cronJob = null;

function startJourneyReminderCron() {
  if (cronJob) {
    console.log('⚠️ Journey reminder cron job is already running');
    return;
  }

  console.log('🚀 Starting journey reminder cron job');
  console.log(`📅 Schedule: ${CRON_SCHEDULE} (Every day at 9:00 AM)`);

  cronJob = cron.schedule(CRON_SCHEDULE, async () => {
    console.log('\n🔔 ======== Journey Reminder Cron Job Started ========');
    console.log('⏰ Time:', new Date().toISOString());

    try {
      // Find users who completed a journey day approximately 24 hours ago
      // and haven't completed the next day yet
      const query = `
        WITH user_journey_progress AS (
          SELECT 
            u.id as user_id,
            u.push_token,
            u.notification_settings,
            MAX(ujp.day) as last_completed_day,
            MAX(ujp.completed_at) as last_completion_time
          FROM users u
          INNER JOIN user_journey_progress ujp ON u.id = ujp.user_id
          WHERE u.push_token IS NOT NULL
            AND ujp.completed = true
            AND ujp.completed_at >= NOW() - INTERVAL '30 hours'
            AND ujp.completed_at <= NOW() - INTERVAL '20 hours'
          GROUP BY u.id, u.push_token, u.notification_settings
        )
        SELECT 
          user_id,
          push_token,
          notification_settings,
          last_completed_day,
          last_completion_time,
          (last_completed_day + 1) as next_day
        FROM user_journey_progress
        WHERE notification_settings->>'pushEnabled' = 'true'
          AND notification_settings->>'journeyReminders' = 'true'
      `;

      const result = await pool.query(query);

      console.log(`📊 Found ${result.rows.length} users eligible for journey reminders`);

      if (result.rows.length === 0) {
        console.log('✅ No users to send reminders to');
        console.log('======== Journey Reminder Cron Job Completed ========\n');
        return;
      }

      // Send notifications to eligible users
      let successCount = 0;
      let errorCount = 0;

      for (const user of result.rows) {
        try {
          console.log(`📤 Sending reminder to user ${user.user_id} for day ${user.next_day}`);

          const notifResult = await sendJourneyReminderNotification(
            user.push_token, 
            user.next_day
          );

          if (notifResult.success) {
            successCount++;
            console.log(`✅ Reminder sent to user ${user.user_id}`);
          } else {
            errorCount++;
            console.log(`❌ Failed to send reminder to user ${user.user_id}:`, notifResult.error);
          }

          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          errorCount++;
          console.error(`❌ Error sending reminder to user ${user.user_id}:`, error.message);
        }
      }

      console.log('\n📊 Journey Reminder Summary:');
      console.log(`   Total users: ${result.rows.length}`);
      console.log(`   ✅ Successful: ${successCount}`);
      console.log(`   ❌ Failed: ${errorCount}`);
      console.log('======== Journey Reminder Cron Job Completed ========\n');

    } catch (error) {
      console.error('❌ Journey reminder cron job error:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      console.log('======== Journey Reminder Cron Job Failed ========\n');
    }
  });

  console.log('✅ Journey reminder cron job scheduled successfully\n');
}

function stopJourneyReminderCron() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('🛑 Journey reminder cron job stopped');
  } else {
    console.log('⚠️ No journey reminder cron job is running');
  }
}

function getJourneyReminderCronStatus() {
  return {
    isRunning: !!cronJob,
    schedule: CRON_SCHEDULE,
    description: 'Sends journey reminders 24 hours after completing a day'
  };
}

module.exports = {
  startJourneyReminderCron,
  stopJourneyReminderCron,
  getJourneyReminderCronStatus
};

