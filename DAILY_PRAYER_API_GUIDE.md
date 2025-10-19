# Daily Prayer API Testing Guide

Complete guide to test and use the Daily Prayer API powered by Gemini AI.

---

## **🙏 API Overview**

The Daily Prayer API provides personalized Bible verses based on prayer categories. It uses Gemini AI to validate Bible versions and generate meaningful verses for users.

**Endpoint:** `GET /api/bible/daily-prayer`

**Features:**
- ✅ Personalized daily verses based on user's Bible version preference
- ✅ Multiple prayer categories (comfort, strength, peace, love, hope, faith)
- ✅ Caching - Returns same verse for the same day/category (prevents duplicates)
- ✅ Gemini AI integration for dynamic verse generation
- ✅ Saves prayer history to database

---

## **📋 Prerequisites**

1. **Server running** on `http://localhost:3000`
2. **Valid user account** with email and password
3. **Authentication token** (JWT) from login
4. **Gemini API Key** configured in `.env`

---

## **🚀 Quick Test (Using cURL)**

### **Step 1: Login to get token**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "your-email@example.com",
      "name": "Your Name"
    }
  }
}
```

Copy the `token` value.

---

### **Step 2: Get Daily Prayer**

**Basic request (default category):**
```bash
curl http://localhost:3000/api/bible/daily-prayer \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**With specific category:**
```bash
curl http://localhost:3000/api/bible/daily-prayer?category=comfort \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**With specific Bible version:**
```bash
curl http://localhost:3000/api/bible/daily-prayer?category=peace&bible=NIV \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## **📝 Request Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `category` | string | No | `all` | Prayer category |
| `bible` | string | No | User's saved preference or `niv` | Bible version |

### **Available Categories:**

| Category | Description | Example Themes |
|----------|-------------|----------------|
| `all` | General prayers | Mixed topics |
| `comfort` | Comfort in trials | Peace, reassurance |
| `strength` | Spiritual strength | Courage, power |
| `peace` | Inner peace | Calm, tranquility |
| `love` | God's love | Compassion, care |
| `hope` | Hope in hardship | Future, promises |
| `faith` | Growing faith | Trust, belief |

---

## **✅ Response Format**

**Success Response:**
```json
{
  "success": true,
  "data": {
    "bible": "niv",
    "category": "comfort",
    "passage": "Psalm 23:4",
    "text": "Even though I walk through the darkest valley, I will fear no evil, for you are with me; your rod and your staff, they comfort me.",
    "reference": "Psalm 23:4",
    "prayedAt": "2025-10-16T10:30:00.000Z",
    "isNew": true
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `bible` | string | Bible version used |
| `category` | string | Prayer category |
| `passage` | string | Verse reference |
| `text` | string | Full verse text |
| `reference` | string | Same as passage |
| `prayedAt` | timestamp | When prayer was generated |
| `isNew` | boolean | `true` if new, `false` if cached from today |

---

## **🧪 Testing with Node.js Script**

### **Method 1: Use the test script**

```bash
# Update credentials in test-daily-prayer.js
# Edit line 6-7 with your test user email/password

node test-daily-prayer.js
```

### **Method 2: Manual JavaScript test**

```javascript
const axios = require('axios');

