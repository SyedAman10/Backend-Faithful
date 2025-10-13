# 🚀 Bible Gateway API Setup Guide

## **Quick Start**

This guide will help you set up the Bible Gateway API integration for accessing NIV, ESV, NLT, and 1000+ other Bible translations.

---

## **Step 1: Get Bible Gateway API Credentials**

1. **Register for Bible Gateway Developer Account:**
   - Go to: https://www.biblegateway.com/
   - Create an account or log in
   - Navigate to the Developer/API section
   - Request API access (if not already available)

2. **Note Your Credentials:**
   - Username: `your_username`
   - Password: `your_password`

---

## **Step 2: Update Environment Variables**

1. **Open your `.env` file** (or create one from `env-template.txt`):
   ```bash
   cp env-template.txt .env
   ```

2. **Add Bible Gateway credentials:**
   ```env
   # Bible Gateway API Configuration
   BIBLE_GATEWAY_USERNAME=your_actual_username_here
   BIBLE_GATEWAY_PASSWORD=your_actual_password_here
   ```

3. **Save the file**

---

## **Step 3: Restart Your Server**

```bash
npm start
```

The server will automatically:
- ✅ Connect to Bible Gateway API
- ✅ Request an access token
- ✅ Cache the token for reuse
- ✅ Refresh the token when expired

---

## **Step 4: Test the Integration**

### **Test 1: Get Available Versions**

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/bible/versions
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "bibles": ["niv", "esv", "nlt", "kjv", "nasb", "msg", ...],
    "total": 150
  }
}
```

### **Test 2: Get a Passage (NIV)**

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/bible/passage/niv/John%203:16
```

**Expected Response:**
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

### **Test 3: Daily Prayer**

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/api/bible/daily-prayer?bible=niv&category=comfort"
```

**Expected Response:**
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

---

## **Step 5: Update User Preferences**

### **Set User's Preferred Bible Version:**

```bash
curl -X PUT -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bibleVersion":"niv"}' \
  http://localhost:3000/api/bible/user-bible-version
```

Now the user's daily prayers and default passages will use NIV!

---

## **Common Issues**

### **Issue 1: "Failed to authenticate with Bible Gateway API"**

**Solution:**
- Check your username and password in `.env`
- Ensure you have API access enabled
- Restart the server after updating `.env`

### **Issue 2: "Bible version 'NIV' is not available"**

**Solution:**
- Your Bible Gateway account may have limited access
- Check which translations you have access to:
  ```bash
  curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
    http://localhost:3000/api/bible/versions
  ```
- Use one of the available translations

### **Issue 3: Token Expiration Errors**

**Solution:**
- The backend automatically refreshes tokens
- If issues persist, restart the server to clear token cache

---

## **Available Bible Translations**

### **Popular English Translations:**
- `niv` - New International Version ⭐ Most popular
- `esv` - English Standard Version
- `nlt` - New Living Translation
- `kjv` - King James Version
- `nasb` - New American Standard Bible
- `msg` - The Message
- `nkjv` - New King James Version
- `csb` - Christian Standard Bible
- `amp` - Amplified Bible

### **Spanish Translations:**
- `nvi` - Nueva Versión Internacional
- `rvr1960` - Reina-Valera 1960
- `lbla` - La Biblia de las Américas

### **French Translations:**
- `lsg` - Louis Segond
- `bds` - Bible du Semeur

---

## **API Endpoints Summary**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/bible/versions` | GET | List available Bible translations |
| `/api/bible/translation/:bible` | GET | Get translation information |
| `/api/bible/passage/:bible/:passage` | GET | Get specific verse/chapter |
| `/api/bible/search/:bible/:query` | GET | Search Bible for keywords |
| `/api/bible/daily-prayer` | GET | Get daily prayer verse |
| `/api/bible/user-bible-version` | GET | Get user's preferred version |
| `/api/bible/user-bible-version` | PUT | Update user's preferred version |

---

## **Migration from Old API**

### **What Changed:**

1. **✅ NIV and Modern Translations Available**
   - Old API: Only free translations (BSB, WEB)
   - New API: 1000+ translations including NIV, ESV, NLT

2. **✅ Simplified Passage Retrieval**
   - Old API: `/verse/:translation/:book/:chapter/:verse`
   - New API: `/passage/:bible/John 3:16`

3. **✅ Search Functionality**
   - Old API: No search
   - New API: Full-text search across translations

4. **✅ Curated Daily Prayers**
   - Old API: Random verses
   - New API: Curated verses by category (comfort, strength, peace, etc.)

### **No Code Changes Needed for Mobile App:**

The backend maintains backward compatibility where possible. If you're using:
- `GET /api/bible/daily-prayer` - Still works! ✅
- `GET /api/bible/user-bible-version` - Still works! ✅
- `PUT /api/bible/user-bible-version` - Still works! ✅

Just update user preferences to use "niv", "esv", or other Bible Gateway translations.

---

## **Next Steps**

1. ✅ Complete Steps 1-5 above
2. ✅ Test all endpoints
3. ✅ Update mobile app to use new translations
4. ✅ Test daily prayer feature
5. ✅ Deploy to production

---

## **Support & Documentation**

- **Full API Documentation:** `BIBLE_GATEWAY_API.md`
- **Environment Template:** `env-template.txt`
- **Backend Repository:** [Your repo URL]

---

## **Troubleshooting**

If you encounter any issues:

1. **Check server logs:**
   ```bash
   npm start
   ```
   Look for:
   - ✅ `Bible Gateway token obtained successfully`
   - ❌ `Failed to get Bible Gateway token`

2. **Verify environment variables:**
   ```bash
   echo $BIBLE_GATEWAY_USERNAME
   echo $BIBLE_GATEWAY_PASSWORD
   ```

3. **Test API directly:**
   ```bash
   curl "https://api.biblegateway.com/2/request_access_token?username=YOUR_USERNAME&password=YOUR_PASSWORD"
   ```

---

## **✅ Congratulations!**

You now have access to 1000+ Bible translations including NIV, ESV, NLT, and more! 🎉

Your users can now:
- ✅ Read their preferred Bible version
- ✅ Get daily prayers in NIV or any other translation
- ✅ Search the Bible for specific keywords
- ✅ Access modern, easy-to-read translations

**Happy coding! 🚀**

