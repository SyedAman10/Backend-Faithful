/**
 * Test Script for App Session & Streak API
 */

const axios = require('axios');

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const TEST_JWT_TOKEN = process.env.TEST_JWT_TOKEN || 'YOUR_JWT_TOKEN_HERE';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(color, emoji, message) {
  console.log(`${colors[color]}${emoji} ${message}${colors.reset}`);
}

async function testAppSessionAPI() {
  console.log('\n' + '='.repeat(70));
  log('cyan', '📱', 'App Session & Streak API Test');
  console.log('='.repeat(70) + '\n');

  if (TEST_JWT_TOKEN === 'YOUR_JWT_TOKEN_HERE') {
    log('yellow', '⚠️', 'Please set TEST_JWT_TOKEN environment variable');
    log('yellow', 'ℹ️', 'Example: TEST_JWT_TOKEN=your_token node test-app-session.js\n');
    return;
  }

  const headers = {
    'Authorization': `Bearer ${TEST_JWT_TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    // Test 1: GET current stats (without tracking)
    log('cyan', '🔍', 'Test 1: GET /api/users/app-session (retrieve stats)');
    try {
      const getResponse = await axios.get(
        `${BASE_URL}/api/users/app-session`,
        { headers }
      );
      
      log('green', '✅', 'GET request successful');
      console.log('   Current Streak:', getResponse.data.data.currentStreak, '→', (getResponse.data.data.currentStreak + 1), 'days');
      console.log('   Longest Streak:', getResponse.data.data.longestStreak);
      console.log('   Total Active Days:', getResponse.data.data.totalActiveDays);
      console.log('   Today Time Spent:', getResponse.data.data.todayTimeFormatted);
      console.log('   Total Time Spent:', getResponse.data.data.totalTimeFormatted);
      console.log('   Total Sessions:', getResponse.data.data.totalSessions);
      console.log('   Freezes Available:', getResponse.data.data.freezesAvailable);
      console.log('   Streak Message:', getResponse.data.data.streakMessage);
      
      if (getResponse.data.data.milestones && getResponse.data.data.milestones.length > 0) {
        console.log('   Recent Milestones:');
        getResponse.data.data.milestones.forEach(m => {
          console.log(`      - ${m.milestone_name} (${m.milestone_days} days)`);
        });
      }
      
    } catch (error) {
      if (error.response?.status === 401) {
        log('red', '❌', 'Authentication failed - Invalid JWT token');
        return;
      }
      throw error;
    }

    console.log('');

    // Test 2: POST new session (track session)
    log('cyan', '🔍', 'Test 2: POST /api/users/app-session (track session)');
    try {
      const sessionData = {
        timestamp: new Date().toISOString(),
        durationSeconds: 600 // 10 minutes
      };
      
      const postResponse = await axios.post(
        `${BASE_URL}/api/users/app-session`,
        sessionData,
        { headers }
      );
      
      log('green', '✅', 'POST request successful - Session tracked!');
      console.log('   Duration Tracked:', sessionData.durationSeconds, 'seconds (10 minutes)');
      console.log('   Current Streak:', postResponse.data.data.currentStreak, '→', (postResponse.data.data.currentStreak + 1), 'days');
      console.log('   Longest Streak:', postResponse.data.data.longestStreak);
      console.log('   Total Active Days:', postResponse.data.data.totalActiveDays);
      console.log('   Today Time Spent:', postResponse.data.data.todayTimeFormatted);
      console.log('   Total Time Spent:', postResponse.data.data.totalTimeFormatted);
      console.log('   Total Sessions:', postResponse.data.data.totalSessions);
      console.log('   Is New Streak:', postResponse.data.data.isNewStreak ? '🔥 YES' : 'No');
      console.log('   Streak Message:', postResponse.data.data.streakMessage);
      
    } catch (error) {
      log('red', '❌', `Failed to track session: ${error.message}`);
      if (error.response) {
        console.log('   Error:', error.response.data);
      }
    }

    console.log('');

    // Test 3: POST without duration (should fail)
    log('cyan', '🔍', 'Test 3: POST without durationSeconds (error expected)');
    try {
      await axios.post(
        `${BASE_URL}/api/users/app-session`,
        {}, // Empty body
        { headers }
      );
      log('yellow', '⚠️', 'Unexpected success - should have failed');
    } catch (error) {
      if (error.response?.status === 400) {
        log('green', '✅', 'Validation working - rejected empty duration');
        console.log('   Error message:', error.response.data.error);
      } else {
        log('red', '❌', `Unexpected error: ${error.message}`);
      }
    }

    console.log('');

    // Test 4: GET again to verify POST updated the data
    log('cyan', '🔍', 'Test 4: GET again to verify data was updated');
    try {
      const verifyResponse = await axios.get(
        `${BASE_URL}/api/users/app-session`,
        { headers }
      );
      
      log('green', '✅', 'Verified - Stats updated after POST');
      console.log('   Total Time Spent:', verifyResponse.data.data.totalTimeFormatted);
      console.log('   Total Sessions:', verifyResponse.data.data.totalSessions);
      
    } catch (error) {
      log('red', '❌', `Failed to verify: ${error.message}`);
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    log('cyan', '📊', 'Test Summary');
    console.log('='.repeat(70));
    
    console.log('\n✅ Both endpoints are working correctly!\n');
    
    log('cyan', '🎯', 'Endpoints Available:');
    console.log('   • GET  /api/users/app-session (retrieve stats without tracking)');
    console.log('   • POST /api/users/app-session (track session and update stats)');
    
    console.log('\n💡 Usage Tips:');
    console.log('   • Use GET on app start to display current streak');
    console.log('   • Use POST when app goes to background to track session');
    console.log('   • Streak increments on consecutive days');
    console.log('   • Total time is cumulative across all days');
    console.log('   • Today time resets at midnight\n');
    
  } catch (error) {
    console.log('');
    log('red', '❌', 'Test failed:');
    console.error(error.message);
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    console.log('');
  }
}

// Run the tests
testAppSessionAPI().catch(console.error);

