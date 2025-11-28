# App Session & Streak API Documentation

## Overview

Track user app sessions, calculate streaks based on consecutive days, and monitor total time spent across all sessions.

---

## 🎯 Endpoints

### 1. Track Session (POST)

**`POST /api/users/app-session`**

**Authentication:** Required (JWT token)

**Purpose:** Track app session, update streak, and calculate total time spent

---

### 2. Get Session Stats (GET)

**`GET /api/users/app-session`**

**Authentication:** Required (JWT token)

**Purpose:** Retrieve current streak and session stats WITHOUT tracking a new session

---

## 📱 POST - Track Session

### **Frontend Request:**

### **Minimum Required:**

```json
{
  "durationSeconds": 900
}
```

### **Recommended:**

```json
{
  "timestamp": "2024-11-20T08:30:00.000Z",
  "durationSeconds": 900
}
```

### **Full (Optional):**

```json
{
  "timestamp": "2024-11-20T08:30:00.000Z",
  "sessionStartTime": "2024-11-20T08:30:00.000Z",
  "sessionEndTime": "2024-11-20T08:45:00.000Z",
  "durationSeconds": 900,
  "timezone": "America/New_York"
}
```

---

## 📊 Backend Response

```json
{
  "success": true,
  "data": {
    "currentStreak": 2,                      // Consecutive days - 1
    "longestStreak": 5,                      // Best streak ever
    "totalActiveDays": 15,                   // Total days app was opened
    "lastActiveDate": "2024-11-20",         // Last activity date
    "todayTimeSpent": 3600,                 // Seconds spent today
    "todayTimeFormatted": "1h 0m",          // Human-readable format
    "totalTimeSpent": 86400,                // Total seconds across all days
    "totalTimeFormatted": "24h 0m",         // Total time formatted
    "totalSessions": 45,                     // Total sessions count
    "isNewStreak": true,                     // Did streak increase?
    "streakMessage": "🔥 3 days in a row! Keep it up!"
  },
  "message": "Session tracked successfully"
}
```

---

## 📊 GET - Retrieve Session Stats

### **Request:**

```bash
GET /api/users/app-session
Authorization: Bearer {token}
```

**No body required** - just retrieves current data

### **Response:**

```json
{
  "success": true,
  "data": {
    "currentStreak": 2,
    "longestStreak": 5,
    "totalActiveDays": 15,
    "lastActiveDate": "2024-11-20",
    "todayTimeSpent": 3600,
    "todayTimeFormatted": "1h 0m",
    "totalTimeSpent": 86400,
    "totalTimeFormatted": "24h 0m",
    "totalSessions": 45,
    "freezesAvailable": 2,
    "lastOpenedAt": "2024-11-20T08:30:00.000Z",
    "streakMessage": "🔥 3 days in a row! Keep it up!",
    "milestones": [
      {
        "milestone_days": 30,
        "milestone_name": "Monthly Master",
        "achieved_at": "2024-11-15T12:00:00.000Z",
        "reward_granted": true
      },
      {
        "milestone_days": 7,
        "milestone_name": "Week Warrior",
        "achieved_at": "2024-10-28T10:30:00.000Z",
        "reward_granted": true
      }
    ]
  },
  "message": "Session stats retrieved successfully"
}
```

### **Use Cases:**

1. **Display streak on home screen** (without tracking new session)
2. **Show stats in profile/settings**
3. **Check if user has freezes available**
4. **Load initial data when app opens**

### **Example (React Native):**

```javascript
// Load stats when app opens (without tracking session yet)
const loadUserStats = async () => {
  try {
    const response = await fetch(`${API_URL}/api/users/app-session`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('🔥 Current Streak:', data.data.currentStreak + 1, 'days');
      console.log('⏱️ Total Time:', data.data.totalTimeFormatted);
      console.log('🏆 Milestones:', data.data.milestones);
      
      // Update UI
      setStreak(data.data.currentStreak + 1);
      setTotalTime(data.data.totalTimeFormatted);
      setMilestones(data.data.milestones);
    }
  } catch (error) {
    console.error('❌ Failed to load stats:', error);
  }
};

// Call on app start
useEffect(() => {
  loadUserStats();
}, []);
```

---

## 📝 Comparison: GET vs POST

