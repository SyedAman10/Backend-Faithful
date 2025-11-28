const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Helper function to get milestone name
function getMilestoneName(days) {
  const names = {
    7: 'Week Warrior',
    14: 'Two Week Champion',
    30: 'Monthly Master',
    50: '50 Day Superstar',
    100: 'Century Club',
    365: 'Year of Faith'
  };
  return names[days] || `${days} Day Milestone`;
}

// Helper function to calculate freeze rewards
function calculateFreezeReward(days) {
  if (days >= 365) return 3;
  if (days >= 100) return 2;
  if (days >= 30 || days === 50 || days === 7) return 1;
  return 0;
}

// POST /api/users/app-session - Track app session and update streak
router.post('/app-session', authenticateToken, async (req, res) => {
  console.log('📱 App Session Request:', {
    userId: req.user.id,
    email: req.user.email,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;
    const {
      timestamp,
      durationSeconds,
      sessionStartTime,
      sessionEndTime,
      timezone
    } = req.body;

    // Validate required fields
    if (!durationSeconds || durationSeconds < 0) {
      return res.status(400).json({
        success: false,
        error: 'Duration in seconds is required and must be positive'
      });
    }

    console.log('⏱️  Session details:', {
      userId,
      durationSeconds,
      timestamp: timestamp || new Date().toISOString()
    });

    // Get today's date (user's timezone-aware if provided)
    const now = timestamp ? new Date(timestamp) : new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Get or create user_streaks record
    let streakResult = await pool.query(
      'SELECT * FROM user_streaks WHERE user_id = $1',
      [userId]
    );

    let currentStreak = 0;
    let longestStreak = 0;
    let totalActiveDays = 0;
    let lastActiveDate = null;
    let isNewStreak = false;
    let streakMessage = '';

    if (streakResult.rows.length === 0) {
      // First time user - create streak record
      console.log('🆕 Creating new streak record for user:', userId);
      
      await pool.query(`
        INSERT INTO user_streaks 
        (user_id, current_streak, longest_streak, total_active_days, last_active_date, 
         streak_start_date, created_at, updated_at)
        VALUES ($1, 0, 0, 1, $2, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [userId, today]);

      currentStreak = 0; // First day, no streak yet
      longestStreak = 0;
      totalActiveDays = 1;
      lastActiveDate = today;
      streakMessage = '🎉 Welcome! Start your streak tomorrow!';
      
    } else {
      const streakData = streakResult.rows[0];
      lastActiveDate = new Date(streakData.last_active_date);
      lastActiveDate.setHours(0, 0, 0, 0);
      
      currentStreak = streakData.current_streak || 0;
      longestStreak = streakData.longest_streak || 0;
      totalActiveDays = streakData.total_active_days || 0;

      console.log('📊 Current streak data:', {
        userId,
        currentStreak,
        lastActiveDate: lastActiveDate.toISOString().split('T')[0],
        today: today.toISOString().split('T')[0]
      });

      // Calculate days difference
      const daysDifference = Math.floor((today - lastActiveDate) / (1000 * 60 * 60 * 24));
      
      console.log('📅 Days difference:', daysDifference);

      if (daysDifference === 0) {
        // Same day - don't change streak
        console.log('✅ Same day visit - maintaining streak:', currentStreak);
        streakMessage = currentStreak > 0 
          ? `🔥 Keep going! ${currentStreak + 1} days in a row!`
          : '👍 You\'re active today!';
        
      } else if (daysDifference === 1) {
        // Consecutive day - increment streak
        currentStreak = currentStreak + 1;
        totalActiveDays = totalActiveDays + 1;
        isNewStreak = true;
        
        console.log('🔥 Consecutive day! New streak:', currentStreak);
        
        // Update longest streak if current is higher
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
          console.log('🏆 New longest streak!', longestStreak);
        }

        // Generate streak message
        streakMessage = `🔥 ${currentStreak + 1} days in a row! Keep it up!`;

        // Check for milestone achievements
        const milestones = [7, 14, 30, 50, 100, 365];
        const achievedMilestone = milestones.find(m => currentStreak + 1 === m);
        
        if (achievedMilestone) {
          const milestoneName = getMilestoneName(achievedMilestone);
          const freezeReward = calculateFreezeReward(achievedMilestone);
          
          streakMessage = `🎉 ${milestoneName}! ${achievedMilestone} days streak!`;
          
          // Record milestone achievement
          await pool.query(`
            INSERT INTO streak_milestones 
            (user_id, milestone_days, milestone_name, reward_granted, achieved_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, milestone_days) DO NOTHING
          `, [userId, achievedMilestone, milestoneName, freezeReward > 0]);
          
          // Add freeze rewards
          if (freezeReward > 0) {
            await pool.query(`
              UPDATE user_streaks 
              SET freezes_available = freezes_available + $1
              WHERE user_id = $2
            `, [freezeReward, userId]);
            
            streakMessage += ` +${freezeReward} freeze${freezeReward > 1 ? 's' : ''}!`;
          }
        }

        // Update streak record
        await pool.query(`
          UPDATE user_streaks 
          SET current_streak = $1,
              longest_streak = $2,
              total_active_days = $3,
              last_active_date = $4,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $5
        `, [currentStreak, longestStreak, totalActiveDays, today, userId]);
        
      } else if (daysDifference > 1) {
        // Streak broken - reset
        console.log('💔 Streak broken! Resetting to 0');
        
        currentStreak = 0; // Reset streak
        totalActiveDays = totalActiveDays + 1;
        isNewStreak = false;
        streakMessage = '😔 Streak reset. Start fresh today!';

        // Update streak record
        await pool.query(`
          UPDATE user_streaks 
          SET current_streak = 0,
              total_active_days = $1,
              last_active_date = $2,
              streak_start_date = $2,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $3
        `, [totalActiveDays, today, userId]);
      }
    }

    // Update user_usage_stats with session time
    console.log('💾 Updating usage stats...');
    
    const usageResult = await pool.query(
      'SELECT * FROM user_usage_stats WHERE user_id = $1',
      [userId]
    );

    let todayTimeSpent = durationSeconds;
    let totalTimeSpent = durationSeconds;
    let totalSessions = 1;

    if (usageResult.rows.length > 0) {
      const usageData = usageResult.rows[0];
      
      // Check if we need to reset today's time (new day)
      const lastOpened = new Date(usageData.last_opened_at);
      lastOpened.setHours(0, 0, 0, 0);
      
      if (lastOpened.getTime() === today.getTime()) {
        // Same day - add to today's time
        todayTimeSpent = (usageData.today_time_spent || 0) + durationSeconds;
      } else {
        // New day - reset today's time
        todayTimeSpent = durationSeconds;
      }
      
      // Always add to total time
      totalTimeSpent = (usageData.total_time_spent || 0) + durationSeconds;
      totalSessions = (usageData.total_sessions || 0) + 1;

      console.log('📊 Usage stats:', {
        userId,
        todayTimeSpent,
        totalTimeSpent,
        totalSessions
      });

      // Update usage stats
      await pool.query(`
        UPDATE user_usage_stats 
        SET total_sessions = $1,
            total_time_spent = $2,
            today_time_spent = $3,
            last_opened_at = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $5
      `, [totalSessions, totalTimeSpent, todayTimeSpent, now, userId]);
      
    } else {
      // Create new usage stats record
      console.log('🆕 Creating new usage stats for user:', userId);
      
      await pool.query(`
        INSERT INTO user_usage_stats 
        (user_id, total_sessions, total_time_spent, today_time_spent, 
         average_session_duration, last_opened_at, recent_sessions, created_at, updated_at)
        VALUES ($1, 1, $2, $2, $2, $3, '[]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [userId, durationSeconds, now]);
      
      todayTimeSpent = durationSeconds;
      totalTimeSpent = durationSeconds;
      totalSessions = 1;
    }

    // Format time for display
    const formatTime = (seconds) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    };

    console.log('✅ Session tracked successfully:', {
      userId,
      currentStreak,
      longestStreak,
      totalActiveDays,
      todayTimeSpent,
      totalTimeSpent,
      isNewStreak
    });

    // Send response
    res.json({
      success: true,
      data: {
        currentStreak: currentStreak,
        longestStreak: longestStreak,
        totalActiveDays: totalActiveDays,
        lastActiveDate: today.toISOString().split('T')[0],
        todayTimeSpent: todayTimeSpent,
        todayTimeFormatted: formatTime(todayTimeSpent),
        totalTimeSpent: totalTimeSpent,
        totalTimeFormatted: formatTime(totalTimeSpent),
        totalSessions: totalSessions,
        isNewStreak: isNewStreak,
        streakMessage: streakMessage
      },
      message: 'Session tracked successfully'
    });

  } catch (error) {
    console.error('❌ App session tracking error:', {
      userId: req.user.id,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      error: 'Failed to track app session',
      message: error.message
    });
  }
});

// GET /api/users/app-session - Get current streak and session stats (without tracking)
router.get('/app-session', authenticateToken, async (req, res) => {
  console.log('📊 Get App Session Stats Request:', {
    userId: req.user.id,
    email: req.user.email,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;

    // Get user_streaks data
    const streakResult = await pool.query(
      'SELECT * FROM user_streaks WHERE user_id = $1',
      [userId]
    );

    let currentStreak = 0;
    let longestStreak = 0;
    let totalActiveDays = 0;
    let lastActiveDate = null;
    let streakMessage = '';
    let freezesAvailable = 0;

    if (streakResult.rows.length === 0) {
      // No streak record yet
      console.log('ℹ️ No streak record found for user:', userId);
      streakMessage = '🎉 Open the app daily to start your streak!';
    } else {
      const streakData = streakResult.rows[0];
      currentStreak = streakData.current_streak || 0;
      longestStreak = streakData.longest_streak || 0;
      totalActiveDays = streakData.total_active_days || 0;
      lastActiveDate = streakData.last_active_date;
      freezesAvailable = streakData.freezes_available || 0;

      // Generate streak message
      if (currentStreak === 0) {
        streakMessage = '💪 Start your streak today!';
      } else {
        streakMessage = `🔥 ${currentStreak + 1} days in a row! Keep it up!`;
      }

      console.log('✅ Streak data found:', {
        userId,
        currentStreak,
        longestStreak,
        totalActiveDays
      });
    }

    // Get user_usage_stats data
    const usageResult = await pool.query(
      'SELECT * FROM user_usage_stats WHERE user_id = $1',
      [userId]
    );

    let todayTimeSpent = 0;
    let totalTimeSpent = 0;
    let totalSessions = 0;
    let lastOpenedAt = null;

    if (usageResult.rows.length > 0) {
      const usageData = usageResult.rows[0];
      
      // Check if today's time needs to be reset
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const lastOpened = new Date(usageData.last_opened_at);
      lastOpened.setHours(0, 0, 0, 0);
      
      if (lastOpened.getTime() === today.getTime()) {
        // Same day - use today's time
        todayTimeSpent = usageData.today_time_spent || 0;
      } else {
        // New day - today's time is 0
        todayTimeSpent = 0;
      }
      
      totalTimeSpent = usageData.total_time_spent || 0;
      totalSessions = usageData.total_sessions || 0;
      lastOpenedAt = usageData.last_opened_at;

      console.log('✅ Usage data found:', {
        userId,
        todayTimeSpent,
        totalTimeSpent,
        totalSessions
      });
    } else {
      console.log('ℹ️ No usage stats found for user:', userId);
    }

    // Get recent milestones
    const milestonesResult = await pool.query(
      `SELECT milestone_days, milestone_name, achieved_at, reward_granted
       FROM streak_milestones 
       WHERE user_id = $1 
       ORDER BY milestone_days DESC 
       LIMIT 5`,
      [userId]
    );

    const milestones = milestonesResult.rows;

    // Format time for display
    const formatTime = (seconds) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    };

    console.log('✅ App session stats retrieved successfully:', {
      userId,
      currentStreak,
      totalTimeSpent
    });

    // Send response
    res.json({
      success: true,
      data: {
        currentStreak: currentStreak,
        longestStreak: longestStreak,
        totalActiveDays: totalActiveDays,
        lastActiveDate: lastActiveDate ? new Date(lastActiveDate).toISOString().split('T')[0] : null,
        todayTimeSpent: todayTimeSpent,
        todayTimeFormatted: formatTime(todayTimeSpent),
        totalTimeSpent: totalTimeSpent,
        totalTimeFormatted: formatTime(totalTimeSpent),
        totalSessions: totalSessions,
        freezesAvailable: freezesAvailable,
        lastOpenedAt: lastOpenedAt,
        streakMessage: streakMessage,
        milestones: milestones
      },
      message: 'Session stats retrieved successfully'
    });

  } catch (error) {
    console.error('❌ Get app session stats error:', {
      userId: req.user.id,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session stats',
      message: error.message
    });
  }
});

// POST /api/users/profile/usage - Track app usage statistics
  console.log('📱 App Session Request:', {
    userId: req.user.id,
    email: req.user.email,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;
    const {
      timestamp,
      durationSeconds,
      sessionStartTime,
      sessionEndTime,
      timezone
    } = req.body;

    // Validate required fields
    if (!durationSeconds || durationSeconds < 0) {
      return res.status(400).json({
        success: false,
        error: 'Duration in seconds is required and must be positive'
      });
    }

    console.log('⏱️  Session details:', {
      userId,
      durationSeconds,
      timestamp: timestamp || new Date().toISOString()
    });

    // Get today's date (user's timezone-aware if provided)
    const now = timestamp ? new Date(timestamp) : new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Get or create user_streaks record
    let streakResult = await pool.query(
      'SELECT * FROM user_streaks WHERE user_id = $1',
      [userId]
    );

    let currentStreak = 0;
    let longestStreak = 0;
    let totalActiveDays = 0;
    let lastActiveDate = null;
    let isNewStreak = false;
    let streakMessage = '';

    if (streakResult.rows.length === 0) {
      // First time user - create streak record
      console.log('🆕 Creating new streak record for user:', userId);
      
      await pool.query(`
        INSERT INTO user_streaks 
        (user_id, current_streak, longest_streak, total_active_days, last_active_date, 
         streak_start_date, created_at, updated_at)
        VALUES ($1, 0, 0, 1, $2, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [userId, today]);

      currentStreak = 0; // First day, no streak yet
      longestStreak = 0;
      totalActiveDays = 1;
      lastActiveDate = today;
      streakMessage = '🎉 Welcome! Start your streak tomorrow!';
      
    } else {
      const streakData = streakResult.rows[0];
      lastActiveDate = new Date(streakData.last_active_date);
      lastActiveDate.setHours(0, 0, 0, 0);
      
      currentStreak = streakData.current_streak || 0;
      longestStreak = streakData.longest_streak || 0;
      totalActiveDays = streakData.total_active_days || 0;

      console.log('📊 Current streak data:', {
        userId,
        currentStreak,
        lastActiveDate: lastActiveDate.toISOString().split('T')[0],
        today: today.toISOString().split('T')[0]
      });

      // Calculate days difference
      const daysDifference = Math.floor((today - lastActiveDate) / (1000 * 60 * 60 * 24));
      
      console.log('📅 Days difference:', daysDifference);

      if (daysDifference === 0) {
        // Same day - don't change streak
        console.log('✅ Same day visit - maintaining streak:', currentStreak);
        streakMessage = currentStreak > 0 
          ? `🔥 Keep going! ${currentStreak + 1} days in a row!`
          : '👍 You\'re active today!';
        
      } else if (daysDifference === 1) {
        // Consecutive day - increment streak
        currentStreak = currentStreak + 1;
        totalActiveDays = totalActiveDays + 1;
        isNewStreak = true;
        
        console.log('🔥 Consecutive day! New streak:', currentStreak);
        
        // Update longest streak if current is higher
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
          console.log('🏆 New longest streak!', longestStreak);
        }

        // Generate streak message
        streakMessage = `🔥 ${currentStreak + 1} days in a row! Keep it up!`;

        // Check for milestone achievements
        const milestones = [7, 14, 30, 50, 100, 365];
        const achievedMilestone = milestones.find(m => currentStreak + 1 === m);
        
        if (achievedMilestone) {
          const milestoneName = getMilestoneName(achievedMilestone);
          const freezeReward = calculateFreezeReward(achievedMilestone);
          
          streakMessage = `🎉 ${milestoneName}! ${achievedMilestone} days streak!`;
          
          // Record milestone achievement
          await pool.query(`
            INSERT INTO streak_milestones 
            (user_id, milestone_days, milestone_name, reward_granted, achieved_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, milestone_days) DO NOTHING
          `, [userId, achievedMilestone, milestoneName, freezeReward > 0]);
          
          // Add freeze rewards
          if (freezeReward > 0) {
            await pool.query(`
              UPDATE user_streaks 
              SET freezes_available = freezes_available + $1
              WHERE user_id = $2
            `, [freezeReward, userId]);
            
            streakMessage += ` +${freezeReward} freeze${freezeReward > 1 ? 's' : ''}!`;
          }
        }

        // Update streak record
        await pool.query(`
          UPDATE user_streaks 
          SET current_streak = $1,
              longest_streak = $2,
              total_active_days = $3,
              last_active_date = $4,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $5
        `, [currentStreak, longestStreak, totalActiveDays, today, userId]);
        
      } else if (daysDifference > 1) {
        // Streak broken - reset
        console.log('💔 Streak broken! Resetting to 0');
        
        currentStreak = 0; // Reset streak
        totalActiveDays = totalActiveDays + 1;
        isNewStreak = false;
        streakMessage = '😔 Streak reset. Start fresh today!';

        // Update streak record
        await pool.query(`
          UPDATE user_streaks 
          SET current_streak = 0,
              total_active_days = $1,
              last_active_date = $2,
              streak_start_date = $2,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $3
        `, [totalActiveDays, today, userId]);
      }
    }

    // Update user_usage_stats with session time
    console.log('💾 Updating usage stats...');
    
    const usageResult = await pool.query(
      'SELECT * FROM user_usage_stats WHERE user_id = $1',
      [userId]
    );

    let todayTimeSpent = durationSeconds;
    let totalTimeSpent = durationSeconds;
    let totalSessions = 1;

    if (usageResult.rows.length > 0) {
      const usageData = usageResult.rows[0];
      
      // Check if we need to reset today's time (new day)
      const lastOpened = new Date(usageData.last_opened_at);
      lastOpened.setHours(0, 0, 0, 0);
      
      if (lastOpened.getTime() === today.getTime()) {
        // Same day - add to today's time
        todayTimeSpent = (usageData.today_time_spent || 0) + durationSeconds;
      } else {
        // New day - reset today's time
        todayTimeSpent = durationSeconds;
      }
      
      // Always add to total time
      totalTimeSpent = (usageData.total_time_spent || 0) + durationSeconds;
      totalSessions = (usageData.total_sessions || 0) + 1;

      console.log('📊 Usage stats:', {
        userId,
        todayTimeSpent,
        totalTimeSpent,
        totalSessions
      });

      // Update usage stats
      await pool.query(`
        UPDATE user_usage_stats 
        SET total_sessions = $1,
            total_time_spent = $2,
            today_time_spent = $3,
            last_opened_at = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $5
      `, [totalSessions, totalTimeSpent, todayTimeSpent, now, userId]);
      
    } else {
      // Create new usage stats record
      console.log('🆕 Creating new usage stats for user:', userId);
      
      await pool.query(`
        INSERT INTO user_usage_stats 
        (user_id, total_sessions, total_time_spent, today_time_spent, 
         average_session_duration, last_opened_at, recent_sessions, created_at, updated_at)
        VALUES ($1, 1, $2, $2, $2, $3, '[]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [userId, durationSeconds, now]);
      
      todayTimeSpent = durationSeconds;
      totalTimeSpent = durationSeconds;
      totalSessions = 1;
    }

    // Format time for display
    const formatTime = (seconds) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    };

    console.log('✅ Session tracked successfully:', {
      userId,
      currentStreak,
      longestStreak,
      totalActiveDays,
      todayTimeSpent,
      totalTimeSpent,
      isNewStreak
    });

    // Send response
    res.json({
      success: true,
      data: {
        currentStreak: currentStreak,
        longestStreak: longestStreak,
        totalActiveDays: totalActiveDays,
        lastActiveDate: today.toISOString().split('T')[0],
        todayTimeSpent: todayTimeSpent,
        todayTimeFormatted: formatTime(todayTimeSpent),
        totalTimeSpent: totalTimeSpent,
        totalTimeFormatted: formatTime(totalTimeSpent),
        totalSessions: totalSessions,
        isNewStreak: isNewStreak,
        streakMessage: streakMessage
      },
      message: 'Session tracked successfully'
    });

  } catch (error) {
    console.error('❌ App session tracking error:', {
      userId: req.user.id,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      error: 'Failed to track app session',
      message: error.message
    });
  }
});

// POST /api/users/profile/usage - Track app usage statistics
router.post('/profile/usage', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      totalSessions,
      totalTimeSpent,
      todayTimeSpent,
      averageSessionDuration,
      lastOpenedAt,
      recentSessions
    } = req.body;

    console.log('📊 Updating usage stats for user:', userId);

    // Validate input
    if (totalSessions === undefined || totalTimeSpent === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Keep only last 10 sessions
    const limitedSessions = Array.isArray(recentSessions) 
      ? recentSessions.slice(-10) 
      : [];

    await pool.query(`
      INSERT INTO user_usage_stats 
      (user_id, total_sessions, total_time_spent, today_time_spent, 
       average_session_duration, last_opened_at, recent_sessions)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id) 
      DO UPDATE SET
        total_sessions = EXCLUDED.total_sessions,
        total_time_spent = EXCLUDED.total_time_spent,
        today_time_spent = EXCLUDED.today_time_spent,
        average_session_duration = EXCLUDED.average_session_duration,
        last_opened_at = EXCLUDED.last_opened_at,
        recent_sessions = EXCLUDED.recent_sessions,
        updated_at = CURRENT_TIMESTAMP
    `, [
      userId,
      totalSessions,
      totalTimeSpent,
      todayTimeSpent || 0,
      averageSessionDuration || 0,
      lastOpenedAt || new Date().toISOString(),
      JSON.stringify(limitedSessions)
    ]);

    console.log('✅ Usage stats updated successfully for user:', userId);

    res.json({
      success: true,
      message: 'Usage stats updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating usage stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update usage stats',
      message: error.message
    });
  }
});

