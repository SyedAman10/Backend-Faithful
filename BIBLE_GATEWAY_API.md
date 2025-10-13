# Bible Gateway API Integration

This document describes the Bible Gateway API integration for the Faithful Companion backend.

## **Overview**

The backend now uses the **Bible Gateway API** instead of the previous `bible.helloao.org` API. This provides access to:

- **1000+ Bible translations** including copyrighted modern translations like NIV, ESV, NLT, NASB, MSG, etc.
- **Flexible passage retrieval** using OSIS references (e.g., "John 3:16", "Ps 23", "Matt 5:1-10")
- **Search functionality** for finding specific keywords and phrases across translations
- **Official licensing** from Bible publishers

---

## **Setup**

### **1. Get Bible Gateway API Credentials**

You need to register for a Bible Gateway API account:

1. Visit the Bible Gateway Developer Portal
2. Create an account and get your `username` and `password`
3. Note down your credentials

### **2. Configure Environment Variables**

Add your Bible Gateway credentials to your `.env` file:

```env
BIBLE_GATEWAY_USERNAME=your_username_here
BIBLE_GATEWAY_PASSWORD=your_password_here
```

Also update `env-template.txt` for team reference.

### **3. API Token Management**

The backend automatically manages access tokens:
- Tokens are cached and reused until expiration
- Automatic token refresh when expired
- No manual token management required

---

## **API Endpoints**

### **1. Get Available Bible Versions**

Get a list of all Bible translations you have access to.

**Endpoint:**
```
GET /api/bible/versions
```

**Headers:**
```
Authorization: Bearer {jwt_token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bibles": ["niv", "esv", "nlt", "kjv", "nasb", "msg", ...],
    "total": 150
  }
}
```

---

### **2. Get Translation Information**

Get detailed information about a specific Bible translation.

**Endpoint:**
```
GET /api/bible/translation/:bible
```

**Parameters:**
- `bible` - Bible abbreviation (e.g., "niv", "esv", "kjv")

**Example:**
```
GET /api/bible/translation/niv
```

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "New International Version",
    "abbreviation": "NIV",
    "language": "English",
    "publisher": "Biblica",
    ...
  }
}
```

---

### **3. Get Bible Passage**

Retrieve a specific verse, verse range, or complete chapter.

**Endpoint:**
```
GET /api/bible/passage/:bible/:passage
```

**Parameters:**
- `bible` - Bible abbreviation (e.g., "niv", "esv")
- `passage` - OSIS reference (e.g., "John 3:16", "Ps 23", "Matt 5:1-10")

**Examples:**
```
GET /api/bible/passage/niv/John 3:16
GET /api/bible/passage/esv/Ps 23
GET /api/bible/passage/kjv/Matt 5:1-10
GET /api/bible/passage/nlt/1Cor 13
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bible": "niv",
    "passage": "John 3:16",
    "content": "For God so loved the world that he gave his one and only Son..."
  }
}
```

---

### **4. Search Bible**

Search for keywords or phrases within a specific Bible translation.

**Endpoint:**
```
GET /api/bible/search/:bible/:query
```

**Parameters:**
- `bible` - Bible abbreviation (e.g., "niv", "esv")
- `query` - Search term or phrase

**Query Parameters:**
- `search_type` - Type of search: "all" (default), "phrase", or "any"
- `start` - Pagination start (default: 0)
- `limit` - Results per page (default: 100, max: 100)

**Examples:**
```
GET /api/bible/search/niv/love
GET /api/bible/search/esv/faith hope love?search_type=phrase
GET /api/bible/search/kjv/righteousness?limit=20&start=0
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bible": "niv",
    "query": "love",
    "searchType": "all",
    "results": [
      {
        "reference": "John 3:16",
        "text": "For God so loved the world...",
        "score": 0.95
      },
      ...
    ],
    "total": 686,
    "start": 0,
    "limit": 100
  }
}
```

---

### **5. Get Daily Prayer**

Get a daily prayer verse based on category preferences. Returns the same verse per day per user.

**Endpoint:**
```
GET /api/bible/daily-prayer
```

**Query Parameters:**
- `bible` - Optional: Specific Bible version (defaults to user's preference or "niv")
- `category` - Optional: Prayer category (default: "all")

**Available Categories:**
- `comfort` - Verses about comfort and consolation
- `strength` - Verses about strength and courage
- `peace` - Verses about peace and tranquility
- `love` - Verses about God's love
- `hope` - Verses about hope and future
- `faith` - Verses about faith and trust
- `all` - Mix of all categories (default)

**Examples:**
```
GET /api/bible/daily-prayer
GET /api/bible/daily-prayer?category=comfort
GET /api/bible/daily-prayer?bible=esv&category=strength
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bible": "niv",
    "category": "comfort",
    "passage": "Ps 23:1-4",
    "text": "The LORD is my shepherd, I lack nothing...",
    "reference": "Ps 23:1-4",
    "prayedAt": "2025-10-08T10:30:00.000Z",
    "isNew": true
  }
}
```

**Notes:**
- Same verse returned per day per user per category
- `isNew: true` for first request of the day
- `isNew: false` for subsequent requests on the same day
- Verses are randomly selected from curated lists for each category

---

### **6. Update User Bible Version Preference**

Save user's preferred Bible translation.

**Endpoint:**
```
PUT /api/bible/user-bible-version
```

**Headers:**
```
Authorization: Bearer {jwt_token}
```

**Body:**
```json
{
  "bibleVersion": "niv"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Bible version preference updated successfully",
  "data": {
    "userId": 1,
    "bibleVersion": "niv"
  }
}
```

**Response (Invalid Version):**
```json
{
  "success": false,
  "error": "Invalid Bible version",
  "message": "Bible version 'xyz' is not available. Available versions: niv, esv, kjv, ...",
  "availableBibles": ["niv", "esv", "kjv", ...]
}
```

---

### **7. Get User Bible Version Preference**

Retrieve user's saved Bible translation preference.

**Endpoint:**
```
GET /api/bible/user-bible-version
```

**Headers:**
```
Authorization: Bearer {jwt_token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": 1,
    "bibleVersion": "niv"
  }
}
```

---

## **OSIS Reference Format**

Bible Gateway uses **OSIS** (Open Scripture Information Standard) references:

### **Book Abbreviations:**
- Old Testament: Gen, Exod, Lev, Num, Deut, Josh, Judg, Ruth, 1Sam, 2Sam, 1Kgs, 2Kgs, 1Chr, 2Chr, Ezra, Neh, Esth, Job, Ps, Prov, Eccl, Song, Isa, Jer, Lam, Ezek, Dan, Hos, Joel, Amos, Obad, Jonah, Mic, Nah, Hab, Zeph, Hag, Zech, Mal
- New Testament: Matt, Mark, Luke, John, Acts, Rom, 1Cor, 2Cor, Gal, Eph, Phil, Col, 1Thess, 2Thess, 1Tim, 2Tim, Titus, Phlm, Heb, Jas, 1Pet, 2Pet, 1John, 2John, 3John, Jude, Rev

### **Reference Examples:**
- Single verse: `John 3:16`
- Verse range: `John 3:16-18`
- Complete chapter: `Ps 23`
- Multiple chapters: `Gen 1-2`
- Specific verses: `Matt 5:3,5,7`

---

## **Popular Bible Translations**

### **English Translations:**
- **NIV** - New International Version
- **ESV** - English Standard Version
- **NLT** - New Living Translation
- **KJV** - King James Version
- **NASB** - New American Standard Bible
- **MSG** - The Message
- **NKJV** - New King James Version
- **CSB** - Christian Standard Bible
- **AMP** - Amplified Bible
- **HCSB** - Holman Christian Standard Bible

### **Spanish Translations:**
- **NVI** - Nueva Versión Internacional
- **RVR1960** - Reina-Valera 1960
- **LBLA** - La Biblia de las Américas

### **French Translations:**
- **LSG** - Louis Segond
- **BDS** - Bible du Semeur

---

## **Error Handling**

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message"
}
```