async function testPrayer() {
  // 1. Login
  const login = await axios.post('http://localhost:3000/api/auth/login', {
    email: 'test@example.com',
    password: 'password123'
  });
  
  const token = login.data.data.token;
  
  // 2. Get daily prayer
  const prayer = await axios.get(
    'http://localhost:3000/api/bible/daily-prayer?category=comfort',
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  
  console.log('Prayer:', prayer.data.data);
}

testPrayer();
```

---

## **📱 Testing with Postman**

### **Step 1: Create Login Request**

1. **Method:** POST
2. **URL:** `http://localhost:3000/api/auth/login`
3. **Headers:**
   ```
   Content-Type: application/json
   ```
4. **Body (raw JSON):**
   ```json
   {
     "email": "test@example.com",
     "password": "password123"
   }
   ```
5. Click **Send**
6. **Copy the token** from response

### **Step 2: Create Daily Prayer Request**

1. **Method:** GET
2. **URL:** `http://localhost:3000/api/bible/daily-prayer?category=comfort`
3. **Headers:**
   ```
   Authorization: Bearer YOUR_TOKEN_HERE
   ```
4. Click **Send**

### **Step 3: Test Different Categories**

Update the URL with different categories:
- `?category=all`
- `?category=comfort`
- `?category=strength`
- `?category=peace`
- `?category=love`
- `?category=hope`
- `?category=faith`

---

## **🔄 Caching Behavior**

The API caches daily prayers to ensure consistency:

1. **First request of the day:** Generates new verse via Gemini AI
   - `isNew: true`
   - Saves to database

2. **Subsequent requests (same day, same category):** Returns cached verse
   - `isNew: false`
   - Retrieved from database

3. **Next day:** Generates new verse
   - Cache expires at midnight (00:00:00)
   - New verse generated

**Example:**
```bash
# First request today - generates new verse
curl http://localhost:3000/api/bible/daily-prayer?category=comfort \
  -H "Authorization: Bearer TOKEN"
# Response: { "isNew": true, ... }

# Second request today - returns cached
curl http://localhost:3000/api/bible/daily-prayer?category=comfort \
  -H "Authorization: Bearer TOKEN"
# Response: { "isNew": false, ... } (same verse)

# Different category - generates new verse
curl http://localhost:3000/api/bible/daily-prayer?category=strength \
  -H "Authorization: Bearer TOKEN"
# Response: { "isNew": true, ... } (different verse)
```

---

## **⚙️ How It Works**

```
User Request
    ↓
Check if user has prayer for today (category)
    ↓
    ├─ YES → Return cached prayer
    ↓
    └─ NO → Continue
        ↓
Get user's Bible version preference
    ↓
Send prompt to Gemini AI
    ↓
Gemini generates verse + text
    ↓
Parse and validate response
    ↓
Save to user_prayer_history table
    ↓
Return prayer to user
```

---

## **🎯 Expected Behavior**

### **Test Case 1: First request**
```bash
GET /api/bible/daily-prayer?category=comfort
```
**Expected:**
- ✅ Returns `isNew: true`
- ✅ Has valid verse reference (e.g., "Psalm 23:4")
- ✅ Has verse text
- ✅ Saves to database

### **Test Case 2: Same category, same day**
```bash
GET /api/bible/daily-prayer?category=comfort
```
**Expected:**
- ✅ Returns `isNew: false`
- ✅ Same verse as Test Case 1
- ✅ Retrieved from database (fast response)

### **Test Case 3: Different category**
```bash
GET /api/bible/daily-prayer?category=strength
```
**Expected:**
- ✅ Returns `isNew: true`
- ✅ Different verse than Test Case 1
- ✅ Related to strength theme

### **Test Case 4: With Bible version**
```bash
GET /api/bible/daily-prayer?category=peace&bible=KJV
```
**Expected:**
- ✅ Verse in KJV translation
- ✅ Returns `isNew: true` (different parameters)

---

## **🐛 Troubleshooting**

### **Error: "Gemini AI not configured"**

**Cause:** Missing `GEMINI_API_KEY` in `.env`

**Solution:**
1. Add to `.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
2. Restart server

---

### **Error: "Unauthorized"**

**Cause:** Missing or invalid authentication token

**Solution:**
1. Login to get fresh token
2. Include in header: `Authorization: Bearer TOKEN`

---

### **Error: "Failed to generate verse"**

**Cause:** Gemini AI API error or invalid response

**Solution:**
1. Check Gemini API quota
2. Check internet connection
3. Verify API key is valid
4. Check server logs for details

---

### **No verse text returned**

**Cause:** Gemini AI returned unexpected format

**Solution:**
1. Check server logs for Gemini response
2. Verify Gemini model name is `gemini-2.5-pro`
3. Try different category

---

## **📊 Database Tables**

### **user_prayer_history**

Stores all daily prayers for users:

```sql
CREATE TABLE user_prayer_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  version VARCHAR(50),           -- Bible version (e.g., 'niv')
  book VARCHAR(100),              -- Book name (e.g., 'Psalms')
  chapter INTEGER,                -- Chapter number
  verse INTEGER,                  -- Verse number
  text TEXT,                      -- Verse text
  reference VARCHAR(200),         -- Full reference (e.g., 'Psalm 23:4')
  category VARCHAR(50),           -- Prayer category
  prayed_at TIMESTAMP,            -- When prayer was generated
  UNIQUE(user_id, version, book, chapter, verse)
);
```

**Query user's prayer history:**
```sql
SELECT * FROM user_prayer_history 
WHERE user_id = 1 
ORDER BY prayed_at DESC 
LIMIT 10;
```

---

## **💡 Pro Tips**

1. **Test all categories** to see different verse selections
2. **Test caching** by requesting same category twice
3. **Test Bible versions** - NIV, KJV, NLT, ESV, etc.
4. **Check database** to verify prayers are saved
5. **Monitor Gemini AI quota** if using free tier
6. **Check server logs** for detailed debugging info

---

## **🔍 Viewing Server Logs**

The server logs all daily prayer requests with emojis for easy tracking:

```bash
# Start server and watch logs
npm start

# Look for these log markers:
🙏 Get Daily Prayer Request        # Request received
📚 User Bible preference retrieved   # User's preferred version
🎲 Generating with Gemini AI        # Gemini AI call
✅ Verse generated successfully      # Success
📤 Sending prayer to client         # Response sent
❌ Error                            # Error occurred
```

---

## **🎉 Success Indicators**

Your API is working correctly if:

- ✅ Login returns valid token
- ✅ First request returns `isNew: true`
- ✅ Second request (same category) returns `isNew: false`
- ✅ Verse text is present and meaningful
- ✅ Reference matches the verse
- ✅ Category is correct
- ✅ Database shows prayer in `user_prayer_history`
- ✅ Server logs show no errors

---

## **📚 Additional Resources**

- **Main Bible API docs:** `BIBLE_API_DOCUMENTATION.md`
- **Gemini AI integration:** `GEMINI_AI_INTEGRATION.md`
- **Test script:** `test-daily-prayer.js`
- **Server code:** `routes/bible.js` (daily-prayer endpoint)

---

**Happy testing! 🙏✨**

If you encounter issues, check the server logs for detailed error messages. All prayer requests are comprehensively logged for debugging.

