# Bible API Comprehensive Logging

This document describes the comprehensive console logging added to all Bible Gateway API endpoints for debugging and monitoring.

---

## **Overview**

Every Bible API endpoint now has detailed console logging at each step of the request/response lifecycle. This makes debugging and monitoring much easier.

---

## **Logging Categories**

### **🔐 Authentication & Token Management**

**`getBibleGatewayToken()` function:**
- Token cache status check
- Token expiration validation
- API request details
- Response validation
- Success/failure logging

**Example Logs:**
```
🔐 getBibleGatewayToken() called
  - hasCachedToken: true
  - tokenExpiration: 2025-10-09T12:00:00.000Z
  - isTokenValid: true

✅ Using cached Bible Gateway token
  - expiresIn: 3600 seconds

🔑 Requesting new Bible Gateway access token...
  - apiUrl: https://api.biblegateway.com/2/request_access_token
  - hasUsername: true
  - hasPassword: true

✅ Bible Gateway token obtained successfully
  - tokenLength: 128
  - expiresAt: 2025-10-09T12:00:00.000Z
  - expiresIn: 7200 seconds
```

---

## **Endpoint Logging Details**

### **1. GET `/api/bible/versions`**

**Logged Information:**
- ✅ User ID and email
- ✅ Endpoint and method
- ✅ Token fetching process
- ✅ API request details
- ✅ Response validation
- ✅ Bibles count and samples
- ✅ Success/error responses

**Example Logs:**
```
📖 Get Bible Versions Request
  - userId: 123
  - userEmail: user@example.com
  - endpoint: /api/bible/versions
  - method: GET

🔑 Fetching Bible Gateway access token...

🌐 Making request to Bible Gateway API...
  - url: https://api.biblegateway.com/2/bible
  - hasToken: true
  - tokenLength: 128

📥 Bible Gateway API response received
  - status: 200
  - statusText: OK
  - hasBibles: true

✅ Bible versions retrieved successfully
  - versionCount: 150
  - firstFive: ['niv', 'esv', 'nlt', 'kjv', 'nasb']
  - lastFive: ['...']

📤 Sending response to client
  - success: true
  - totalBibles: 150
```

---

### **2. GET `/api/bible/translation/:bible`**

**Logged Information:**
- ✅ User info and Bible parameter
- ✅ Parameter validation
- ✅ Token fetching
- ✅ API request details
- ✅ Response structure
- ✅ Success/error handling

**Example Logs:**
```
📚 Get Translation Info Request
  - userId: 123
  - userEmail: user@example.com
  - bible: niv
  - endpoint: /api/bible/translation/:bible
  - method: GET

✅ Parameters validated
  - bible: niv
  - hasBible: true

🔑 Fetching Bible Gateway access token...

🌐 Making request to Bible Gateway API...
  - url: https://api.biblegateway.com/2/bible/niv
  - bible: niv
  - hasToken: true

📥 Bible Gateway API response received
  - status: 200
  - statusText: OK
  - responseKeys: ['name', 'abbreviation', 'language']

✅ Translation info retrieved successfully
  - bible: niv
  - dataSize: 1234

📤 Sending response to client
```

---

### **3. GET `/api/bible/passage/:bible/:passage`**

**Logged Information:**
- ✅ User info and passage details
- ✅ Parameter validation
- ✅ OSIS reference parsing
- ✅ Token fetching
- ✅ API request
- ✅ Response content preview
- ✅ Error handling

**Example Logs:**
```
📖 Get Bible Passage Request
  - userId: 123
  - userEmail: user@example.com
  - bible: niv
  - passage: John 3:16
  - endpoint: /api/bible/passage/:bible/:passage
  - method: GET

🔍 Validating parameters
  - bible: niv
  - passage: John 3:16
  - hasBible: true
  - hasPassage: true
  - passageLength: 9

🔑 Fetching Bible Gateway access token...

🌐 Making request to Bible Gateway API...
  - url: https://api.biblegateway.com/2/bible/osis/John 3:16/niv
  - bible: niv
  - passage: John 3:16
  - hasToken: true

📥 Bible Gateway API response received
  - status: 200
  - statusText: OK
  - dataType: string
  - dataLength: 156

✅ Bible passage retrieved successfully
  - bible: niv
  - passage: John 3:16
  - contentPreview: For God so loved the world...

📤 Sending response to client
```

---

