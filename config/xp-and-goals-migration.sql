-- Migration to add XP and Daily Goals tracking

-- Create user_xp table
CREATE TABLE IF NOT EXISTS user_xp (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  total_xp INTEGER DEFAULT 0,
  today_xp INTEGER DEFAULT 0,
  last_xp_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create user_daily_goals table
CREATE TABLE IF NOT EXISTS user_daily_goals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  goal_date DATE NOT NULL,
  goals_completed JSONB DEFAULT '{}'::jsonb,
  total_goals INTEGER DEFAULT 5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, goal_date)
);

-- Create user_activities_log table (optional - for detailed tracking)
CREATE TABLE IF NOT EXISTS user_activities_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  activity_type VARCHAR(50) NOT NULL,
  xp_earned INTEGER DEFAULT 0,
  activity_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_xp_user_id ON user_xp(user_id);
CREATE INDEX IF NOT EXISTS idx_user_xp_total_xp ON user_xp(total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_user_daily_goals_user_id ON user_daily_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_daily_goals_date ON user_daily_goals(goal_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_log_user_id ON user_activities_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_log_timestamp ON user_activities_log(activity_timestamp DESC);

-- Add comments
COMMENT ON TABLE user_xp IS 'Tracks user experience points and levels for gamification';
COMMENT ON TABLE user_daily_goals IS 'Tracks completion of daily goals (daily verse, prayer, reflection, etc.)';
COMMENT ON TABLE user_activities_log IS 'Detailed log of all user activities for analytics and debugging';

COMMENT ON COLUMN user_xp.total_xp IS 'All-time total XP earned';
COMMENT ON COLUMN user_xp.today_xp IS 'XP earned today (resets daily)';
COMMENT ON COLUMN user_daily_goals.goals_completed IS 'JSON object with goal types as keys and completion status as values';
COMMENT ON COLUMN user_activities_log.activity_type IS 'Type of activity (daily_verse_read, ai_chat_message, etc.)';