// GET /api/users/profile/usage - Get user's usage statistics
router.get('/profile/usage', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT * FROM user_usage_stats WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // Return default values
      return res.json({
        success: true,
        usage: {
          totalSessions: 0,
          totalTimeSpent: 0,
          todayTimeSpent: 0,
          averageSessionDuration: 0,
          lastOpenedAt: null,
          recentSessions: []
        }
      });
    }

    const usage = result.rows[0];

    res.json({
      success: true,
      usage: {
        totalSessions: usage.total_sessions,
        totalTimeSpent: usage.total_time_spent,
        todayTimeSpent: usage.today_time_spent,
        averageSessionDuration: usage.average_session_duration,
        lastOpenedAt: usage.last_opened_at,
        recentSessions: usage.recent_sessions || []
      }
    });
  } catch (error) {
    console.error('❌ Error fetching usage stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage stats',
      message: error.message
    });
  }
});

// POST /api/users/profile/streak - Update user's daily streak
router.post('/profile/streak', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      currentStreak,
      longestStreak,
      totalActiveDays,
      lastActiveDate,
      todayCompleted,
      dailyGoals,
      freezesAvailable
    } = req.body;

    console.log('🔥 Updating streak for user:', userId);

    // Validate input
    if (currentStreak === undefined || longestStreak === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Server-side validation of streak logic
    const today = new Date().toISOString().split('T')[0];
    let validatedFreezesAvailable = freezesAvailable !== undefined ? freezesAvailable : 3;

    // Check for milestone achievement
    let milestoneAchieved = null;
    const milestones = [7, 14, 30, 50, 100, 365];
    
    for (const days of milestones) {
      if (currentStreak === days) {
        // Check if not already awarded
        const existingResult = await pool.query(
          'SELECT id FROM streak_milestones WHERE user_id = $1 AND milestone_days = $2',
          [userId, days]
        );
        
        if (existingResult.rows.length === 0) {
          // Award milestone
          const freezesToGrant = calculateFreezeReward(days);
          const milestoneName = getMilestoneName(days);
          
          milestoneAchieved = { 
            days, 
            name: milestoneName, 
            freezesToGrant 
          };
          
          console.log(`🎉 Milestone achieved: ${milestoneName} (${days} days)`);
          
          // Insert milestone record
          await pool.query(
            'INSERT INTO streak_milestones (user_id, milestone_days, milestone_name, reward_granted) VALUES ($1, $2, $3, $4)',
            [userId, days, milestoneName, freezesToGrant > 0]
          );
          
          // Grant freezes
          if (freezesToGrant > 0) {
            validatedFreezesAvailable += freezesToGrant;
            console.log(`✅ Granted ${freezesToGrant} streak freeze(s)`);
          }
        }
      }
    }

    // Get streak start date (or set to today if new streak)
    let streakStartDate = lastActiveDate;
    const existingStreakResult = await pool.query(
      'SELECT streak_start_date FROM user_streaks WHERE user_id = $1',
      [userId]
    );
    
    if (existingStreakResult.rows.length > 0 && existingStreakResult.rows[0].streak_start_date) {
      streakStartDate = existingStreakResult.rows[0].streak_start_date;
    } else if (currentStreak === 1) {
      streakStartDate = today;
    }

    // Update streak data with UPSERT
    await pool.query(`
      INSERT INTO user_streaks 
      (user_id, current_streak, longest_streak, total_active_days, 
       last_active_date, today_completed, daily_goals, freezes_available, streak_start_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (user_id) 
      DO UPDATE SET
        current_streak = EXCLUDED.current_streak,
        longest_streak = EXCLUDED.longest_streak,
        total_active_days = EXCLUDED.total_active_days,
        last_active_date = EXCLUDED.last_active_date,
        today_completed = EXCLUDED.today_completed,
        daily_goals = EXCLUDED.daily_goals,
        freezes_available = EXCLUDED.freezes_available,
        streak_start_date = COALESCE(user_streaks.streak_start_date, EXCLUDED.streak_start_date),
        updated_at = CURRENT_TIMESTAMP
    `, [
      userId,
      currentStreak,
      longestStreak,
      totalActiveDays || 0,
      lastActiveDate || today,
      todayCompleted || false,
      JSON.stringify(dailyGoals || {}),
      validatedFreezesAvailable,
      streakStartDate
    ]);

    console.log('✅ Streak updated successfully for user:', userId);

    res.json({
      success: true,
      message: 'Streak data updated successfully',
      data: {
        currentStreak,
        longestStreak,
        freezesAvailable: validatedFreezesAvailable,
        milestoneAchieved
      }
    });
  } catch (error) {
    console.error('❌ Error updating streak:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update streak data',
      message: error.message
    });
  }
});

