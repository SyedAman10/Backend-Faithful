// Test script for recurring meetings API
// This script demonstrates how to create recurring study groups

const axios = require('axios');

const BASE_URL = 'https://1befd1562ae3.ngrok-free.app'; // Replace with your actual backend URL

// Example: Create a weekly study group on Wednesday at 10 PM
const createWeeklyStudyGroup = async (authToken) => {
  try {
    const response = await axios.post(`${BASE_URL}/api/study-groups/create-recurring`, {
      title: 'Weekly JavaScript Study Group',
      description: 'Every Wednesday at 10 PM - Advanced JavaScript concepts and problem solving',
      maxParticipants: 15,
      startTime: '2024-01-24T22:00:00.000Z', // Wednesday 10 PM UTC
      durationMinutes: 90,
      attendeeEmails: ['student1@example.com', 'student2@example.com'],
      frequency: 'weekly',
      interval: 1, // every week
      daysOfWeek: [3], // Wednesday (0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday)
      endDate: '2024-12-31', // Optional: end of year
      timeZone: 'UTC'
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Weekly study group created:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to create weekly study group:', error.response?.data || error.message);
  }
};

// Example: Create a daily study group
const createDailyStudyGroup = async (authToken) => {
  try {
    const response = await axios.post(`${BASE_URL}/api/study-groups/create-recurring`, {
      title: 'Daily Morning Study Session',
      description: 'Every morning at 7 AM - Quick review and daily goals',
      maxParticipants: 20,
      startTime: '2024-01-24T07:00:00.000Z', // 7 AM UTC
      durationMinutes: 30,
      attendeeEmails: ['morning@example.com'],
      frequency: 'daily',
      interval: 1, // every day
      timeZone: 'UTC'
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Daily study group created:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to create daily study group:', error.response?.data || error.message);
  }
};

// Example: Create a bi-weekly study group on multiple days
const createBiWeeklyStudyGroup = async (authToken) => {
  try {
    const response = await axios.post(`${BASE_URL}/api/study-groups/create-recurring`, {
      title: 'Bi-Weekly Advanced Topics',
      description: 'Every other week on Monday and Thursday - Advanced programming concepts',
      maxParticipants: 12,
      startTime: '2024-01-22T19:00:00.000Z', // Monday 7 PM UTC
      durationMinutes: 120,
      attendeeEmails: ['advanced@example.com'],
      frequency: 'weekly',
      interval: 2, // every 2 weeks
      daysOfWeek: [1, 4], // Monday and Thursday
      timeZone: 'UTC'
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Bi-weekly study group created:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to create bi-weekly study group:', error.response?.data || error.message);
  }
};

// Example: Create a monthly study group
const createMonthlyStudyGroup = async (authToken) => {
  try {
    const response = await axios.post(`${BASE_URL}/api/study-groups/create-recurring`, {
      title: 'Monthly Project Review',
      description: 'First Saturday of every month - Project presentations and feedback',
      maxParticipants: 25,
      startTime: '2024-02-03T14:00:00.000Z', // First Saturday 2 PM UTC
      durationMinutes: 180,
      attendeeEmails: ['projects@example.com'],
      frequency: 'monthly',
      interval: 1, // every month
      timeZone: 'UTC'
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Monthly study group created:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to create monthly study group:', error.response?.data || error.message);
  }
};

// Get upcoming recurring meetings
const getUpcomingMeetings = async (authToken) => {
  try {
    const response = await axios.get(`${BASE_URL}/api/study-groups/upcoming-recurring?limit=20`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Upcoming recurring meetings:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get upcoming meetings:', error.response?.data || error.message);
  }
};

// Main function to run all examples
const runExamples = async () => {
  console.log('🚀 Testing Recurring Meetings API');
  console.log('=====================================\n');

  // You need to get an auth token first by authenticating with Google
  const authToken = 'YOUR_AUTH_TOKEN_HERE'; // Replace with actual token

  if (authToken === 'YOUR_AUTH_TOKEN_HERE') {
    console.log('⚠️  Please replace YOUR_AUTH_TOKEN_HERE with an actual authentication token');
    console.log('   You can get this by calling the Google OAuth endpoint first\n');
    return;
  }

  console.log('1. Creating weekly study group (Wednesday 10 PM)...');
  await createWeeklyStudyGroup(authToken);

  console.log('\n2. Creating daily study group (7 AM)...');
  await createDailyStudyGroup(authToken);

  console.log('\n3. Creating bi-weekly study group (Monday & Thursday)...');
  await createBiWeeklyStudyGroup(authToken);

  console.log('\n4. Creating monthly study group (First Saturday)...');
  await createMonthlyStudyGroup(authToken);

  console.log('\n5. Getting upcoming recurring meetings...');
  await getUpcomingMeetings(authToken);

  console.log('\n✅ All examples completed!');
};

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}

module.exports = {
  createWeeklyStudyGroup,
  createDailyStudyGroup,
  createBiWeeklyStudyGroup,
  createMonthlyStudyGroup,
  getUpcomingMeetings
};
