const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runCalendarMigration() {
  console.log('🚀 Starting Google Calendar Connection Migration...');
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../config/calendar-connection-migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration SQL loaded from:', migrationPath);
    
    // Split SQL statements by semicolon (excluding comments)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📊 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        console.log(`\n⚙️  Executing statement ${i + 1}/${statements.length}...`);
        try {
          const result = await pool.query(statement);
          console.log(`✅ Statement ${i + 1} executed successfully`);
          if (result.rows && result.rows.length > 0) {
            console.log('📋 Result:', result.rows);
          }
        } catch (stmtError) {
          // Some statements might fail if columns already exist, that's OK
          if (stmtError.message.includes('already exists')) {
            console.log(`⚠️  Statement ${i + 1} skipped (already exists)`);
          } else {
            throw stmtError;
          }
        }
      }
    }
    
    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    const verifyResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('google_calendar_connected', 'google_email', 'google_access_token', 'google_refresh_token', 'google_meet_access')
      ORDER BY ordinal_position
    `);
    
    console.log('\n📊 Current Google-related columns in users table:');
    console.table(verifyResult.rows);
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   - google_calendar_connected: Tracks explicit calendar connection');
    console.log('   - google_email: Stores actual Gmail address from OAuth');
    console.log('\n🎯 New endpoints available:');
    console.log('   - GET  /api/auth/google-calendar/url (requires auth token)');
    console.log('   - GET  /api/auth/google-calendar/callback');
    console.log('   - GET  /api/auth/google-calendar/mobile-callback');
    console.log('   - POST /api/auth/google-calendar/connect (requires auth token)');
    console.log('   - GET  /api/auth/google-calendar/status (requires auth token)');
    console.log('   - POST /api/auth/google-calendar/disconnect (requires auth token)');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    // Close the database connection
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the migration
runCalendarMigration();

