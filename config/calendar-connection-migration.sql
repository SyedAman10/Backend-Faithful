-- Migration to add Google Calendar connection tracking columns
-- Run this SQL script to add new columns for separate calendar authentication

-- Add google_calendar_connected column to track if user has connected calendar separately
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS google_calendar_connected BOOLEAN DEFAULT FALSE;

-- Add google_email column to store the actual Gmail address
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS google_email VARCHAR(255);

-- Create index for faster lookups by google_email
CREATE INDEX IF NOT EXISTS idx_users_google_email ON users(google_email);

-- Create index for calendar connection status
CREATE INDEX IF NOT EXISTS idx_users_google_calendar_connected ON users(google_calendar_connected);

-- Add comments to document the columns
COMMENT ON COLUMN users.google_calendar_connected IS 'Indicates if user has explicitly connected their Google Calendar (separate from signup)';
COMMENT ON COLUMN users.google_email IS 'The actual Gmail email address obtained from Google OAuth';

-- Display current schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('google_calendar_connected', 'google_email', 'google_access_token', 'google_refresh_token', 'google_meet_access')
ORDER BY ordinal_position;

