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

