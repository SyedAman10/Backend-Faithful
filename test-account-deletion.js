/**
 * Test script for Account Deletion Endpoint
 * 
 * This script helps test the DELETE /api/users/account endpoint
 * 
 * Usage:
 *   node test-account-deletion.js <jwt_token>
 * 
 * Example:
 *   node test-account-deletion.js eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 */

require('dotenv').config();
const { pool } = require('./config/database');

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.magenta}${msg}${colors.reset}\n`)
};

/**
 * Check if user exists and get their data counts
 */
async function getUserDataSummary(userId) {
  try {
    const queries = [
      { name: 'User Record', query: 'SELECT COUNT(*) FROM users WHERE id = $1' },
      { name: 'Prayer Requests', query: 'SELECT COUNT(*) FROM prayer_requests WHERE user_id = $1' },
      { name: 'Prayer Responses', query: 'SELECT COUNT(*) FROM prayer_responses WHERE user_id = $1' },
      { name: 'Study Groups (Created)', query: 'SELECT COUNT(*) FROM study_groups WHERE creator_id = $1' },
      { name: 'Study Group Memberships', query: 'SELECT COUNT(*) FROM study_group_members WHERE user_id = $1' },
      { name: 'Join Requests', query: 'SELECT COUNT(*) FROM study_group_join_requests WHERE user_id = $1' },
      { name: 'Prayer History', query: 'SELECT COUNT(*) FROM user_prayer_history WHERE user_id = $1' },
      { name: 'Reflection History', query: 'SELECT COUNT(*) FROM user_reflection_history WHERE user_id = $1' },
      { name: 'Verse History', query: 'SELECT COUNT(*) FROM user_verse_history WHERE user_id = $1' },
      { name: 'Prayer Notes', query: 'SELECT COUNT(*) FROM user_prayer_notes WHERE user_id = $1' },
      { name: 'Daily Activities', query: 'SELECT COUNT(*) FROM user_daily_activities WHERE user_id = $1' },
      { name: 'User Sessions', query: 'SELECT COUNT(*) FROM user_sessions WHERE user_id = $1' },
    ];

    // Check for optional tables
    const optionalQueries = [
      { name: 'User XP', query: 'SELECT COUNT(*) FROM user_xp WHERE user_id = $1' },
      { name: 'Daily Goals', query: 'SELECT COUNT(*) FROM user_daily_goals WHERE user_id = $1' },
      { name: 'Activities Log', query: 'SELECT COUNT(*) FROM user_activities_log WHERE user_id = $1' },
      { name: 'Usage Stats', query: 'SELECT COUNT(*) FROM user_usage_stats WHERE user_id = $1' },
      { name: 'Streaks', query: 'SELECT COUNT(*) FROM user_streaks WHERE user_id = $1' },
      { name: 'Streak Milestones', query: 'SELECT COUNT(*) FROM streak_milestones WHERE user_id = $1' },
    ];

    const summary = {};

    // Execute all queries
    for (const { name, query } of queries) {
      try {
        const result = await pool.query(query, [userId]);
        summary[name] = parseInt(result.rows[0].count);
      } catch (error) {
        log.warning(`Could not query ${name}: ${error.message}`);
        summary[name] = 'N/A';
      }
    }

    // Execute optional queries
    for (const { name, query } of optionalQueries) {
      try {
        const result = await pool.query(query, [userId]);
        summary[name] = parseInt(result.rows[0].count);
      } catch (error) {
        summary[name] = 'N/A (table may not exist)';
      }
    }

    return summary;
  } catch (error) {
    log.error(`Error getting user data summary: ${error.message}`);
    return null;
  }
}

/**
 * Verify JWT token and extract user ID
 */
function verifyToken(token) {
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.userId;
  } catch (error) {
    log.error(`Invalid JWT token: ${error.message}`);
    return null;
  }
}

/**
 * Test the account deletion endpoint
 */
async function testAccountDeletion(token) {
  log.section('🧪 Testing Account Deletion Endpoint');

  // 1. Verify token
  log.info('Step 1: Verifying JWT token...');
  const userId = verifyToken(token);
  
  if (!userId) {
    log.error('Token verification failed. Exiting.');
    return;
  }
  
  log.success(`Token valid. User ID: ${userId}`);

  // 2. Get user data summary BEFORE deletion
  log.section('📊 Data Summary BEFORE Deletion');
  const beforeSummary = await getUserDataSummary(userId);
  
  if (!beforeSummary) {
    log.error('Could not get user data summary. Exiting.');
    return;
  }

  // Check if user exists
  if (beforeSummary['User Record'] === 0) {
    log.error(`User with ID ${userId} does not exist in database.`);
    return;
  }

  log.success('User exists in database');
  console.log('\nData counts:');
  Object.entries(beforeSummary).forEach(([key, value]) => {
    const countStr = typeof value === 'number' ? `${value}` : value;
    console.log(`  ${key}: ${countStr}`);
  });

  // 3. Ask for confirmation
  log.section('⚠️  Confirmation Required');
  log.warning('This will PERMANENTLY DELETE the user account and all data!');
  log.warning('This action CANNOT be undone!');
  
  console.log('\nTo proceed, type: YES DELETE');
  console.log('To cancel, press Ctrl+C or type anything else');
  console.log('');

  // Wait for user input
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('Your choice: ', async (answer) => {
      rl.close();

      if (answer.trim() !== 'YES DELETE') {
        log.info('Deletion cancelled by user.');
        resolve();
        return;
      }

      // 4. Call the deletion endpoint (simulate via direct database operation)
      log.section('🗑️  Deleting Account...');
      
      try {
        const axios = require('axios');
        const baseURL = process.env.API_BASE_URL || 'http://localhost:3000';
        
        log.info(`Calling: DELETE ${baseURL}/api/users/account`);
        
        const response = await axios.delete(`${baseURL}/api/users/account`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.data.success) {
          log.success('Account deletion successful!');
        } else {
          log.error('Account deletion failed.');
        }

        console.log('\nResponse:', JSON.stringify(response.data, null, 2));

      } catch (error) {
        if (error.response) {
          log.error(`HTTP ${error.response.status}: ${error.response.statusText}`);
          console.log('Response:', JSON.stringify(error.response.data, null, 2));
        } else if (error.code === 'ECONNREFUSED') {
          log.error('Cannot connect to server. Is the server running?');
          log.info('Expected server URL: ' + (process.env.API_BASE_URL || 'http://localhost:3000'));
        } else {
          log.error(`Error: ${error.message}`);
        }
      }

      // 5. Verify deletion
      log.section('🔍 Verifying Deletion...');
      const afterSummary = await getUserDataSummary(userId);

      if (!afterSummary) {
        log.error('Could not verify deletion.');
        resolve();
        return;
      }

      console.log('\nData counts after deletion:');
      let allZero = true;
      Object.entries(afterSummary).forEach(([key, value]) => {
        const countStr = typeof value === 'number' ? `${value}` : value;
        const isDeleted = value === 0 || value === 'N/A' || value === 'N/A (table may not exist)';
        const icon = isDeleted ? '✓' : '✗';
        const color = isDeleted ? colors.green : colors.red;
        console.log(`  ${color}${icon}${colors.reset} ${key}: ${countStr}`);
        if (typeof value === 'number' && value !== 0) {
          allZero = false;
        }
      });

      console.log('');
      if (allZero) {
        log.success('All user data successfully deleted! ✓');
      } else {
        log.error('Some data still remains in the database! ✗');
      }

      resolve();
    });
  });
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node test-account-deletion.js <jwt_token>');
    console.log('');
    console.log('Example:');
    console.log('  node test-account-deletion.js eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
    console.log('');
    console.log('Environment Variables:');
    console.log('  API_BASE_URL - Base URL of your API (default: http://localhost:3000)');
    console.log('  JWT_SECRET - JWT secret for token verification');
    console.log('  DATABASE_URL - PostgreSQL database connection string');
    process.exit(1);
  }

  const token = args[0];

  try {
    await testAccountDeletion(token);
  } catch (error) {
    log.error(`Unexpected error: ${error.message}`);
    console.error(error);
  } finally {
    await pool.end();
    log.info('Database connection closed.');
  }
}

// Check if required dependencies are installed
try {
  require('axios');
} catch (error) {
  console.error('Missing dependency: axios');
  console.error('Install it with: npm install axios');
  process.exit(1);
}

main();