### **4. GET `/api/bible/search/:bible/:query`**

**Logged Information:**
- ✅ Search parameters and options
- ✅ Query validation
- ✅ Token management
- ✅ API request with search params
- ✅ Results count and pagination
- ✅ Success/error responses

**Example Logs:**
```
🔍 Bible Search Request
  - userId: 123
  - userEmail: user@example.com
  - bible: niv
  - query: love
  - searchType: all
  - start: 0
  - limit: 100
  - endpoint: /api/bible/search/:bible/:query
  - method: GET

🔍 Search parameters
  - bible: niv
  - query: love
  - search_type: all
  - start: 0
  - limit: 100

🔑 Fetching Bible Gateway access token...

🌐 Making search request to Bible Gateway API...
  - url: https://api.biblegateway.com/2/bible/search/love/niv
  - hasToken: true

📥 Bible Gateway search API response received
  - status: 200
  - hasResults: true
  - resultsCount: 100
  - total: 686

✅ Bible search completed successfully
  - resultsReturned: 100
  - totalResults: 686

📤 Sending search results to client
```

---

### **5. GET `/api/bible/daily-prayer`**

**Logged Information:**
- ✅ User preferences and category
- ✅ Database query for saved version
- ✅ Category verses loading
- ✅ Existing prayer check
- ✅ Random verse selection
- ✅ Bible Gateway API call
- ✅ Text processing
- ✅ Database save operation
- ✅ Success/error handling

**Example Logs:**
```
🙏 Get Daily Prayer Request
  - userId: 123
  - userEmail: user@example.com
  - bible: null
  - category: comfort
  - endpoint: /api/bible/daily-prayer
  - method: GET

🔍 Fetching user Bible preference from database...
  - userId: 123
  - requestedBible: null
  - category: comfort

📚 User Bible preference retrieved
  - userId: 123
  - savedBibleVersion: niv
  - usingBible: niv
  - isDefault: false

📖 Prayer category verses loaded
  - category: comfort
  - versesCount: 14
  - firstVerse: Ps 23:1-4
  - lastVerse: Phil 4:6-7

🔍 Checking for existing prayer today...
  - userId: 123
  - bible: niv
  - category: comfort
  - today: 2025-10-08T00:00:00.000Z
  - tomorrow: 2025-10-09T00:00:00.000Z

📊 Database query result
  - foundExistingPrayer: false
  - rowCount: 0

🎲 No existing prayer found, selecting new random verse...
  - availableVerses: 14

✅ Random verse selected
  - passage: Ps 23:1-4
  - category: comfort

🔍 Fetching passage from Bible Gateway...
  - bible: niv
  - passage: Ps 23:1-4
  - url: https://api.biblegateway.com/2/bible/osis/Ps 23:1-4/niv

🔑 Getting Bible Gateway access token...

🌐 Making request to Bible Gateway API...
  - hasToken: true

📥 Bible Gateway API response received
  - status: 200
  - statusText: OK
  - dataType: string

✅ Passage fetched successfully
  - bible: niv
  - passage: Ps 23:1-4
  - contentLength: 234

📝 Processing passage text
  - originalType: string
  - processedLength: 230
  - textPreview: The LORD is my shepherd...

💾 Saving prayer to database...
  - userId: 123
  - bible: niv
  - book: Ps
  - reference: Ps 23:1-4
  - category: comfort
  - textLength: 230

✅ Prayer saved to database successfully

✅ Daily prayer retrieved successfully
  - textLength: 230

📤 Sending new prayer to client
```

---

### **6. PUT `/api/bible/user-bible-version`**

**Logged Information:**
- ✅ User info and request body
- ✅ Bible version validation
- ✅ Bible Gateway verification
- ✅ Available versions check
- ✅ Database update
- ✅ Success/error responses

**Example Logs:**
```
📖 Update User Bible Version Request
  - userId: 123
  - userEmail: user@example.com
  - bibleVersion: niv
  - endpoint: /api/bible/user-bible-version
  - method: PUT

🔍 Validating Bible version parameter
  - bibleVersion: niv
  - hasBibleVersion: true
  - type: string

🔑 Verifying Bible version with Bible Gateway...

🔑 Getting access token...

🌐 Fetching available Bibles from Bible Gateway...

📥 Bible Gateway response received
  - status: 200
  - hasBibles: true
  - biblesCount: 150

🔍 Checking if Bible version exists
  - requestedVersion: niv
  - exists: true
  - availableCount: 150
  - firstFive: ['niv', 'esv', 'nlt', 'kjv', 'nasb']

✅ Bible version verified successfully
  - version: niv

💾 Updating user Bible version in database...
  - userId: 123
  - bibleVersion: niv

✅ Database updated successfully

✅ User Bible version updated successfully
  - userId: 123
  - bibleVersion: niv

📤 Sending success response to client
```

