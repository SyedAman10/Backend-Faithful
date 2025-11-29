-- Migration to add profile picture columns

-- Add google_picture column to store original Google profile picture
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_picture TEXT;

-- Add custom_picture column to store user-uploaded custom profile pictures
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_picture TEXT;

-- NOTE: DO NOT create indexes on picture columns!
-- Base64 images can exceed PostgreSQL's 8KB index limit
-- Pictures are retrieved by user_id which is already indexed

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