### **Common Errors:**
- **400 Bad Request** - Missing parameters or invalid Bible version
- **401 Unauthorized** - Invalid or missing JWT token
- **404 Not Found** - Passage not found in specified translation
- **500 Internal Server Error** - API authentication failed or server error

---

## **Rate Limiting**

Bible Gateway API has rate limits:
- **100 requests per 15 minutes per IP** (enforced by backend)
- Tokens are cached to minimize token generation requests
- Consider implementing additional caching for frequently accessed passages

---

## **Testing**

### **Test Available Versions:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/bible/versions
```

### **Test Get Passage:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/bible/passage/niv/John%203:16
```

### **Test Search:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/api/bible/search/niv/love?limit=10"
```

### **Test Daily Prayer:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/api/bible/daily-prayer?category=comfort"
```

### **Test Update Preference:**
```bash
curl -X PUT -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bibleVersion":"niv"}' \
  http://localhost:3000/api/bible/user-bible-version
```

---

## **Migration Notes**

### **Changes from Previous API:**

1. **Base URL Changed:**
   - Old: `https://bible.helloao.org/api`
   - New: `https://api.biblegateway.com/2`

2. **Authentication Required:**
   - Old: No authentication
   - New: Username/password → access token

3. **Reference Format:**
   - Old: Separate book/chapter/verse parameters
   - New: OSIS references (e.g., "John 3:16")

4. **Endpoint Structure:**
   - Old: `/verse/:translation/:book/:chapter/:verse`
   - New: `/passage/:bible/:passage`

5. **Daily Prayer:**
   - Old: Random verse from random book/chapter
   - New: Curated list of popular verses by category

---

## **Best Practices**

1. **Cache Frequently Accessed Passages:**
   - Popular verses (John 3:16, Ps 23, etc.)
   - Daily prayer verses
   - User's recent passages

2. **Handle Token Expiration:**
   - Backend automatically refreshes tokens
   - Implement retry logic for 401 errors

3. **Validate User Input:**
   - Check Bible version exists before making requests
   - Validate OSIS reference format
   - Sanitize search queries

4. **Optimize Performance:**
   - Batch similar requests when possible
   - Implement pagination for search results
   - Cache translation lists

5. **User Experience:**
   - Show loading states for API calls
   - Provide fallbacks for API failures
   - Save user's last viewed passages

---

## **Support**

For issues or questions:
- Backend repository issues
- Bible Gateway API documentation
- Team Slack channel

---

## **Changelog**

### **Version 2.0 - 2025-10-08**
- Migrated from `bible.helloao.org` to Bible Gateway API
- Added support for NIV, ESV, NLT, and 1000+ translations
- Implemented token caching and automatic refresh
- Updated daily prayer with curated verse lists
- Added Bible search functionality
- Simplified passage retrieval with OSIS references

### **Version 1.0**
- Initial implementation with `bible.helloao.org` API
- Basic verse and chapter retrieval
- Limited to free/open translations (BSB, WEB, etc.)