// GET /api/users/profile/streak - Get user's streak data
router.get('/profile/streak', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT * FROM user_streaks WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // Return default values
      return res.json({
        success: true,
        streak: {
          currentStreak: 0,
          longestStreak: 0,
          totalActiveDays: 0,
          lastActiveDate: null,
          todayCompleted: false,
          freezesAvailable: 3,
          streakStartDate: new Date().toISOString().split('T')[0]
        },
        dailyGoals: {
          readBible: false,
          prayer: false,
          reflection: false,
          studyGroup: false,
          note: false
        }
      });
    }

    const streak = result.rows[0];

    res.json({
      success: true,
      streak: {
        currentStreak: streak.current_streak,
        longestStreak: streak.longest_streak,
        totalActiveDays: streak.total_active_days,
        lastActiveDate: streak.last_active_date,
        todayCompleted: streak.today_completed,
        freezesAvailable: streak.freezes_available,
        streakStartDate: streak.streak_start_date
      },
      dailyGoals: streak.daily_goals || {
        readBible: false,
        prayer: false,
        reflection: false,
        studyGroup: false,
        note: false
      }
    });
  } catch (error) {
    console.error('❌ Error fetching streak:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch streak data',
      message: error.message
    });
  }
});

// GET /api/users/profile/milestones - Get user's achieved milestones
router.get('/profile/milestones', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT * FROM streak_milestones WHERE user_id = $1 ORDER BY milestone_days ASC',
      [userId]
    );

    res.json({
      success: true,
      milestones: result.rows.map(m => ({
        days: m.milestone_days,
        name: m.milestone_name,
        achievedAt: m.achieved_at,
        rewardGranted: m.reward_granted
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching milestones:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch milestones',
      message: error.message
    });
  }
});

