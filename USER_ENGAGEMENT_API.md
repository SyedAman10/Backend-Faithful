# User Engagement Tracking API Documentation

## Overview

This API provides endpoints for tracking user engagement, app usage statistics, daily streaks, and milestone achievements in the Faithful Companion app.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install node-cron
```

### 2. Run Database Migration

Connect to your PostgreSQL database and run the migration script:

```bash
psql your_database_url < config/engagement-tables-migration.sql
```

Or use a database client to execute the SQL in `config/engagement-tables-migration.sql`.

### 3. Restart Server

The cron jobs will automatically start when the server starts.

```bash
npm start
# or
pm2 restart server
```

---

## API Endpoints

### 1. Track App Usage Statistics

**Endpoint**: `POST /api/users/profile/usage`  
**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "totalSessions": 42,
  "totalTimeSpent": 7200,
  "todayTimeSpent": 1800,
  "averageSessionDuration": 300,
  "lastOpenedAt": "2024-01-20T10:30:00.000Z",
  "recentSessions": [
    {
      "sessionId": "session_1234567890_abc",
      "startTime": 1234567890000,
      "endTime": 1234568190000,
      "duration": 300,
      "date": "2024-01-20T10:30:00.000Z"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Usage stats updated successfully"
}
```

**Description**: Updates or creates user usage statistics. The backend automatically keeps only the last 10 sessions.

---

### 2. Get App Usage Statistics

**Endpoint**: `GET /api/users/profile/usage`  
**Authentication**: Required (Bearer token)

**Response**:
```json
{
  "success": true,
  "usage": {
    "totalSessions": 42,
    "totalTimeSpent": 7200,
    "todayTimeSpent": 1800,
    "averageSessionDuration": 300,
    "lastOpenedAt": "2024-01-20T10:30:00.000Z",
    "recentSessions": [...]
  }
}
```

---

### 3. Update Daily Streak

