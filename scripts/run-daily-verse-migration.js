const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runDailyVerseMigration() {
  console.log('🚀 Starting Daily Verse Migration...');
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../config/daily-verse-migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration SQL loaded from:', migrationPath);
    
    // Split SQL statements by semicolon
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
        console.log(`Statement preview: ${statement.substring(0, 100)}...`);
        try {
          const result = await pool.query(statement);
          console.log(`✅ Statement ${i + 1} executed successfully`);
          if (result.rows && result.rows.length > 0) {
            console.table(result.rows);
          }
        } catch (stmtError) {
          console.error(`❌ Error in statement ${i + 1}:`, stmtError.message);
          if (stmtError.message.includes('already exists')) {
            console.log(`⚠️  Statement ${i + 1} skipped (already exists)`);
          } else {
            throw stmtError;
          }
        }
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   - user_verse_history table created');
    console.log('   - Tracks daily inspirational verses (separate from prayer verses)');
    console.log('   - Prevents showing same verse twice to user');
    console.log('\n🎯 New endpoint available:');
    console.log('   - GET /api/bible/daily-verse (requires auth token)');
    console.log('\n📊 Verse Collections:');
    console.log('   - Daily Prayer: /api/bible/daily-prayer (prayer-focused verses)');
    console.log('   - Daily Verse: /api/bible/daily-verse (inspirational verses)');
    console.log('   - Daily Reflection: /api/bible/daily-reflection (reflection themes)');
    
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
runDailyVerseMigration();

