const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

// Test function to get OAuth URL
async function testGetOAuthUrl(platform = 'web') {
  try {
    console.log(`\n🔗 Testing OAuth URL for ${platform}...`);
    
    const response = await fetch(`${BASE_URL}/api/auth/google/url?platform=${platform}`);
    const data = await response.json();
    
    if (data.url) {
      console.log('✅ OAuth URL generated successfully!');
      console.log('📱 URL:', data.url);
      console.log('\n💡 To test:');
      console.log('1. Open this URL in your browser');
      console.log('2. Complete Google OAuth flow');
      console.log('3. You\'ll be redirected with user data');
    } else {
      console.log('❌ Failed to get OAuth URL:', data);
    }
  } catch (error) {
    console.error('❌ Error testing OAuth URL:', error.message);
  }
}

// Test function to check server health
async function testHealth() {
  try {
    console.log('\n🏥 Testing server health...');
    
    const response = await fetch(`${BASE_URL}/api/health`);
    const data = await response.json();
    
    if (data.status === 'OK') {
      console.log('✅ Server is running and healthy!');
      console.log('📊 Server info:', data);
    } else {
      console.log('❌ Server health check failed:', data);
    }
  } catch (error) {
    console.error('❌ Error testing health:', error.message);
  }
}

// Test function to verify token (if you have one)
async function testTokenVerification(token) {
  if (!token) {
    console.log('\n🔐 No token provided for verification test');
    return;
  }
  
  try {
    console.log('\n🔐 Testing token verification...');
    
    const response = await fetch(`${BASE_URL}/api/auth/verify`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Token is valid!');
      console.log('👤 User info:', data.user);
    } else {
      console.log('❌ Token verification failed:', data);
    }
  } catch (error) {
    console.error('❌ Error testing token verification:', error.message);
  }
}

// Main test function
async function runTests() {
  console.log('🧪 Starting Google Auth Tests...\n');
  
  // Test server health first
  await testHealth();
  
  // Test OAuth URL generation for different platforms
  await testGetOAuthUrl('web');
  await testGetOAuthUrl('mobile');
  
  // Test token verification (if you have a token)
  // await testTokenVerification('your_jwt_token_here');
  
  console.log('\n🎉 Tests completed!');
  console.log('\n📚 Next steps:');
  console.log('1. Make sure your .env file is configured');
  console.log('2. Start your server with: npm run dev');
  console.log('3. Open the OAuth URLs in your browser to test the full flow');
  console.log('4. Check the README.md for detailed testing instructions');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testGetOAuthUrl,
  testHealth,
  testTokenVerification,
  runTests
};
