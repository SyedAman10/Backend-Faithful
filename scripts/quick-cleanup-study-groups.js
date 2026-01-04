/**
 * Quick Cleanup - Delete All Test Study Groups
 * 
 * This script immediately deletes all study groups.
 * No confirmation required - USE WITH CAUTION!
 * 
 * Usage: node scripts/quick-cleanup-study-groups.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function quickCleanup() {
  console.log('🧹 Quick cleanup - Deleting all study groups...\n');

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Get count before deletion
    const countResult = await client.query(
      'SELECT COUNT(*) as total FROM study_groups WHERE is_active = true'
    );
    const totalBefore = parseInt(countResult.rows[0].total);
    console.log(`📊 Found ${totalBefore} active study groups\n`);

    // Delete recurring meeting instances
    const recurringResult = await client.query('DELETE FROM recurring_meetings');
    console.log(`✅ Deleted ${recurringResult.rowCount} recurring meeting instances`);

    // Delete all study group members
    const membersResult = await client.query('DELETE FROM study_group_members');
    console.log(`✅ Deleted ${membersResult.rowCount} study group memberships`);

    // Delete all study groups
    const groupsResult = await client.query('DELETE FROM study_groups');
    console.log(`✅ Deleted ${groupsResult.rowCount} study groups`);

    await client.query('COMMIT');

    console.log('\n✅ Cleanup completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Total study groups deleted: ${groupsResult.rowCount}`);
    console.log(`   - Total memberships deleted: ${membersResult.rowCount}`);
    console.log(`   - Recurring instances deleted: ${recurringResult.rowCount}`);
    console.log('\n⚠️  Note: Google Calendar events were NOT deleted.');
    console.log('   You may see orphaned events in Google Calendar.\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Cleanup failed:', error.message);
    console.error(error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run immediately
quickCleanup();

