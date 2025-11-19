# Google Calendar Authentication Setup - Summary

## ✅ What Was Created

### 1. **New API Endpoints** (in `routes/auth.js`)

Six new endpoints specifically for Google Calendar authentication, **completely separate** from the sign-up flow:

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/auth/google-calendar/url` | GET | ✅ Yes | Get OAuth URL for calendar |
| `/api/auth/google-calendar/callback` | GET | ❌ No | Web OAuth callback |
| `/api/auth/google-calendar/mobile-callback` | GET | ❌ No | Mobile OAuth callback |
| `/api/auth/google-calendar/connect` | POST | ✅ Yes | Connect via POST (mobile) |
| `/api/auth/google-calendar/status` | GET | ✅ Yes | Check connection status |
| `/api/auth/google-calendar/disconnect` | POST | ✅ Yes | Disconnect calendar |

### 2. **Database Changes**

Two new columns added to the `users` table:

```sql
google_calendar_connected BOOLEAN DEFAULT FALSE  -- Explicit connection flag
google_email VARCHAR(255)                         -- Gmail address from OAuth
```

### 3. **Documentation**

- **[GOOGLE_CALENDAR_AUTH.md](./GOOGLE_CALENDAR_AUTH.md)** - Complete API documentation with examples
- **[README.md](./README.md)** - Updated with new features
- **[test-google-calendar-auth.js](./test-google-calendar-auth.js)** - Test script

### 4. **Migration Scripts**

- `config/calendar-connection-migration.sql` - SQL migration
- `scripts/run-calendar-migration.js` - Automated migration runner

---

## 🎯 Key Differences from Sign-Up Endpoints

| Aspect | Sign-Up Endpoints | Calendar Endpoints |
|--------|------------------|-------------------|
| **Base Path** | `/api/auth/google/` | `/api/auth/google-calendar/` |
| **Purpose** | User registration/login | Calendar connection only |
| **Authentication** | Not required | **JWT token required** |
| **User Creation** | Creates new users | Updates existing users |
| **Scopes** | Profile + Calendar | Profile + Calendar + **Gmail** |
| **Email Stored** | `email` column | **`google_email` column** |
| **Connection Flag** | Uses `google_meet_access` | Uses **`google_calendar_connected`** |

---

## 🚀 How to Use

### Step 1: Configure Google Cloud Console

Add these redirect URIs to your Google OAuth 2.0 Client:

```
http://localhost:3000/api/auth/google-calendar/callback
http://localhost:3000/api/auth/google-calendar/mobile-callback
https://your-production-domain.com/api/auth/google-calendar/callback
https://your-production-domain.com/api/auth/google-calendar/mobile-callback
```

### Step 2: Test the Endpoints

```bash
# 1. Login or signup to get a JWT token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 2. Get the OAuth URL (use token from step 1)
curl -X GET "http://localhost:3000/api/auth/google-calendar/url" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 3. Check connection status
curl -X GET "http://localhost:3000/api/auth/google-calendar/status" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Or use the automated test script:

```bash
export TEST_JWT_TOKEN=your_jwt_token_here
node test-google-calendar-auth.js
```

### Step 3: Integrate in Your App

#### Web Application

```javascript
// 1. Get OAuth URL
const response = await fetch('/api/auth/google-calendar/url', {
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});
const { url } = await response.json();

// 2. Redirect user to Google
window.location.href = url;

// 3. After callback, user is redirected to:
// /settings?calendarSuccess=true&email=user@gmail.com
```

#### Mobile Application (React Native)

```javascript
import * as WebBrowser from 'expo-web-browser';

// 1. Get OAuth URL
const response = await fetch(
  `${API_URL}/api/auth/google-calendar/url?platform=mobile`,
  {
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  }
);
const { url } = await response.json();

// 2. Open OAuth in browser
const result = await WebBrowser.openAuthSessionAsync(url);

// 3. Handle the callback in your app
// Deep link: exp://...?success=true&email=user@gmail.com
```

---

## 📊 What This Enables

### For Users Who Signed Up with Email/Password
- Can later connect their Google Calendar
- Doesn't require Google for initial sign-up
- Gives explicit control over calendar access

### For Users Who Signed Up with Google
- Can explicitly grant calendar permissions
- Separates authentication from calendar access
- Can re-authorize if permissions were revoked

### Data Captured
1. **User's actual Gmail address** (`google_email` column)
2. **Calendar access tokens** (for creating events)
3. **Gmail read access** (for future features)
4. **Explicit connection flag** (`google_calendar_connected`)

---

## 🔒 Security Features

1. **JWT Authentication Required** - Only authenticated users can connect calendar
2. **State Parameter** - User ID passed in OAuth state to prevent CSRF
3. **Separate Tokens** - Calendar tokens stored separately from sign-up flow
4. **Explicit Consent** - Users must explicitly authorize calendar access
5. **Disconnect Option** - Users can revoke access at any time

---

## 📝 Database Status

Run this to verify the setup:

```bash
node -e "const { pool } = require('./config/database'); pool.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \\'users\\' AND column_name IN (\\'google_calendar_connected\\', \\'google_email\\')').then(r => { console.log(r.rows); pool.end(); });"
```

Expected output:
```
[
  { column_name: 'google_calendar_connected', data_type: 'boolean' },
  { column_name: 'google_email', data_type: 'character varying' }
]
```

---

## 🎉 Summary

You now have:

✅ **Separate Google Calendar authentication** (not mixed with sign-up)  
✅ **Captures user's actual Gmail email** (stored in `google_email`)  
✅ **Works with email/password users** (doesn't require Google sign-up)  
✅ **Both web and mobile support** (with different callbacks)  
✅ **Complete documentation** (GOOGLE_CALENDAR_AUTH.md)  
✅ **Test scripts** (test-google-calendar-auth.js)  
✅ **Database migrations** (already run successfully)  

---

## 🔗 Next Steps

1. **Configure Google Cloud Console** with the new redirect URIs
2. **Test the endpoints** using the test script
3. **Integrate in your frontend/mobile app** using the examples above
4. **Monitor the logs** - comprehensive logging is already in place

---

## 📚 Further Reading

- [GOOGLE_CALENDAR_AUTH.md](./GOOGLE_CALENDAR_AUTH.md) - Detailed API documentation
- [README.md](./README.md) - Updated project documentation
- [test-google-calendar-auth.js](./test-google-calendar-auth.js) - Test examples

---

**Need help?** Check the comprehensive logging in the server console when testing the endpoints.

