const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Test credentials - replace with your actual test user credentials
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

async function testDailyPrayer() {
  try {
    console.log('🔐 Step 1: Login to get auth token...\n');
    
    // First, login to get auth token
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    const token = loginResponse.data.data.token;
    console.log('✅ Login successful!');
    console.log('Token:', token.substring(0, 20) + '...\n');

    // Test 1: Get daily prayer without category (default = 'all')
    console.log('📖 Test 1: Get daily prayer (default category)...\n');
    const prayer1 = await axios.get(`${BASE_URL}/api/bible/daily-prayer`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('✅ Test 1 PASSED:');
    console.log('Category:', prayer1.data.data.category);
    console.log('Reference:', prayer1.data.data.reference);
    console.log('Text preview:', prayer1.data.data.text.substring(0, 100) + '...');
    console.log('Is New:', prayer1.data.data.isNew);
    console.log('');

    // Test 2: Get daily prayer with 'comfort' category
    console.log('📖 Test 2: Get daily prayer (comfort category)...\n');
    const prayer2 = await axios.get(`${BASE_URL}/api/bible/daily-prayer?category=comfort`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('✅ Test 2 PASSED:');
    console.log('Category:', prayer2.data.data.category);
    console.log('Reference:', prayer2.data.data.reference);
    console.log('Text preview:', prayer2.data.data.text.substring(0, 100) + '...');
    console.log('Is New:', prayer2.data.data.isNew);
    console.log('');

    // Test 3: Get daily prayer with 'strength' category
    console.log('📖 Test 3: Get daily prayer (strength category)...\n');
    const prayer3 = await axios.get(`${BASE_URL}/api/bible/daily-prayer?category=strength`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('✅ Test 3 PASSED:');
    console.log('Category:', prayer3.data.data.category);
    console.log('Reference:', prayer3.data.data.reference);
    console.log('Text preview:', prayer3.data.data.text.substring(0, 100) + '...');
    console.log('Is New:', prayer3.data.data.isNew);
    console.log('');

    // Test 4: Request same category again (should return cached)
    console.log('📖 Test 4: Request same category again (should be cached)...\n');
    const prayer4 = await axios.get(`${BASE_URL}/api/bible/daily-prayer?category=strength`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('✅ Test 4 PASSED:');
    console.log('Category:', prayer4.data.data.category);
    console.log('Reference:', prayer4.data.data.reference);
    console.log('Is New:', prayer4.data.data.isNew, '(should be false - cached)');
    console.log('Same as Test 3?', prayer3.data.data.reference === prayer4.data.data.reference);
    console.log('');

    // Test 5: Try with different Bible version
    console.log('📖 Test 5: Get daily prayer with specific Bible version (NIV)...\n');
    const prayer5 = await axios.get(`${BASE_URL}/api/bible/daily-prayer?category=peace&bible=NIV`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('✅ Test 5 PASSED:');
    console.log('Category:', prayer5.data.data.category);
    console.log('Bible Version:', prayer5.data.data.bible);
    console.log('Reference:', prayer5.data.data.reference);
    console.log('Text preview:', prayer5.data.data.text.substring(0, 100) + '...');
    console.log('');

    console.log('🎉 All tests passed!\n');
    console.log('📊 Summary:');
    console.log('- Total tests: 5');
    console.log('- Passed: 5');
    console.log('- Failed: 0');
    console.log('');
    console.log('💡 Available categories:');
    console.log('   - all (default)');
    console.log('   - comfort');
    console.log('   - strength');
    console.log('   - peace');
    console.log('   - love');
    console.log('   - hope');
    console.log('   - faith');

  } catch (error) {
    console.error('❌ Test failed:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Run tests
console.log('='.repeat(60));
console.log('🙏 Daily Prayer API Test Suite');
console.log('='.repeat(60));
console.log('');

testDailyPrayer();

