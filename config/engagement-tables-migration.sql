-- Migration script for User Engagement Tracking tables
-- Run this script to create the necessary tables for user engagement features

-- Table: user_usage_stats
-- Tracks user app usage statistics
CREATE TABLE IF NOT EXISTS user_usage_stats (
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
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_usage_stats_user_id ON user_usage_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_stats_last_opened ON user_usage_stats(last_opened_at);

-- Table: user_streaks
-- Tracks user daily streaks and goals
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
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_last_active ON user_streaks(last_active_date);
CREATE INDEX IF NOT EXISTS idx_user_streaks_current_streak ON user_streaks(current_streak DESC);
CREATE INDEX IF NOT EXISTS idx_user_streaks_longest_streak ON user_streaks(longest_streak DESC);

-- Table: streak_milestones
-- Tracks milestone achievements for users
CREATE TABLE IF NOT EXISTS streak_milestones (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  milestone_days INTEGER NOT NULL,
  milestone_name VARCHAR(100),
  achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reward_granted BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, milestone_days)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_streak_milestones_user_id ON streak_milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_streak_milestones_days ON streak_milestones(milestone_days);

-- Comments for documentation
COMMENT ON TABLE user_usage_stats IS 'Stores user app usage statistics including sessions, time spent, and recent activity';
COMMENT ON TABLE user_streaks IS 'Tracks user daily streaks, goals completion, and freeze availability';
COMMENT ON TABLE streak_milestones IS 'Records milestone achievements (7, 14, 30, 50, 100, 365 days) and rewards';

COMMENT ON COLUMN user_usage_stats.total_sessions IS 'Total number of app sessions';
COMMENT ON COLUMN user_usage_stats.total_time_spent IS 'Total time spent in app (seconds)';
COMMENT ON COLUMN user_usage_stats.today_time_spent IS 'Time spent today (seconds) - resets daily';
COMMENT ON COLUMN user_usage_stats.average_session_duration IS 'Average session duration (seconds)';
COMMENT ON COLUMN user_usage_stats.recent_sessions IS 'JSON array of last 10 sessions';

COMMENT ON COLUMN user_streaks.current_streak IS 'Current consecutive days streak';
COMMENT ON COLUMN user_streaks.longest_streak IS 'Longest streak ever achieved';
COMMENT ON COLUMN user_streaks.total_active_days IS 'Total number of active days (not necessarily consecutive)';
COMMENT ON COLUMN user_streaks.today_completed IS 'Whether user completed daily goals today';
COMMENT ON COLUMN user_streaks.daily_goals IS 'JSON object tracking completion of daily goals';
COMMENT ON COLUMN user_streaks.freezes_available IS 'Number of streak freezes available (earned at milestones)';

COMMENT ON COLUMN streak_milestones.milestone_days IS 'Milestone days (7, 14, 30, 50, 100, 365)';
COMMENT ON COLUMN streak_milestones.reward_granted IS 'Whether streak freeze reward was granted';

