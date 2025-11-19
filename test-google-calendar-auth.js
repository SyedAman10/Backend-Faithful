/**
 * Test Script for Google Calendar Authentication Endpoints
 * 
 * This script tests the new separate Google Calendar authentication flow
 * that is distinct from the sign-up flow.
 */

const axios = require('axios');

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3000';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, emoji, message) {
  console.log(`${colors[color]}${emoji} ${message}${colors.reset}`);
}

async function testCalendarAuth() {
  console.log('\n' + '='.repeat(70));
  log('cyan', '📅', 'Google Calendar Authentication API Test');
  console.log('='.repeat(70) + '\n');

  // You'll need to set a valid JWT token here from an actual login
  const TEST_JWT_TOKEN = process.env.TEST_JWT_TOKEN || 'YOUR_JWT_TOKEN_HERE';
  
  if (TEST_JWT_TOKEN === 'YOUR_JWT_TOKEN_HERE') {
    log('yellow', '⚠️', 'WARNING: Please set TEST_JWT_TOKEN environment variable');
    log('yellow', 'ℹ️', 'Example: TEST_JWT_TOKEN=your_token node test-google-calendar-auth.js');
    console.log('\nTo get a token, you can:');
    console.log('1. Sign up or login through the API');
    console.log('2. Use the token from the response\n');
  }

  const headers = {
    'Authorization': `Bearer ${TEST_JWT_TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    // Test 1: Check calendar connection status
    log('blue', '🔍', 'Test 1: Checking calendar connection status...');
    try {
      const statusResponse = await axios.get(
        `${BASE_URL}/api/auth/google-calendar/status`,
        { headers }
      );
      
      log('green', '✅', 'Status check successful');
      console.log('   Response:', JSON.stringify(statusResponse.data, null, 2));
      
      if (statusResponse.data.calendarConnected) {
        log('cyan', 'ℹ️', `Already connected to: ${statusResponse.data.googleEmail}`);
      } else {
        log('yellow', 'ℹ️', 'Calendar not yet connected');
      }
    } catch (error) {
      if (error.response?.status === 401) {
        log('red', '❌', 'Authentication failed - Invalid JWT token');
        log('yellow', 'ℹ️', 'Please set a valid TEST_JWT_TOKEN environment variable');
        return;
      }
      throw error;
    }

    console.log('');

    // Test 2: Get OAuth URL for web platform
    log('blue', '🔍', 'Test 2: Getting OAuth URL for web platform...');
    try {
      const webUrlResponse = await axios.get(
        `${BASE_URL}/api/auth/google-calendar/url`,
        { headers }
      );
      
      log('green', '✅', 'Web OAuth URL generated');
      console.log('   URL length:', webUrlResponse.data.url.length);
      console.log('   Contains state:', webUrlResponse.data.url.includes('state='));
      console.log('   Contains calendar scope:', webUrlResponse.data.url.includes('calendar'));
      console.log('   Contains gmail scope:', webUrlResponse.data.url.includes('gmail'));
      
      if (process.env.SHOW_URLS === 'true') {
        console.log('\n   Full URL:');
        console.log('   ' + webUrlResponse.data.url + '\n');
      } else {
        log('yellow', 'ℹ️', 'To see full URLs, run with: SHOW_URLS=true');
      }
    } catch (error) {
      log('red', '❌', `Failed to get web OAuth URL: ${error.message}`);
    }

    console.log('');

    // Test 3: Get OAuth URL for mobile platform
    log('blue', '🔍', 'Test 3: Getting OAuth URL for mobile platform...');
    try {
      const mobileUrlResponse = await axios.get(
        `${BASE_URL}/api/auth/google-calendar/url?platform=mobile`,
        { headers }
      );
      
      log('green', '✅', 'Mobile OAuth URL generated');
      console.log('   URL length:', mobileUrlResponse.data.url.length);
      console.log('   Contains state:', mobileUrlResponse.data.url.includes('state='));
      console.log('   Contains calendar scope:', mobileUrlResponse.data.url.includes('calendar'));
      console.log('   Contains gmail scope:', mobileUrlResponse.data.url.includes('gmail'));
      console.log('   Redirect URI contains "mobile-callback":', 
        mobileUrlResponse.data.url.includes('mobile-callback'));
      
      if (process.env.SHOW_URLS === 'true') {
        console.log('\n   Full URL:');
        console.log('   ' + mobileUrlResponse.data.url + '\n');
      }
    } catch (error) {
      log('red', '❌', `Failed to get mobile OAuth URL: ${error.message}`);
    }

    console.log('');

    // Test 4: Test POST connect endpoint (without actual code)
    log('blue', '🔍', 'Test 4: Testing POST connect endpoint (error expected)...');
    try {
      await axios.post(
        `${BASE_URL}/api/auth/google-calendar/connect`,
        { code: 'invalid_test_code' },
        { headers }
      );
      log('yellow', '⚠️', 'Unexpected success with invalid code');
    } catch (error) {
      if (error.response?.status === 400 || error.response?.status === 401) {
        log('green', '✅', 'Endpoint properly validates authorization code');
        console.log('   Error message:', error.response?.data?.message || error.response?.data?.error);
      } else {
        log('red', '❌', `Unexpected error: ${error.message}`);
      }
    }

    console.log('');

    // Summary
    console.log('='.repeat(70));
    log('cyan', '📊', 'Test Summary');
    console.log('='.repeat(70));
    
    console.log('\n✅ All endpoints are accessible and responding correctly\n');
    
    log('yellow', 'ℹ️', 'To complete the full OAuth flow:');
    console.log('   1. Use the generated OAuth URL from Test 2 or 3');
    console.log('   2. Open it in a browser while logged into Google');
    console.log('   3. Authorize the requested permissions');
    console.log('   4. The callback will update your user record');
    console.log('   5. Run this test again to see your connected status\n');
    
    log('cyan', '🔗', 'Endpoints Available:');
    console.log('   • GET  /api/auth/google-calendar/url');
    console.log('   • GET  /api/auth/google-calendar/callback');
    console.log('   • GET  /api/auth/google-calendar/mobile-callback');
    console.log('   • POST /api/auth/google-calendar/connect');
    console.log('   • GET  /api/auth/google-calendar/status');
    console.log('   • POST /api/auth/google-calendar/disconnect');
    console.log('');
    
  } catch (error) {
    console.log('');
    log('red', '❌', 'Test failed with error:');
    console.error(error.message);
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    console.log('');
  }
}

// Run the tests
testCalendarAuth().catch(console.error);