| Feature | GET /api/users/app-session | POST /api/users/app-session |
|---------|----------------------------|------------------------------|
| **Purpose** | Retrieve stats | Track new session |
| **Tracks Session** | No | Yes |
| **Updates Streak** | No | Yes |
| **Adds Time** | No | Yes |
| **Requires Body** | No | Yes (durationSeconds) |
| **Use Case** | Display current stats | Log app usage |
| **When to Use** | App start, profile view | App close, background |

---

## 🔥 Streak System Logic

### **How Streaks Work:**

| Scenario | Current Streak | Action | New Streak | Message |
|----------|---------------|---------|------------|---------|
| **First Day** | - | Create record | 0 | 🎉 Welcome! Start your streak tomorrow! |
| **Same Day (multiple opens)** | 2 | No change | 2 | 🔥 Keep going! 3 days in a row! |
| **Next Day (Day 2)** | 0 | Increment | 1 | 🔥 2 days in a row! Keep it up! |
| **Next Day (Day 3)** | 1 | Increment | 2 | 🔥 3 days in a row! Keep it up! |
| **Next Day (Day 4)** | 2 | Increment | 3 | 🔥 4 days in a row! Keep it up! |
| **Skip 1+ days** | 3 | Reset | 0 | 😔 Streak reset. Start fresh today! |

### **Streak Formula:**

```
Consecutive Days = Streak + 1

Day 1: Streak = 0 (no streak yet)
Day 2: Streak = 1 (2 consecutive days)
Day 3: Streak = 2 (3 consecutive days)
Day 4: Streak = 3 (4 consecutive days)
```

### **Examples:**

**Example 1: 3 Consecutive Days**
```
Day 1 (Nov 18): Opens app → Streak = 0, Total Days = 1
Day 2 (Nov 19): Opens app → Streak = 1, Total Days = 2
Day 3 (Nov 20): Opens app → Streak = 2, Total Days = 3

Response on Day 3:
{
  "currentStreak": 2,           // 3 consecutive days = streak 2
  "totalActiveDays": 3,
  "streakMessage": "🔥 3 days in a row! Keep it up!"
}
```

**Example 2: Skip a Day (Streak Broken)**
```
Day 1 (Nov 18): Opens app → Streak = 0
Day 2 (Nov 19): Opens app → Streak = 1
Day 3 (Nov 20): SKIPPED
Day 4 (Nov 21): Opens app → Streak = 0 (RESET)

Response on Day 4:
{
  "currentStreak": 0,
  "totalActiveDays": 3,
  "streakMessage": "😔 Streak reset. Start fresh today!"
}
```

---

## ⏱️ Total Time Calculation

### **Today's Time:**
- Resets at midnight
- Sum of all sessions today
- Example: 3 sessions of 5min, 10min, 15min = **30 minutes today**

### **Total Time (All Days):**
- **Never resets**
- Cumulative sum across all days
- Example: 
  - Day 1: 30 minutes
  - Day 2: 45 minutes
  - Day 3: 60 minutes
  - **Total: 2 hours 15 minutes (135 minutes)**

### **Example:**

```json
{
  "todayTimeSpent": 1800,          // 30 minutes today
  "todayTimeFormatted": "30m",
  "totalTimeSpent": 8100,          // 2h 15m total (all days)
  "totalTimeFormatted": "2h 15m"
}
```

---

## 🏆 Milestone Achievements

Streaks unlock special milestones:

| Days | Milestone | Reward |
|------|-----------|--------|
| 7 | Week Warrior | +1 Freeze |
| 14 | Two Week Champion | - |
| 30 | Monthly Master | +1 Freeze |
| 50 | 50 Day Superstar | +1 Freeze |
| 100 | Century Club | +2 Freezes |
| 365 | Year of Faith | +3 Freezes |

**When milestone achieved:**
```json
{
  "currentStreak": 6,
  "streakMessage": "🎉 Week Warrior! 7 days streak! +1 freeze!"
}
```

---

## 📱 Frontend Implementation

### **React Native - App State Tracking**

