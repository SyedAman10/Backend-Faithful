/**
 * Cleanup Test Study Groups Script
 * 
 * This script deletes all study groups from the database.
 * Use this to clean up test data.
 * 
 * WARNING: This will permanently delete all study groups!
 * 
 * Usage: node scripts/cleanup-test-study-groups.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function cleanupTestStudyGroups() {
  console.log('🧹 Starting cleanup of test study groups...\n');

  try {
    // Get count before deletion
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM study_groups WHERE is_active = true'
    );
    const totalBefore = parseInt(countResult.rows[0].total);

    console.log(`📊 Found ${totalBefore} active study groups\n`);

    if (totalBefore === 0) {
      console.log('✅ No study groups to clean up!');
      return;
    }

    // Ask for confirmation
    console.log('⚠️  This will DELETE ALL study groups!');
    console.log('⚠️  This action cannot be undone!');
    console.log('\nIf you want to proceed, run this script with --confirm flag:\n');
    console.log('  node scripts/cleanup-test-study-groups.js --confirm\n');

    // Check for confirmation flag
    if (!process.argv.includes('--confirm')) {
      console.log('❌ Aborted. No changes made.');
      return;
    }

    console.log('🗑️  Proceeding with deletion...\n');

    // Start transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Delete recurring meeting instances
      const recurringResult = await client.query('DELETE FROM recurring_meetings RETURNING *');
      console.log(`✅ Deleted ${recurringResult.rowCount} recurring meeting instances`);

      // Deactivate all study group members
      const membersResult = await client.query(
        'UPDATE study_group_members SET is_active = false WHERE is_active = true RETURNING *'
      );
      console.log(`✅ Deactivated ${membersResult.rowCount} study group memberships`);

      // Soft delete all study groups
      const groupsResult = await client.query(
        'UPDATE study_groups SET is_active = false WHERE is_active = true RETURNING id, title, creator_id'
      );
      console.log(`✅ Deactivated ${groupsResult.rowCount} study groups`);

      // Optional: Hard delete (completely remove from database)
      // Uncomment these lines if you want to completely remove the data
      /*
      await client.query('DELETE FROM recurring_meetings');
      await client.query('DELETE FROM study_group_members');
      await client.query('DELETE FROM study_groups');
      console.log('✅ Hard deleted all study group data');
      */

      await client.query('COMMIT');

      console.log('\n✅ Cleanup completed successfully!');
      console.log(`\n📊 Summary:`);
      console.log(`   - Study groups deactivated: ${groupsResult.rowCount}`);
      console.log(`   - Memberships deactivated: ${membersResult.rowCount}`);
      console.log(`   - Recurring instances deleted: ${recurringResult.rowCount}`);
      console.log('\n💡 Note: Study groups are soft-deleted (is_active = false)');
      console.log('   Google Calendar events are NOT deleted automatically.');
      console.log('   You may need to clean them up manually from Google Calendar.\n');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

// Run the cleanup
cleanupTestStudyGroups();

