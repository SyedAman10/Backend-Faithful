require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  console.log('🚀 Starting push notifications migration...\n');

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'config', 'push-notifications-migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!\n');

    // Verify the columns were added
    const verifyQuery = `
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'users' 
      AND column_name IN ('push_token', 'notification_settings')
      ORDER BY column_name;
    `;

    const result = await pool.query(verifyQuery);

    console.log('📊 Verification Results:');
    console.log('========================');
    
    if (result.rows.length === 0) {
      console.log('❌ No columns found! Migration may have failed.');
    } else {
      result.rows.forEach(row => {
        console.log(`✅ ${row.column_name}:`);
        console.log(`   Type: ${row.data_type}`);
        if (row.column_default) {
          console.log(`   Default: ${row.column_default.substring(0, 60)}...`);
        }
        console.log('');
      });
    }

    // Check for index
    const indexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'users' 
      AND indexname = 'idx_users_push_token';
    `;

    const indexResult = await pool.query(indexQuery);
    
    if (indexResult.rows.length > 0) {
      console.log('✅ Index idx_users_push_token created successfully');
    } else {
      console.log('⚠️  Index idx_users_push_token not found');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();

