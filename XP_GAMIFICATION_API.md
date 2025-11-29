# 🎯 XP & Gamification API Documentation

## Overview
This document describes the enhanced app session tracking with XP (experience points), leveling, and daily goals system.

---

## 📊 Gamification System

### XP (Experience Points)
Users earn XP by completing various activities in the app. XP accumulates over time and determines the user's level.

### Levels
- **Formula**: `Level = floor(totalXP / 100) + 1`
- **Example**:
  - 0-99 XP = Level 1
  - 100-199 XP = Level 2
  - 200-299 XP = Level 3
  - 1000+ XP = Level 11+

### Daily Goals
5 core activities users should complete daily:
1. **Daily Verse** - Read/listen to daily verse
2. **Daily Prayer** - Read/listen to daily prayer
3. **Daily Reflection** - Read/listen to daily reflection
4. **AI Chat** - Send at least one message to AI
5. **Community Engagement** - Post or comment in community

---

## 🎮 XP Values

| Activity Type | XP Earned | Category |
|--------------|-----------|----------|
| `daily_verse_read` | 10 XP | Daily Content |
| `daily_verse_listened` | 15 XP | Daily Content |
| `daily_prayer_read` | 10 XP | Daily Content |
| `daily_prayer_listened` | 15 XP | Daily Content |
| `daily_reflection_read` | 20 XP | Daily Content |
| `daily_reflection_listened` | 25 XP | Daily Content |
| `ai_chat_message` | 5 XP | Engagement |
| `community_post` | 10 XP | Community |
| `community_comment` | 5 XP | Community |
| `study_group_attended` | 30 XP | Groups |
| `prayer_request_created` | 10 XP | Prayer |
| `prayer_response_given` | 15 XP | Prayer |
| `bible_note_created` | 10 XP | Bible Study |
| `verse_shared` | 5 XP | Sharing |

---

## 📡 API Endpoints

### 1. POST /api/users/app-session
Track app session with activities and calculate XP, streaks, and daily goals.

**Requires Authentication**: Yes (JWT Bearer token)

#### Request Body
```json
{
  "timestamp": "2024-11-28T08:30:00.000Z",
  "durationSeconds": 900,
  "sessionStartTime": "2024-11-28T08:30:00.000Z",
  "sessionEndTime": "2024-11-28T08:45:00.000Z",
  "timezone": "America/New_York",
  "activities": [
    {
      "type": "daily_verse_read",
      "timestamp": "2024-11-28T08:31:00.000Z",
      "xpEarned": 10
    },
    {
      "type": "daily_verse_listened",
      "timestamp": "2024-11-28T08:32:00.000Z",
      "xpEarned": 15
    },
    {
      "type": "daily_prayer_read",
      "timestamp": "2024-11-28T08:35:00.000Z",
      "xpEarned": 10
    },
    {
      "type": "ai_chat_message",
      "timestamp": "2024-11-28T08:40:00.000Z",
      "xpEarned": 5
    }
  ]
}
```

#### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `timestamp` | string (ISO 8601) | No | Session timestamp (defaults to now) |
| `durationSeconds` | integer | Yes | Session duration in seconds |
| `sessionStartTime` | string (ISO 8601) | No | When session started |
| `sessionEndTime` | string (ISO 8601) | No | When session ended |
| `timezone` | string | No | User's timezone |
| `activities` | array | No | Array of activities completed during session |

#### Activity Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Activity type (see XP values table) |
| `timestamp` | string (ISO 8601) | No | When activity occurred |
| `xpEarned` | integer | No | XP earned (auto-calculated if not provided) |

