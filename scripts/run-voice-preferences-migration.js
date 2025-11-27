const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runVoicePreferencesMigration() {
  console.log('🚀 Starting Voice Preferences Migration...');
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../config/voice-preferences-migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration SQL loaded from:', migrationPath);
    
    // Execute the migration
    console.log('⚙️  Adding voice_id column...');
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS voice_id VARCHAR(200)`);
    console.log('✅ voice_id column added');
    
    console.log('⚙️  Adding voice_name column...');
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS voice_name VARCHAR(100)`);
    console.log('✅ voice_name column added');
    
    console.log('⚙️  Creating index...');
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_voice_id ON users(voice_id)`);
    console.log('✅ Index created');
    
    console.log('⚙️  Adding comments...');
    await pool.query(`COMMENT ON COLUMN users.voice_id IS 'Text-to-speech voice identifier (e.g., com.apple.ttsbundle.Samantha-compact)'`);
    await pool.query(`COMMENT ON COLUMN users.voice_name IS 'Human-readable voice name (e.g., Samantha (Enhanced))'`);
    console.log('✅ Comments added');
    
    // Verify
    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('voice_id', 'voice_name')
      ORDER BY column_name
    `);
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Voice preference columns:');
    console.table(result.rows);
    
    console.log('\n📝 Summary:');
    console.log('   - voice_id: VARCHAR(200) - Voice identifier');
    console.log('   - voice_name: VARCHAR(100) - Voice display name');
    console.log('\n🎯 Updated endpoints:');
    console.log('   - PUT  /api/users/preferences (now accepts voiceId and voiceName)');
    console.log('   - GET  /api/users/preferences (returns voice preferences)');
    console.log('\n📱 Example usage:');
    console.log('   PUT /api/users/preferences');
    console.log('   Body: {');
    console.log('     "voiceId": "com.apple.ttsbundle.Samantha-compact",');
    console.log('     "voiceName": "Samantha (Enhanced)"');
    console.log('   }');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the migration
runVoicePreferencesMigration();