```javascript
import { AppState } from 'react-native';

let appStartTime = null;

// Track app state changes
AppState.addEventListener('change', async (nextAppState) => {
  if (nextAppState === 'active') {
    // App opened
    appStartTime = new Date();
    console.log('📱 App opened at:', appStartTime);
    
  } else if (nextAppState === 'background' || nextAppState === 'inactive') {
    // App closed/minimized
    if (appStartTime) {
      const now = new Date();
      const durationSeconds = Math.floor((now - appStartTime) / 1000);
      
      console.log('⏱️ Session duration:', durationSeconds, 'seconds');
      
      // Send to backend
      try {
        const response = await fetch(`${API_URL}/api/users/app-session`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            timestamp: now.toISOString(),
            durationSeconds: durationSeconds
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          console.log('✅ Session tracked:', data.data);
          console.log('🔥 Current Streak:', data.data.currentStreak + 1, 'days');
          console.log('⏱️ Total Time:', data.data.totalTimeFormatted);
          
          // Show streak notification if new streak
          if (data.data.isNewStreak) {
            showNotification(data.data.streakMessage);
          }
        }
      } catch (error) {
        console.error('❌ Failed to track session:', error);
      }
      
      appStartTime = null;
    }
  }
});
```

### **Alternative: Periodic Updates**

```javascript
// Track session in 5-minute intervals
let sessionStart = new Date();

setInterval(async () => {
  const now = new Date();
  const duration = Math.floor((now - sessionStart) / 1000);
  
  await fetch(`${API_URL}/api/users/app-session`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      timestamp: now.toISOString(),
      durationSeconds: duration
    })
  });
  
  sessionStart = now;
}, 5 * 60 * 1000); // Every 5 minutes
```

---

## 🧪 Testing

### **Test Session Tracking**

```bash
curl -X POST "http://localhost:3000/api/users/app-session" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2024-11-20T12:00:00.000Z",
    "durationSeconds": 900
  }'
```

### **Expected Response (First Day):**

```json
{
  "success": true,
  "data": {
    "currentStreak": 0,
    "longestStreak": 0,
    "totalActiveDays": 1,
    "lastActiveDate": "2024-11-20",
    "todayTimeSpent": 900,
    "todayTimeFormatted": "15m",
    "totalTimeSpent": 900,
    "totalTimeFormatted": "15m",
    "totalSessions": 1,
    "isNewStreak": false,
    "streakMessage": "🎉 Welcome! Start your streak tomorrow!"
  }
}
```

### **Expected Response (Day 2 - Consecutive):**

```json
{
  "success": true,
  "data": {
    "currentStreak": 1,
    "longestStreak": 1,
    "totalActiveDays": 2,
    "lastActiveDate": "2024-11-21",
    "todayTimeSpent": 600,
    "todayTimeFormatted": "10m",
    "totalTimeSpent": 1500,
    "totalTimeFormatted": "25m",
    "totalSessions": 2,
    "isNewStreak": true,
    "streakMessage": "🔥 2 days in a row! Keep it up!"
  }
}
```

---

## 📊 Database Tables Used

### `user_streaks`
```sql
- current_streak (INT)      -- Consecutive days - 1
- longest_streak (INT)       -- Best streak ever
- total_active_days (INT)    -- Total days opened
- last_active_date (DATE)    -- Last activity date
- freezes_available (INT)    -- Freeze rewards earned
```

### `user_usage_stats`
```sql
- total_sessions (INT)       -- Total sessions count
- total_time_spent (INT)     -- Cumulative seconds (all days)
- today_time_spent (INT)     -- Seconds today (resets daily)
- last_opened_at (TIMESTAMP) -- Last session timestamp
```

### `streak_milestones`
```sql
- milestone_days (INT)       -- Days achieved (7, 30, etc.)
- milestone_name (VARCHAR)   -- Achievement name
- reward_granted (BOOLEAN)   -- Freeze reward given
- achieved_at (TIMESTAMP)    -- When achieved
```

---

## ✅ Summary

- **Endpoint:** `POST /api/users/app-session`
- **Tracks:** Sessions, streaks, total time
- **Streak Formula:** Consecutive Days = Streak + 1
- **Total Time:** Cumulative across all days
- **Today Time:** Resets at midnight
- **Milestones:** Automatic at 7, 30, 50, 100, 365 days

**Perfect for:**
- Daily habit tracking
- User engagement metrics
- Gamification features
- Reward systems

