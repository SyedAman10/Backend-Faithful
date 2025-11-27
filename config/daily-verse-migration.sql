-- Migration to add user_verse_history table for daily verse tracking
-- This is separate from user_prayer_history and user_reflection_history

-- Create user_verse_history table
CREATE TABLE IF NOT EXISTS user_verse_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  version VARCHAR(50) NOT NULL,
  book VARCHAR(100) NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  text TEXT NOT NULL,
  reference VARCHAR(200) NOT NULL,
  verse_date TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, version, book, chapter, verse)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_verse_history_user_id ON user_verse_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_verse_history_verse_date ON user_verse_history(verse_date);
CREATE INDEX IF NOT EXISTS idx_user_verse_history_user_version ON user_verse_history(user_id, version);

-- Add comment
COMMENT ON TABLE user_verse_history IS 'Tracks daily inspirational verses shown to users (separate from prayer and reflection verses)';
COMMENT ON COLUMN user_verse_history.verse_date IS 'Date when this verse was shown to the user';
COMMENT ON COLUMN user_verse_history.version IS 'Bible translation version (KJV, NIV, etc.)';

-- Verify table creation (this will run after table is created)
-- Run this separately if needed:
-- SELECT table_name, column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'user_verse_history'
-- ORDER BY ordinal_position