#### Response
```json
{
  "success": true,
  "data": {
    "currentStreak": 2,
    "longestStreak": 5,
    "totalActiveDays": 15,
    "lastActiveDate": "2024-11-28",
    "todayTimeSpent": 3600,
    "todayTimeFormatted": "1h 0m",
    "totalTimeSpent": 86400,
    "totalTimeFormatted": "24h 0m",
    "totalSessions": 45,
    "isNewStreak": false,
    "streakMessage": "🔥 3 days in a row!",
    
    "totalXP": 1250,
    "todayXP": 40,
    "level": 13,
    "xpToNextLevel": 50,
    
    "dailyGoals": {
      "totalGoals": 5,
      "completedGoals": 3,
      "progressPercentage": 60,
      "goals": [
        {
          "type": "daily_verse",
          "completed": true
        },
        {
          "type": "daily_prayer",
          "completed": true
        },
        {
          "type": "daily_reflection",
          "completed": false
        },
        {
          "type": "ai_chat",
          "completed": true
        },
        {
          "type": "community_engagement",
          "completed": false
        }
      ]
    }
  },
  "message": "Session tracked successfully"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `currentStreak` | integer | Current consecutive days streak |
| `longestStreak` | integer | Longest streak ever achieved |
| `totalActiveDays` | integer | Total days app was opened |
| `lastActiveDate` | string | Last date user was active (YYYY-MM-DD) |
| `todayTimeSpent` | integer | Time spent today (seconds) |
| `todayTimeFormatted` | string | Formatted time (e.g., "1h 30m") |
| `totalTimeSpent` | integer | All-time time spent (seconds) |
| `totalTimeFormatted` | string | Formatted total time |
| `totalSessions` | integer | Total number of sessions |
| `isNewStreak` | boolean | Whether this extended the streak |
| `streakMessage` | string | Motivational message |
| `totalXP` | integer | All-time XP earned |
| `todayXP` | integer | XP earned today |
| `level` | integer | Current level |
| `xpToNextLevel` | integer | XP needed for next level |
| `dailyGoals` | object | Daily goals progress |

---

### 2. GET /api/users/app-session
Retrieve current session/streak data with XP and daily goals (no session creation).

**Requires Authentication**: Yes (JWT Bearer token)

#### Request
```http
GET /api/users/app-session
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Response
```json
{
  "success": true,
  "data": {
    "currentStreak": 2,
    "longestStreak": 5,
    "totalActiveDays": 15,
    "lastActiveDate": "2024-11-28",
    "todayTimeSpent": 3600,
    "todayTimeFormatted": "1h 0m",
    "totalTimeSpent": 86400,
    "totalTimeFormatted": "24h 0m",
    "totalSessions": 45,
    "freezesAvailable": 2,
    "lastOpenedAt": "2024-11-28T08:45:00.000Z",
    "streakMessage": "🔥 3 days in a row!",
    "milestones": [
      {
        "milestone_days": 7,
        "milestone_name": "Week Warrior",
        "achieved_at": "2024-11-21T10:30:00.000Z",
        "reward_granted": true
      }
    ],
    
    "totalXP": 1250,
    "todayXP": 40,
    "level": 13,
    "xpToNextLevel": 50,
    
    "dailyGoals": {
      "totalGoals": 5,
      "completedGoals": 3,
      "progressPercentage": 60,
      "goals": [
        {
          "type": "daily_verse",
          "completed": true
        },
        {
          "type": "daily_prayer",
          "completed": true
        },
        {
          "type": "daily_reflection",
          "completed": false
        },
        {
          "type": "ai_chat",
          "completed": true
        },
        {
          "type": "community_engagement",
          "completed": false
        }
      ]
    }
  },
  "message": "Session stats retrieved successfully"
}
```

---

## 🗄️ Database Tables

### user_xp
Stores user XP and level data.

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `user_id` | integer | Foreign key to users table (unique) |
| `total_xp` | integer | All-time total XP |
| `today_xp` | integer | XP earned today |
| `last_xp_date` | date | Last date XP was earned |
| `created_at` | timestamp | Record creation time |
| `updated_at` | timestamp | Last update time |

### user_daily_goals
Tracks daily goal completion.

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `user_id` | integer | Foreign key to users table |
| `goal_date` | date | Date of goals (unique with user_id) |
| `goals_completed` | jsonb | JSON object with goal statuses |
| `total_goals` | integer | Total number of goals (5) |
| `created_at` | timestamp | Record creation time |

