# Gemini AI Integration for Daily Prayer

This document describes how the Daily Prayer feature uses Google's Gemini AI to validate Bible versions and generate meaningful verses.

---

## **Overview**

The Daily Prayer endpoint now uses **Gemini AI** instead of the Bible Gateway API to:
1. ✅ Validate the user's selected Bible version
2. ✅ Generate appropriate Bible verses based on categories
3. ✅ Provide fallback to NIV if the version is invalid
4. ✅ Return real, accurate Bible verses from the user's preferred translation

---

## **Setup**

### **1. Get Gemini API Key**

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the API key

### **2. Configure Environment Variables**

Add to your `.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### **3. Install Dependencies**

The Gemini AI package is already installed:

```bash
npm install @google/generative-ai
```

---

## **How It Works**

### **Flow Diagram**

```
User Request
    ↓
Get user's Bible preference from database
    ↓
Check if prayer already exists for today
    ↓ (if not)
Generate prompt with Bible version & category
    ↓
Call Gemini AI API
    ↓
Validate Bible version
    ↓
Get verse from specified version
    ↓
Parse AI response
    ↓
Save to database
    ↓
Return to user
```

---

## **Bible Version Validation**

Gemini AI validates the Bible version by:

1. **Checking against known versions:**
   - NIV (New International Version)
   - KJV (King James Version)
   - ESV (English Standard Version)
   - NLT (New Living Translation)
   - NASB (New American Standard Bible)
   - MSG (The Message)
   - CSB (Christian Standard Bible)
   - AMP (Amplified Bible)
   - NKJV (New King James Version)
   - And many more...

2. **Fallback behavior:**
   - If version is unrecognized → defaults to NIV
   - Provides message explaining the fallback
   - Still returns valid verse

---

## **API Request/Response**

### **Request:**

```bash
GET /api/bible/daily-prayer?category=comfort
Authorization: Bearer {jwt_token}
```

**Query Parameters:**
- `bible` (optional) - Override user's saved preference
- `category` (optional) - comfort, strength, peace, love, hope, faith, all (default)

### **Response:**

```json
{
  "success": true,
  "data": {
    "bible": "NIV",
    "originalBibleRequested": "NIV",
    "category": "comfort",
    "passage": "Psalm 23:1-4",
    "text": "The LORD is my shepherd, I lack nothing. He makes me lie down in green pastures, he leads me beside quiet waters, he refreshes my soul. He guides me along the right paths for his name's sake. Even though I walk through the darkest valley, I will fear no evil, for you are with me; your rod and your staff, they comfort me.",
    "reference": "Psalm 23:1-4",
    "prayedAt": "2025-10-08T10:30:00.000Z",
    "isNew": true,
    "validationMessage": null,
    "isValidBibleVersion": true
  }
}
```

### **Response with Invalid Bible Version:**

If user had "INVALID_VERSION" saved:

```json
{
  "success": true,
  "data": {
    "bible": "NIV",
    "originalBibleRequested": "INVALID_VERSION",
    "category": "comfort",
    "passage": "Psalm 23:1",
    "text": "The LORD is my shepherd, I lack nothing.",
    "reference": "Psalm 23:1",
    "prayedAt": "2025-10-08T10:30:00.000Z",
    "isNew": true,
    "validationMessage": "Bible version 'INVALID_VERSION' not recognized, using NIV instead",
    "isValidBibleVersion": false
  }
}
```

---

## **Categories**

Each category provides verses related to specific themes:

| Category | Description |
|----------|-------------|
| `comfort` | Comfort, consolation, peace in difficult times, reassurance |
| `strength` | Strength, courage, perseverance, overcoming challenges |
| `peace` | Peace, calmness, tranquility, rest, inner peace |
| `love` | God's love, compassion, mercy, grace, loving others |
| `hope` | Hope, future, promises, expectations, faith in God's plan |
| `faith` | Faith, trust, belief, confidence in God, spiritual growth |
| `all` | General encouragement, daily living, spiritual growth (default) |

---

## **Gemini AI Prompt Structure**

The AI receives this prompt:

```
You are a Christian spiritual guide. The user has selected "[VERSION]" as their preferred Bible version.

Task: Provide ONE meaningful Bible verse that relates to: [CATEGORY_DESCRIPTION]

Requirements:
1. Validate that "[VERSION]" is a valid Bible version (NIV, KJV, ESV, NLT, NASB, MSG, CSB, AMP, NKJV, etc.)
2. If "[VERSION]" is valid, provide a verse from that version
3. If "[VERSION]" is not recognized, use NIV as default and mention this
4. Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "isValid": true or false,
  "bibleVersion": "the version used",
  "reference": "Book Chapter:Verse (e.g., John 3:16)",
  "text": "the complete verse text from [VERSION]",
  "message": "optional message if version was changed"
}

