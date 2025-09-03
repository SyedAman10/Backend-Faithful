# 🚀 Usage Tracking API Documentation

## **Base URL**: `https://1befd1562ae3.ngrok-free.app/api`

---

## 🔐 **Authentication**

All endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer {JWT_TOKEN}
```

---

## 📱 **1. Start Session API**

**Endpoint:** `POST /api/usage/session/start`

**Description:** Start a new usage tracking session for a user.

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

**Request Body:**
```json
{
  "sessionStart": "2024-01-20T10:30:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "uuid-here",
  "message": "Session started successfully"
}
```

**Example Usage:**
```javascript
const response = await fetch('https://1befd1562ae3.ngrok-free.app/api/usage/session/start', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sessionStart: new Date().toISOString()
  })
});

const { sessionId } = await response.json();
```

---

## ⏹️ **2. End Session API**

**Endpoint:** `POST /api/usage/session/end`

**Description:** End a session and calculate usage statistics.

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

**Request Body:**
```json
{
  "sessionId": "uuid-here",
  "sessionEnd": "2024-01-20T11:15:00.000Z",
  "durationSeconds": 2700
}
```

**Response:**
```json
{
  "success": true,
  "totalTimeSpent": 7200,
  "todayProgress": 2700,
  "currentStreak": 5,
  "message": "Session ended successfully"
}
```

**Example Usage:**
```javascript
const response = await fetch('https://1befd1562ae3.ngrok-free.app/api/usage/session/end', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sessionId: sessionId,
    sessionEnd: new Date().toISOString(),
    durationSeconds: 2700 // 45 minutes in seconds
  })
});

const { totalTimeSpent, currentStreak } = await response.json();
```

---

## 📈 **3. Get User Stats API**

**Endpoint:** `GET /api/usage/stats/{userId}`

**Description:** Retrieve comprehensive usage statistics for a user.

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalTimeSpent": 7200,
    "currentStreak": 5,
    "todayProgress": 2700,
    "weeklyStreak": [true, true, true, true, true, false, false],
    "lastUpdated": "2024-01-20T11:15:00.000Z"
  }
}
```

**Example Usage:**
```javascript
const response = await fetch(`https://1befd1562ae3.ngrok-free.app/api/usage/stats/${userId}`, {
  headers: {
    'Authorization': `Bearer ${jwtToken}`
  }
});

const { data } = await response.json();
console.log(`Total time: ${data.totalTimeSpent} seconds`);
console.log(`Current streak: ${data.currentStreak} days`);
```

---

## 📋 **4. Get User Sessions API**

**Endpoint:** `GET /api/usage/sessions/{userId}`

**Description:** Retrieve recent session history for debugging and analytics.

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "uuid-here",
        "session_start": "2024-01-20T10:30:00.000Z",
        "session_end": "2024-01-20T11:15:00.000Z",
        "duration_seconds": 2700,
        "created_at": "2024-01-20T10:30:00.000Z"
      }
    ],
    "totalSessions": 1
  }
}
```

---

## 🗄️ **Database Schema**

### **Tables Created Automatically:**

```sql
-- User sessions table
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL,
  session_start TIMESTAMP NOT NULL,
  session_end TIMESTAMP,
  duration_seconds INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User usage stats table
CREATE TABLE user_usage_stats (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL,
  total_time_seconds INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  weekly_streak BOOLEAN[] DEFAULT ARRAY[false, false, false, false, false, false, false],
  last_updated TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_created_at ON user_sessions(created_at);
```

---

## 🔄 **Complete Usage Flow**

### **1. User opens app:**
```javascript
// Start session
const startResponse = await fetch('/api/usage/session/start', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ sessionStart: new Date().toISOString() })
});

const { sessionId } = await startResponse.json();
```

### **2. User uses app (track locally):**
```javascript
// Track usage time locally
let startTime = Date.now();
// ... user interacts with app
```

### **3. User closes app:**
```javascript
// Calculate duration
const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

// End session
const endResponse = await fetch('/api/usage/session/end', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    sessionId,
    sessionEnd: new Date().toISOString(),
    durationSeconds
  })
});

const { totalTimeSpent, currentStreak } = await endResponse.json();
```

### **4. Display updated stats:**
```javascript
// Get latest stats
const statsResponse = await fetch(`/api/usage/stats/${userId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

const { data } = await statsResponse.json();
// Update UI with new stats
```

---

## 🧪 **Testing the API**

### **1. Health Check:**
```bash
curl https://1befd1562ae3.ngrok-free.app/api/health
```

### **2. Start Session (with JWT):**
```bash
curl -X POST https://1befd1562ae3.ngrok-free.app/api/usage/session/start \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sessionStart": "2024-01-20T10:30:00.000Z"}'
```

### **3. End Session:**
```bash
curl -X POST https://1befd1562ae3.ngrok-free.app/api/usage/session/end \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "SESSION_UUID", "sessionEnd": "2024-01-20T11:15:00.000Z", "durationSeconds": 2700}'
```

---

## 🚨 **Error Handling**

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "ErrorType",
  "message": "Detailed error message"
}
```

**Common Error Types:**
- `400`: Bad Request (missing required fields)
- `401`: Unauthorized (invalid JWT token)
- `403`: Forbidden (access denied)
- `500`: Internal Server Error

---

## 📊 **Features**

✅ **Automatic table creation** - Tables created if they don't exist  
✅ **JWT authentication** - Secure access control  
✅ **Session management** - Unique session IDs with UUID  
✅ **Streak calculation** - Automatic weekly and current streak tracking  
✅ **Performance optimization** - Database indexes for fast queries  
✅ **Comprehensive logging** - Detailed request/response logging  
✅ **Data validation** - Input validation and error handling  
✅ **CORS support** - Works with mobile apps and web clients  

---

## 🎯 **Next Steps**

1. **Install dependencies:** `npm install`
2. **Restart server:** `npm run dev`
3. **Test endpoints** with your JWT token
4. **Integrate with mobile app** using the provided examples

The API is now ready to track user usage and provide comprehensive statistics! 🚀
