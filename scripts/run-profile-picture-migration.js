const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runProfilePictureMigration() {
  console.log('🚀 Starting Profile Picture Migration...');
  
  try {
    const migrationPath = path.join(__dirname, '../config/profile-picture-migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration SQL loaded');
    
    // Add google_picture column
    console.log('⚙️  Adding google_picture column...');
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_picture TEXT
    `);
    console.log('✅ google_picture column added');
    
    // Add custom_picture column
    console.log('⚙️  Adding custom_picture column...');
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_picture TEXT
    `);
    console.log('✅ custom_picture column added');
    
    // Create indexes
    console.log('⚙️  Creating indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_google_picture 
      ON users(google_picture) WHERE google_picture IS NOT NULL
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_custom_picture 
      ON users(custom_picture) WHERE custom_picture IS NOT NULL
    `);
    console.log('✅ Indexes created');
    
    // Migrate existing pictures
    console.log('⚙️  Migrating existing Google pictures...');
    const migrateResult = await pool.query(`
      UPDATE users 
      SET google_picture = picture 
      WHERE google_id IS NOT NULL 
        AND picture IS NOT NULL 
        AND google_picture IS NULL
    `);
    console.log(`✅ Migrated ${migrateResult.rowCount} existing Google pictures`);
    
    // Verify columns exist
    const verify = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' 
        AND column_name IN ('picture', 'google_picture', 'custom_picture')
      ORDER BY column_name
    `);
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Profile Picture Columns:');
    console.table(verify.rows);
    
    // Get stats
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(picture) as has_picture,
        COUNT(google_picture) as has_google_picture,
        COUNT(custom_picture) as has_custom_picture
      FROM users
    `);
    
    console.log('\n📈 User Picture Statistics:');
    console.table(stats.rows);
    
    console.log('\n📝 Summary:');
    console.log('   - google_picture: Stores original Google profile picture');
    console.log('   - custom_picture: Stores user-uploaded custom pictures');
    console.log('   - picture: Legacy column (kept for backward compatibility)');
    
    console.log('\n🎯 New endpoints:');
    console.log('   POST /api/users/profile/picture - Upload custom picture');
    console.log('   DELETE /api/users/profile/picture - Remove custom picture');
    console.log('   GET /api/users/profile - Returns appropriate picture (custom > google > legacy)');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

runProfilePictureMigration();