Important: Provide an actual, real Bible verse from the specified version. Do not make up verses.
```

---

## **Logging**

Comprehensive logging is included:

```
🙏 Get Daily Prayer Request
  - userId: 123
  - bible: NIV
  - category: comfort

🔍 Fetching user Bible preference from database...

📚 User Bible preference retrieved
  - usingBible: NIV

🔍 Checking for existing prayer today...

📊 Database query result
  - foundExistingPrayer: false

🎲 No existing prayer found, generating with Gemini AI...
  - bibleVersion: NIV
  - category: comfort

🤖 Using Gemini AI to generate daily verse...

📝 Gemini AI prompt prepared
  - bibleVersion: NIV
  - category: comfort
  - categoryDescription: comfort, consolation, peace in difficult times...

🌐 Calling Gemini AI API...

📥 Gemini AI response received
  - responseLength: 234
  - responsePreview: {"isValid": true, "bibleVersion": "NIV"...

✅ AI response parsed successfully
  - isValid: true
  - bibleVersion: NIV
  - reference: Psalm 23:1-4
  - hasText: true
  - textLength: 280

📝 Verse data extracted
  - originalBibleVersion: NIV
  - actualBibleVersion: NIV
  - reference: Psalm 23:1-4
  - wasValidated: true

💾 Saving prayer to database...

✅ Prayer saved to database successfully

✅ Daily prayer generated successfully

📤 Sending new prayer to client
```

---

## **Benefits**

### **Compared to Bible Gateway API:**

1. ✅ **Automatic Validation** - AI validates Bible version
2. ✅ **Intelligent Fallbacks** - Uses appropriate default if invalid
3. ✅ **No API Rate Limits** - (Gemini has generous free tier)
4. ✅ **Contextual Verses** - AI understands category context better
5. ✅ **Multiple Versions** - Access to all major Bible translations
6. ✅ **User-Friendly Messages** - Clear communication if version changed

---

## **Error Handling**

### **Gemini AI Not Configured:**

```json
{
  "success": false,
  "error": "AI service not configured",
  "message": "Please configure GEMINI_API_KEY in environment variables"
}
```

### **AI Response Parse Error:**

```json
{
  "success": false,
  "error": "Failed to parse AI response",
  "message": "The AI service returned an invalid response"
}
```

### **General API Error:**

```json
{
  "success": false,
  "error": "Failed to retrieve daily prayer",
  "message": "[Error details]"
}
```

---

## **Caching**

- ✅ Prayers are cached per user per day per category
- ✅ Same prayer returned for all requests on the same day
- ✅ New prayer generated next day
- ✅ Cached prayers stored in database

---

## **Testing**

### **Test with Valid Bible Version:**

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/bible/daily-prayer?category=comfort"
```

### **Test with Invalid Bible Version:**

First set an invalid version:
```bash
curl -X PUT -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bibleVersion":"INVALID_VERSION"}' \
  http://localhost:3000/api/bible/user-bible-version
```

Then request daily prayer:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/bible/daily-prayer?category=peace"
```

Expected: AI will use NIV and provide message about fallback.

---

## **Gemini AI Model Used**

- **Model Name:** `gemini-1.5-pro`
- **API Version:** v1beta
- **Capabilities:** Text generation, JSON output, contextual understanding

## **Gemini AI Free Tier Limits**

- **60 requests per minute**
- **1,500 requests per day**
- **1 million tokens per month**

This is more than enough for most applications. Each daily prayer request uses approximately 100-200 tokens.

---

## **Future Enhancements**

Potential improvements:

1. **Verse Variety** - Request multiple verses and rotate
2. **Personalization** - Consider user's prayer history
3. **Multilingual** - Support for non-English Bible versions
4. **Contextual Prayers** - Based on time of day, season, etc.
5. **Reflection/Commentary** - AI-generated reflection on the verse

---

## **Troubleshooting**

### **Issue: "AI service not configured"**

**Solution:** Add `GEMINI_API_KEY` to your `.env` file and restart server.

### **Issue: Verses seem inaccurate**

**Solution:** The AI aims for accuracy but may occasionally vary slightly. Consider implementing a verification step or using a more specific prompt.

### **Issue: Rate limit errors**

**Solution:** Implement request throttling or upgrade to Gemini AI paid tier.

---

## **Security Notes**

- ✅ API key stored in environment variables (never committed to repo)
- ✅ User authentication required for all requests
- ✅ AI responses validated and sanitized
- ✅ Database queries use parameterized statements (SQL injection safe)

---

This Gemini AI integration provides a powerful, flexible, and user-friendly way to deliver daily Bible verses while automatically validating and handling different Bible versions! 🙏✨