---

### **7. GET `/api/bible/user-bible-version`**

**Logged Information:**
- ✅ User info
- ✅ Database query
- ✅ Result validation
- ✅ Default value handling
- ✅ Success response

**Example Logs:**
```
📖 Get User Bible Version Request
  - userId: 123
  - userEmail: user@example.com
  - endpoint: /api/bible/user-bible-version
  - method: GET

🔍 Querying database for user Bible version...
  - userId: 123

📊 Database query result
  - rowCount: 1
  - hasRows: true
  - savedBibleVersion: niv

✅ User Bible version retrieved successfully
  - userId: 123
  - bibleVersion: niv
  - isDefault: false

📤 Sending Bible version to client
```

---

## **Error Logging**

All endpoints include comprehensive error logging:

```
❌ [Operation] error
  - userId: 123
  - bible: niv
  - error: Error message
  - stack: Stack trace
  - status: 404
  - statusText: Not Found
  - data: { error details }
  - timestamp: 2025-10-08T10:30:00.000Z
```

---

## **Logging Emojis Guide**

| Emoji | Meaning |
|-------|---------|
| 🔐 | Authentication/Token operations |
| 🔑 | Fetching access token |
| 🌐 | Making API request |
| 📥 | Receiving API response |
| 📖 | Bible content operations |
| 📚 | Bible version/translation info |
| 🔍 | Searching/validating |
| 🎲 | Random selection |
| 💾 | Database operations |
| 📝 | Processing/formatting data |
| 📤 | Sending response to client |
| ✅ | Success operations |
| ❌ | Error operations |
| 📛 | Not found errors |
| 🙏 | Prayer-related operations |
| 📊 | Query results/statistics |

---

## **Benefits**

1. **Easy Debugging** - Track request flow from start to finish
2. **Performance Monitoring** - See which operations take time
3. **Error Tracking** - Detailed error context for troubleshooting
4. **User Activity** - Monitor what users are accessing
5. **API Health** - Track Bible Gateway API responses
6. **Token Management** - Monitor token caching and refresh
7. **Database Operations** - See all database queries and results

---

## **Log Filtering**

### **View Only Errors:**
```bash
npm start | grep "❌"
```

### **View Only Success:**
```bash
npm start | grep "✅"
```

### **View Specific Endpoint:**
```bash
npm start | grep "daily-prayer"
```

### **View API Calls:**
```bash
npm start | grep "🌐"
```

### **View Database Operations:**
```bash
npm start | grep "💾"
```

---

## **Production Recommendations**

For production, consider:

1. **Log Levels** - Use different log levels (DEBUG, INFO, WARN, ERROR)
2. **Log Aggregation** - Send logs to a service like CloudWatch, Datadog, or LogRocket
3. **Sensitive Data** - Remove or mask sensitive info in production logs
4. **Performance** - Consider async logging for high-traffic endpoints
5. **Rotation** - Implement log rotation to manage disk space

---

## **Example Log Flow**

Complete log flow for a daily prayer request:

```
🙏 Get Daily Prayer Request → 
  🔍 Fetching user Bible preference → 
  📚 User Bible preference retrieved → 
  📖 Prayer category verses loaded → 
  🔍 Checking for existing prayer → 
  📊 Database query result → 
  🎲 Random verse selection → 
  🔑 Getting access token → 
  🌐 Making API request → 
  📥 API response received → 
  ✅ Passage fetched → 
  📝 Processing text → 
  💾 Saving to database → 
  ✅ Prayer saved → 
  📤 Sending to client
```

---

## **Monitoring Checklist**

- [ ] Token refresh working properly
- [ ] API response times acceptable
- [ ] Database queries executing successfully
- [ ] Error rates within normal range
- [ ] User preferences being saved
- [ ] Cache hits for today's prayers
- [ ] Bible Gateway API availability

---

This comprehensive logging system makes it easy to debug issues, monitor performance, and understand user behavior across all Bible API endpoints!