### user_activities_log
Detailed activity logging for analytics.

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `user_id` | integer | Foreign key to users table |
| `activity_type` | varchar(50) | Type of activity |
| `xp_earned` | integer | XP earned from activity |
| `activity_timestamp` | timestamp | When activity occurred |
| `metadata` | jsonb | Additional activity data |

---

## 📱 Frontend Integration Example

### Tracking a Session with Activities

```javascript
const trackSession = async (sessionData) => {
  try {
    const response = await fetch('/api/users/app-session', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionStartTime: sessionData.startTime,
        sessionEndTime: sessionData.endTime,
        durationSeconds: sessionData.duration,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        activities: [
          {
            type: 'daily_verse_read',
            timestamp: new Date().toISOString(),
            xpEarned: 10
          },
          {
            type: 'ai_chat_message',
            timestamp: new Date().toISOString(),
            xpEarned: 5
          }
        ]
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Session tracked!', result.data);
      console.log(`Level ${result.data.level} - ${result.data.totalXP} XP`);
      console.log(`Daily goals: ${result.data.dailyGoals.completedGoals}/${result.data.dailyGoals.totalGoals}`);
    }
  } catch (error) {
    console.error('Failed to track session:', error);
  }
};
```

### Getting Current Stats

```javascript
const getSessionStats = async () => {
  try {
    const response = await fetch('/api/users/app-session', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Current stats:', result.data);
      displayUserLevel(result.data.level, result.data.totalXP);
      displayDailyGoals(result.data.dailyGoals);
      displayStreak(result.data.currentStreak);
    }
  } catch (error) {
    console.error('Failed to get stats:', error);
  }
};
```

---

## ⚠️ Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Duration in seconds is required and must be positive"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "No token provided"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Failed to track session",
  "message": "Database connection error"
}
```

---

## 🎓 Best Practices

1. **Track activities in real-time**: Send activities as they happen for accurate XP calculation
2. **Batch activities**: Collect activities during session and send all at once when closing app
3. **Handle offline**: Queue activities locally and sync when connection restored
4. **Show progress**: Display XP, level, and daily goals progress in UI
5. **Celebrate milestones**: Show animations when user levels up or completes all daily goals

---

## 🔄 Migration

Run the migration to create XP and goals tables:

```bash
node scripts/run-xp-goals-migration.js
```

This creates:
- `user_xp` table
- `user_daily_goals` table
- `user_activities_log` table
- All necessary indexes

---

## 📊 Analytics Queries

### Top Users by XP
```sql
SELECT 
  u.id, 
  u.name, 
  u.email, 
  x.total_xp, 
  FLOOR(x.total_xp / 100) + 1 as level
FROM users u
JOIN user_xp x ON u.id = x.user_id
ORDER BY x.total_xp DESC
LIMIT 10;
```

### Daily Goals Completion Rate
```sql
SELECT 
  goal_date,
  COUNT(*) as total_users,
  AVG(JSONB_ARRAY_LENGTH(goals_completed::jsonb)) as avg_goals_completed
FROM user_daily_goals
WHERE goal_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY goal_date
ORDER BY goal_date DESC;
```

### Most Popular Activities
```sql
SELECT 
  activity_type,
  COUNT(*) as activity_count,
  SUM(xp_earned) as total_xp_from_activity
FROM user_activities_log
WHERE activity_timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY activity_type
ORDER BY activity_count DESC;
```

---

## 🚀 Future Enhancements

1. **Leaderboards**: Global and friend leaderboards by XP
2. **Achievements**: Special badges for completing specific challenges
3. **XP Multipliers**: Bonus XP during special events
4. **Weekly Challenges**: Extra XP for completing weekly goals
5. **Social Sharing**: Share level ups and achievements
6. **Customization**: Unlock themes and features with XP

---

## 📞 Support

For issues or questions:
- Check logs: Console logs show detailed XP and activity processing
- Verify JWT token is valid
- Ensure activities array format matches documentation
- Check database tables exist after migration

---

**Last Updated**: November 28, 2024

