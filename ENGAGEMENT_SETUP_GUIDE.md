# 🚀 User Engagement Tracking - Setup Guide

## Quick Start (3 Steps)

### Step 1: Install Dependencies

```bash
npm install
```

This will install the required `node-cron` package.

### Step 2: Run Database Migration

You need to create the three new tables in your PostgreSQL database.

**Option A: Using psql command line**
```bash
psql your_database_url < config/engagement-tables-migration.sql
```

**Option B: Using a database client (DBeaver, pgAdmin, etc.)**
1. Open `config/engagement-tables-migration.sql`
2. Copy all the SQL code
3. Execute it in your database

**Option C: Manual SQL execution**

Connect to your database and run these three CREATE TABLE statements:

```sql
-- Table 1: user_usage_stats
CREATE TABLE IF NOT EXISTS user_usage_stats (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  total_sessions INTEGER DEFAULT 0,
  total_time_spent INTEGER DEFAULT 0,
  today_time_spent INTEGER DEFAULT 0,
  average_session_duration INTEGER DEFAULT 0,
  last_opened_at TIMESTAMP,
  recent_sessions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table 2: user_streaks
CREATE TABLE IF NOT EXISTS user_streaks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  total_active_days INTEGER DEFAULT 0,
  last_active_date DATE,
  today_completed BOOLEAN DEFAULT FALSE,
  daily_goals JSONB DEFAULT '{"readBible": false, "prayer": false, "reflection": false, "studyGroup": false, "note": false}'::jsonb,
  freezes_available INTEGER DEFAULT 3,
  streak_start_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table 3: streak_milestones
CREATE TABLE IF NOT EXISTS streak_milestones (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  milestone_days INTEGER NOT NULL,
  milestone_name VARCHAR(100),
  achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reward_granted BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, milestone_days)
);
```

### Step 3: Restart Your Server

```bash
# If using npm
npm start

# If using pm2
pm2 restart server

# If using nodemon
npm run dev
```

You should see these logs on startup:
```
🚀 Starting engagement tracking cron jobs...
✅ Daily streak reset job scheduled (00:00 UTC)
✅ Daily usage reset job scheduled (01:00 UTC)
✅ Weekly cleanup job scheduled (02:00 UTC Sunday)
✅ All engagement cron jobs started successfully
```

---

## ✅ Verify Installation

### Test the APIs

1. **Check health endpoint**:
```bash
curl http://localhost:3000/api/health
```

You should see the new engagement APIs listed.

2. **Test usage tracking** (requires authentication):
```bash
curl -X POST http://localhost:3000/api/users/profile/usage \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "totalSessions": 1,
    "totalTimeSpent": 300,
    "todayTimeSpent": 300,
    "averageSessionDuration": 300,
    "lastOpenedAt": "2024-01-20T10:30:00.000Z",
    "recentSessions": []
  }'
```

3. **Test streak tracking** (requires authentication):
```bash
curl -X POST http://localhost:3000/api/users/profile/streak \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentStreak": 1,
    "longestStreak": 1,
    "totalActiveDays": 1,
    "lastActiveDate": "2024-01-20",
    "todayCompleted": true,
    "dailyGoals": {
      "readBible": true,
      "prayer": false,
      "reflection": false,
      "studyGroup": false,
      "note": false
    }
  }'
```

4. **Get streak data**:
```bash
curl http://localhost:3000/api/users/profile/streak \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 📚 Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/users/profile/usage` | Update app usage stats |
| GET | `/api/users/profile/usage` | Get user's usage stats |
| POST | `/api/users/profile/streak` | Update daily streak |
| GET | `/api/users/profile/streak` | Get streak data |
| GET | `/api/users/profile/milestones` | Get achieved milestones |
| GET | `/api/users/streak/leaderboard` | Get streak leaderboard |

See `USER_ENGAGEMENT_API.md` for detailed documentation.

---

## 🔧 Troubleshooting

### Issue: Cron jobs not starting

**Solution**: Check that `node-cron` is installed:
```bash
npm list node-cron
```

If not installed:
```bash
npm install node-cron
```

### Issue: Database tables not found

**Error**: `relation "user_usage_stats" does not exist`

**Solution**: Run the migration script (Step 2 above).

### Issue: Endpoints return 404

**Solution**: Make sure you restarted the server after adding the routes.

### Issue: Authentication errors

**Solution**: Make sure you're passing a valid JWT token in the Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 🎉 That's It!

Your backend is now ready to track:
- ✅ App usage statistics
- ✅ Daily streaks
- ✅ Milestone achievements
- ✅ Leaderboards
- ✅ Daily goals completion

The frontend is already implemented and will start working immediately! 🚀

---

## 📋 Cron Job Schedule

- **00:00 UTC** - Daily streak reset (checks broken streaks, uses freezes)
- **01:00 UTC** - Daily usage reset (resets today's time spent)
- **02:00 UTC Sunday** - Weekly cleanup (trims old session data)

---

## 🎮 Frontend Integration

The frontend will automatically:
1. Send usage data when app opens/closes
2. Update streaks when daily goals are completed
3. Display milestone achievements
4. Show leaderboard rankings
5. Track daily goal completion

No frontend changes needed - it's already implemented! ✨

---

## 📖 Full Documentation

See `USER_ENGAGEMENT_API.md` for:
- Complete API reference
- Request/response examples
- Database schema details
- Streak logic explanation
- Milestone definitions
- Testing guidelines

---

## Support

If you encounter any issues:
1. Check backend logs for errors
2. Verify database tables exist
3. Ensure `node-cron` is installed
4. Restart the server

Happy tracking! 🎯