**Endpoint**: `POST /api/users/profile/streak`  
**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "currentStreak": 5,
  "longestStreak": 10,
  "totalActiveDays": 50,
  "lastActiveDate": "2024-01-20",
  "todayCompleted": true,
  "dailyGoals": {
    "readBible": true,
    "prayer": true,
    "reflection": false,
    "studyGroup": false,
    "note": false
  },
  "freezesAvailable": 2
}
```

**Response**:
```json
{
  "success": true,
  "message": "Streak data updated successfully",
  "data": {
    "currentStreak": 5,
    "longestStreak": 10,
    "freezesAvailable": 2,
    "milestoneAchieved": {
      "days": 7,
      "name": "Week Warrior",
      "freezesToGrant": 1
    }
  }
}
```

**Description**: Updates user's streak data and automatically checks for milestone achievements. Awards streak freezes when milestones are reached.

**Milestones**:
- 7 days: "Week Warrior" → +1 freeze
- 14 days: "Two Week Champion"
- 30 days: "Monthly Master" → +1 freeze
- 50 days: "50 Day Superstar" → +1 freeze
- 100 days: "Century Club" → +2 freezes
- 365 days: "Year of Faith" → +3 freezes

---

### 4. Get Streak Data

**Endpoint**: `GET /api/users/profile/streak`  
**Authentication**: Required (Bearer token)

**Response**:
```json
{
  "success": true,
  "streak": {
    "currentStreak": 5,
    "longestStreak": 10,
    "totalActiveDays": 50,
    "lastActiveDate": "2024-01-20",
    "todayCompleted": true,
    "freezesAvailable": 2,
    "streakStartDate": "2024-01-15"
  },
  "dailyGoals": {
    "readBible": true,
    "prayer": true,
    "reflection": false,
    "studyGroup": false,
    "note": false
  }
}
```

**Description**: Retrieves user's current streak data including daily goals completion status.

---

### 5. Get Milestone Achievements

**Endpoint**: `GET /api/users/profile/milestones`  
**Authentication**: Required (Bearer token)

**Response**:
```json
{
  "success": true,
  "milestones": [
    {
      "days": 7,
      "name": "Week Warrior",
      "achievedAt": "2024-01-15T10:30:00.000Z",
      "rewardGranted": true
    },
    {
      "days": 14,
      "name": "Two Week Champion",
      "achievedAt": "2024-01-20T10:30:00.000Z",
      "rewardGranted": false
    }
  ]
}
```

**Description**: Returns all milestones achieved by the user.

---

### 6. Get Streak Leaderboard

**Endpoint**: `GET /api/users/streak/leaderboard`  
**Authentication**: Required (Bearer token)

**Query Parameters**:
- `limit` (optional, default: 50): Number of top users to return
- `period` (optional, default: "current"): Options: "current", "longest", "total_days"

**Example Request**:
```
GET /api/users/streak/leaderboard?limit=10&period=current
```

**Response**:
```json
{
  "success": true,
  "leaderboard": [
    {
      "userId": 123,
      "name": "John Doe",
      "profilePicture": "https://...",
      "currentStreak": 100,
      "longestStreak": 150,
      "totalActiveDays": 200,
      "rank": 1
    }
  ],
  "userRank": {
    "rank": 42,
    "currentStreak": 10,
    "longestStreak": 15,
    "totalActiveDays": 50
  }
}
```

**Description**: Returns the top users by streak performance and the current user's rank.

---

## Automated Cron Jobs

### Daily Streak Reset (00:00 UTC)

Automatically runs every day at midnight UTC to:
- Reset `today_completed` to false for all users
- Reset all daily goals to false
- Check for broken streaks (users who didn't complete yesterday)
- Deduct streak freezes if user missed exactly 1 day
- Break streaks if missed 2+ days without freezes

### Daily Usage Reset (01:00 UTC)

Automatically runs every day at 1 AM UTC to:
- Reset `today_time_spent` to 0 for users who haven't opened the app today

### Weekly Cleanup (Sunday 02:00 UTC)

Automatically runs weekly to:
- Trim `recent_sessions` to keep only last 10 sessions per user
- Clean up old data to maintain database performance

---

## Streak Logic

### How Streaks Work

1. **Active Day**: User completes at least one daily goal
2. **Streak Continues**: User was active yesterday
3. **Streak Breaks**: User was inactive for 2+ days without freezes
4. **Streak Freeze Used**: User was inactive for 1 day but has freezes available

### Streak Freezes

- Start with 3 free freezes
- Earn more by reaching milestones
- Used automatically when you miss a day
- Prevents streak from breaking

### Daily Goals

Track 5 types of activities:
- `readBible`: Read a Bible passage
- `prayer`: Submit a prayer request or pray
- `reflection`: Write a reflection/note
- `studyGroup`: Join a study group session
- `note`: Create a study note

Complete at least 1 goal per day to maintain your streak!

---

## Database Schema

### user_usage_stats

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| user_id | INTEGER | Foreign key to users table |
| total_sessions | INTEGER | Total app sessions |
| total_time_spent | INTEGER | Total seconds in app |
| today_time_spent | INTEGER | Seconds in app today (resets daily) |
| average_session_duration | INTEGER | Average session length in seconds |
| last_opened_at | TIMESTAMP | Last time user opened app |
| recent_sessions | JSONB | Array of last 10 sessions |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last update time |

### user_streaks

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| user_id | INTEGER | Foreign key to users table |
| current_streak | INTEGER | Current consecutive days |
| longest_streak | INTEGER | Longest streak ever |
| total_active_days | INTEGER | Total active days (all time) |
| last_active_date | DATE | Last active date |
| today_completed | BOOLEAN | Completed goals today |
| daily_goals | JSONB | Object tracking daily goals |
| freezes_available | INTEGER | Number of freezes remaining |
| streak_start_date | DATE | When current streak started |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last update time |

### streak_milestones

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| user_id | INTEGER | Foreign key to users table |
| milestone_days | INTEGER | Milestone day count (7, 14, 30, etc.) |
| milestone_name | VARCHAR(100) | Name of milestone |
| achieved_at | TIMESTAMP | When milestone was achieved |
| reward_granted | BOOLEAN | Whether freeze reward was given |

---

## Testing

### Manual Testing Endpoints

You can test the cron jobs manually by calling their trigger functions:

```javascript
const { manualStreakReset, manualUsageReset, manualCleanup } = require('./utils/engagementCronJobs');

// Manually trigger daily streak reset
await manualStreakReset();

// Manually trigger daily usage reset
await manualUsageReset();

// Manually trigger weekly cleanup
await manualCleanup();
```

### Test User Scenarios

1. **New User**:
   - First POST to `/api/users/profile/streak` creates streak record
   - Default values: 0 streak, 3 freezes

2. **Active User**:
   - POST daily with updated streak
   - Milestones automatically detected
   - Freezes awarded at milestones

3. **Inactive User**:
   - Cron job checks last_active_date
   - If missed 1 day → use freeze
   - If missed 2+ days → break streak

4. **Leaderboard**:
   - GET leaderboard to see top performers
   - User's rank calculated dynamically

---

## Error Handling

All endpoints return standard error responses:

```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad request (missing fields)
- `401`: Unauthorized (invalid/missing token)
- `500`: Server error

---

## Notes

1. All timestamps are in ISO 8601 format
2. Time durations are in seconds
3. Dates are in YYYY-MM-DD format
4. Cron jobs use UTC timezone
5. Streak logic is validated server-side
6. Recent sessions limited to 10 per user
7. Milestones are awarded only once

---

## Frontend Integration

The frontend is already fully implemented and ready to use these APIs. Simply ensure:

1. Database tables are created (run migration script)
2. Server is restarted (to start cron jobs)
3. `node-cron` dependency is installed

The frontend will automatically:
- Track usage on app open/close
- Update streaks when goals completed
- Display milestones when achieved
- Show leaderboard rankings

---

## Support

For issues or questions, check:
- Backend logs for cron job execution
- Database records for data integrity
- Frontend logs for API call errors

Happy tracking! 🎉

