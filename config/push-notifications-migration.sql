-- Migration: Add push notification support
-- Created: 2025-12-01
-- Description: Adds push_token and notification_settings columns to users table

-- Add push_token column to store Expo push tokens
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS push_token VARCHAR(255);

-- Add notification_settings column with default settings
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS notification_settings JSONB 
DEFAULT '{"pushEnabled": true, "journeyReminders": true, "prayerUpdates": true}'::jsonb;

-- Add index for faster push token lookups
CREATE INDEX IF NOT EXISTS idx_users_push_token ON users(push_token) WHERE push_token IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.push_token IS 'Expo push notification token for the user';
COMMENT ON COLUMN users.notification_settings IS 'User notification preferences in JSON format';

