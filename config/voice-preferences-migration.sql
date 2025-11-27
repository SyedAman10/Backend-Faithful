-- Migration to add voice preference columns to users table

-- Add voice_id column (stores the iOS/Android voice identifier)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS voice_id VARCHAR(200);

-- Add voice_name column (stores the human-readable voice name)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS voice_name VARCHAR(100);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_voice_id ON users(voice_id);

-- Add comments
COMMENT ON COLUMN users.voice_id IS 'Text-to-speech voice identifier (e.g., com.apple.ttsbundle.Samantha-compact)';
COMMENT ON COLUMN users.voice_name IS 'Human-readable voice name (e.g., Samantha (Enhanced))';

-- Verify columns
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('voice_id', 'voice_name')
ORDER BY column_name;