// GET /api/users/streak/leaderboard - Get streak leaderboard
router.get('/streak/leaderboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const period = req.query.period || 'current'; // current, longest, total_days

    let orderBy = 'current_streak';
    if (period === 'longest') orderBy = 'longest_streak';
    if (period === 'total_days') orderBy = 'total_active_days';

    // Get top users
    const leaderboardResult = await pool.query(`
      SELECT 
        u.id as user_id,
        u.name,
        u.picture as profile_picture,
        s.current_streak,
        s.longest_streak,
        s.total_active_days,
        ROW_NUMBER() OVER (ORDER BY s.${orderBy} DESC) as rank
      FROM user_streaks s
      JOIN users u ON s.user_id = u.id
      ORDER BY s.${orderBy} DESC
      LIMIT $1
    `, [limit]);

    // Get current user's rank
    const userRankResult = await pool.query(`
      SELECT 
        ranked.rank,
        ranked.current_streak,
        ranked.longest_streak,
        ranked.total_active_days
      FROM (
        SELECT 
          user_id,
          current_streak,
          longest_streak,
          total_active_days,
          ROW_NUMBER() OVER (ORDER BY ${orderBy} DESC) as rank
        FROM user_streaks
      ) ranked
      WHERE ranked.user_id = $1
    `, [userId]);

    const userRank = userRankResult.rows.length > 0 
      ? {
          rank: userRankResult.rows[0].rank,
          currentStreak: userRankResult.rows[0].current_streak,
          longestStreak: userRankResult.rows[0].longest_streak,
          totalActiveDays: userRankResult.rows[0].total_active_days
        }
      : {
          rank: null,
          currentStreak: 0,
          longestStreak: 0,
          totalActiveDays: 0
        };

    res.json({
      success: true,
      leaderboard: leaderboardResult.rows.map(row => ({
        userId: row.user_id,
        name: row.name,
        profilePicture: row.profile_picture,
        currentStreak: row.current_streak,
        longestStreak: row.longest_streak,
        totalActiveDays: row.total_active_days,
        rank: parseInt(row.rank)
      })),
      userRank
    });
  } catch (error) {
    console.error('❌ Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard',
      message: error.message
    });
  }
});

module.exports = router;

