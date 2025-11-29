-- Migration to add profile picture columns

-- Add google_picture column to store original Google profile picture
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_picture TEXT;

-- Add custom_picture column to store user-uploaded custom profile pictures
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_picture TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_google_picture ON users(google_picture) WHERE google_picture IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_custom_picture ON users(custom_picture) WHERE custom_picture IS NOT NULL;

-- Add comments
COMMENT ON COLUMN users.google_picture IS 'Original Google profile picture URL from OAuth';
COMMENT ON COLUMN users.custom_picture IS 'Custom user-uploaded profile picture (base64 or URL)';
COMMENT ON COLUMN users.picture IS 'Legacy picture column - kept for backward compatibility';

-- Migrate existing Google pictures to google_picture column
UPDATE users 
SET google_picture = picture 
WHERE google_id IS NOT NULL 
  AND picture IS NOT NULL 
  AND google_picture IS NULL;


