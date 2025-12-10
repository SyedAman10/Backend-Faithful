const { pool } = require('../config/database');

async function resetDailyContent() {
    try {
        console.log('🔄 Resetting daily content history...');

        // Delete today's verse history
        const verseResult = await pool.query('DELETE FROM user_verse_history');
        console.log(`✅ Cleared ${verseResult.rowCount} entries from user_verse_history`);

        // Delete today's prayer history
        const prayerResult = await pool.query('DELETE FROM user_prayer_history');
        console.log(`✅ Cleared ${prayerResult.rowCount} entries from user_prayer_history`);

        console.log('🎉 Daily content reset successfully! New requests will generate fresh content.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error resetting daily content:', error);
        process.exit(1);
    }
}

resetDailyContent();
