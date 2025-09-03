const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Helper function to calculate weekly streak
const calculateWeeklyStreak = (weeklyStreak) => {
  const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
  const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // Convert to array starting from Monday (index 0)
  const mondayBasedStreak = [...weeklyStreak];
  
  // Update today's streak
  mondayBasedStreak[today === 0 ? 6 : today - 1] = true;
  
  return mondayBasedStreak;
};

// Helper function to calculate current streak
const calculateCurrentStreak = (weeklyStreak) => {
  const today = new Date().getDay();
  const mondayIndex = today === 0 ? 6 : today - 1;
  
  let streak = 0;
  for (let i = mondayIndex; i >= 0; i--) {
    if (weeklyStreak[i]) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
};

// Start Session API
router.post('/session/start', authenticateToken, async (req, res) => {
  console.log('🚀 Start Session Request:', {
    userId: req.user.id,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  try {
    const { sessionStart } = req.body;
    const userId = req.user.id;

    // Validate session start time
    if (!sessionStart) {
      return res.status(400).json({
        success: false,
        error: 'Session start time is required'
      });
    }

    // Create new session
    const sessionResult = await pool.query(
      `INSERT INTO user_sessions (user_id, session_start) 
       VALUES ($1, $2) 
       RETURNING id, session_start`,
      [userId, new Date(sessionStart)]
    );

    const session = sessionResult.rows[0];

    console.log('✅ Session started successfully:', {
      sessionId: session.id,
      userId: userId,
      sessionStart: session.session_start,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      sessionId: session.id,
      message: 'Session started successfully'
    });

  } catch (error) {
    console.error('❌ Start session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start session',
      message: error.message
    });
  }
});

// End Session API
router.post('/session/end', authenticateToken, async (req, res) => {
  console.log('⏹️ End Session Request:', {
    userId: req.user.id,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  try {
    const { sessionId, sessionEnd, durationSeconds } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!sessionId || !sessionEnd || !durationSeconds) {
      return res.status(400).json({
        success: false,
        error: 'Session ID, end time, and duration are required'
      });
    }

    // Update session with end time and duration
    await pool.query(
      `UPDATE user_sessions 
       SET session_end = $1, duration_seconds = $2 
       WHERE id = $1 AND user_id = $3`,
      [new Date(sessionEnd), durationSeconds, sessionId, userId]
    );

    // Get or create usage stats for user
    let statsResult = await pool.query(
      'SELECT * FROM user_usage_stats WHERE user_id = $1',
      [userId]
    );

    if (statsResult.rows.length === 0) {
      // Create new stats record
      await pool.query(
        `INSERT INTO user_usage_stats (user_id, total_time_seconds, current_streak, weekly_streak) 
         VALUES ($1, $2, 1, $3)`,
        [userId, durationSeconds, calculateWeeklyStreak([false, false, false, false, false, false, false])]
      );
    } else {
      // Update existing stats
      const currentStats = statsResult.rows[0];
      const newTotalTime = currentStats.total_time_seconds + durationSeconds;
      const newWeeklyStreak = calculateWeeklyStreak(currentStats.weekly_streak);
      const newCurrentStreak = calculateCurrentStreak(newWeeklyStreak);

      await pool.query(
        `UPDATE user_usage_stats 
         SET total_time_seconds = $1, current_streak = $2, weekly_streak = $3, last_updated = NOW() 
         WHERE user_id = $4`,
        [newTotalTime, newCurrentStreak, newWeeklyStreak, userId]
      );
    }

    // Get updated stats
    const updatedStats = await pool.query(
      'SELECT * FROM user_usage_stats WHERE user_id = $1',
      [userId]
    );

    const stats = updatedStats.rows[0];

    console.log('✅ Session ended successfully:', {
      sessionId: sessionId,
      userId: userId,
      durationSeconds: durationSeconds,
      totalTimeSpent: stats.total_time_seconds,
      currentStreak: stats.current_streak,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      totalTimeSpent: stats.total_time_seconds,
      todayProgress: durationSeconds,
      currentStreak: stats.current_streak,
      message: 'Session ended successfully'
    });

  } catch (error) {
    console.error('❌ End session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to end session',
      message: error.message
    });
  }
});

// Get User Stats API
router.get('/stats/:userId', authenticateToken, async (req, res) => {
  console.log('📈 Get User Stats Request:', {
    requestedUserId: req.params.userId,
    authenticatedUserId: req.user.id,
    timestamp: new Date().toISOString()
  });

  try {
    const requestedUserId = parseInt(req.params.userId);
    const authenticatedUserId = req.user.id;

    // Check if user is requesting their own stats or has permission
    if (requestedUserId !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own stats.'
      });
    }

    // Get user stats
    const statsResult = await pool.query(
      'SELECT * FROM user_usage_stats WHERE user_id = $1',
      [requestedUserId]
    );

    if (statsResult.rows.length === 0) {
      // Create default stats if none exist
      await pool.query(
        `INSERT INTO user_usage_stats (user_id, total_time_seconds, current_streak, weekly_streak) 
         VALUES ($1, 0, 0, $2)`,
        [requestedUserId, [false, false, false, false, false, false, false]]
      );

      const defaultStats = {
        total_time_seconds: 0,
        current_streak: 0,
        weekly_streak: [false, false, false, false, false, false, false],
        last_updated: new Date()
      };

      console.log('✅ Default stats created for user:', {
        userId: requestedUserId,
        stats: defaultStats,
        timestamp: new Date().toISOString()
      });

      return res.json({
        success: true,
        data: {
          totalTimeSpent: defaultStats.total_time_seconds,
          currentStreak: defaultStats.current_streak,
          todayProgress: 0,
          weeklyStreak: defaultStats.weekly_streak,
          lastUpdated: defaultStats.last_updated
        }
      });
    }

    const stats = statsResult.rows[0];

    // Calculate today's progress from today's sessions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaySessions = await pool.query(
      `SELECT COALESCE(SUM(duration_seconds), 0) as today_total 
       FROM user_sessions 
       WHERE user_id = $1 AND DATE(session_start) = DATE($2)`,
      [requestedUserId, today]
    );

    const todayProgress = todaySessions.rows[0].today_total;

    console.log('✅ User stats retrieved successfully:', {
      userId: requestedUserId,
      totalTimeSpent: stats.total_time_seconds,
      currentStreak: stats.current_streak,
      todayProgress: todayProgress,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        totalTimeSpent: stats.total_time_seconds,
        currentStreak: stats.current_streak,
        todayProgress: todayProgress,
        weeklyStreak: stats.weekly_streak,
        lastUpdated: stats.last_updated
      }
    });

  } catch (error) {
    console.error('❌ Get user stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user stats',
      message: error.message
    });
  }
});

// Get User Sessions API (for debugging and analytics)
router.get('/sessions/:userId', authenticateToken, async (req, res) => {
  console.log('📋 Get User Sessions Request:', {
    requestedUserId: req.params.userId,
    authenticatedUserId: req.user.id,
    timestamp: new Date().toISOString()
  });

  try {
    const requestedUserId = parseInt(req.params.userId);
    const authenticatedUserId = req.user.id;

    // Check if user is requesting their own sessions
    if (requestedUserId !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own sessions.'
      });
    }

    // Get user sessions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sessionsResult = await pool.query(
      `SELECT id, session_start, session_end, duration_seconds, created_at 
       FROM user_sessions 
       WHERE user_id = $1 AND session_start >= $2 
       ORDER BY session_start DESC 
       LIMIT 100`,
      [requestedUserId, thirtyDaysAgo]
    );

    console.log('✅ User sessions retrieved successfully:', {
      userId: requestedUserId,
      sessionCount: sessionsResult.rows.length,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        sessions: sessionsResult.rows,
        totalSessions: sessionsResult.rows.length
      }
    });

  } catch (error) {
    console.error('❌ Get user sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user sessions',
      message: error.message
    });
  }
});

module.exports = router;
