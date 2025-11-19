# Google Calendar Authentication Flow Diagram

## 🔄 Complete Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     USER AUTHENTICATION FLOWS                        │
└─────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────┐    ┌────────────────────────────────┐
│    SIGN-UP/LOGIN FLOW          │    │   CALENDAR CONNECTION FLOW      │
│   (Existing endpoints)         │    │   (NEW - Separate endpoints)    │
└────────────────────────────────┘    └────────────────────────────────┘

OPTION 1: Email/Password Sign-Up          User Already Authenticated
                                                      │
    POST /api/auth/signup                             │
    ├─ email                                          ▼
    ├─ password              ┌─────────────────────────────────────────┐
    └─ name                  │  GET /api/auth/google-calendar/url      │
         │                   │  Headers: Authorization: Bearer {token} │
         ▼                   └─────────────────────────────────────────┘
    ✅ JWT Token                              │
                                              │ Returns OAuth URL with
                                              │ user ID in state param
OPTION 2: Google Sign-Up                      ▼
                              ┌──────────────────────────────────────────┐
    GET /api/auth/google/url  │  User clicks "Connect Google Calendar"   │
         │                    │  Browser opens OAuth consent screen      │
         ▼                    └──────────────────────────────────────────┘
    User authorizes                           │
         │                                    │ User authorizes:
         ▼                                    │ ✓ Calendar access
    Google callback                           │ ✓ Gmail read access
         │                                    ▼
         ▼               ┌───────────────────────────────────────────────┐
    ✅ JWT Token         │  Google redirects with code + state (userId)  │
                         └───────────────────────────────────────────────┘
                                              │
        ┌─────────────────────────────────────┴──────────────────┐
        │                                                          │
        ▼                                                          ▼
┌─────────────────────┐                              ┌─────────────────────┐
│   WEB CALLBACK      │                              │   MOBILE CALLBACK    │
└─────────────────────┘                              └─────────────────────┘
        │                                                          │
        │ GET /api/auth/google-calendar/callback                  │
        │   ?code=xxx&state=userId                                │
        │                                                          │
        ├─ Exchange code for tokens                               │
        ├─ Fetch Gmail address                                    │
        ├─ Update user record:                 GET /api/auth/google-calendar/
        │  ├─ google_access_token                    mobile-callback
        │  ├─ google_refresh_token                   ?code=xxx&state=userId
        │  ├─ google_calendar_connected = TRUE             │
        │  └─ google_email = user@gmail.com                │
        │                                        ├─ Exchange code for tokens
        ▼                                        ├─ Fetch Gmail address
    Redirect to:                                ├─ Update user record
    /settings?calendarSuccess=true              │  ├─ google_access_token
    &email=user@gmail.com                       │  ├─ google_refresh_token
                                                │  ├─ google_calendar_connected
                                                │  └─ google_email
                                                │
                                                ▼
                                            Deep link redirect:
                                            exp://...?success=true
                                            &email=user@gmail.com

        ┌─────────────────────────────────────────────────────────┐
        │            ALTERNATIVE: POST METHOD (Mobile)            │
        └─────────────────────────────────────────────────────────┘
                                    │
                                    ▼
        POST /api/auth/google-calendar/connect
        Headers: Authorization: Bearer {token}
        Body: { "code": "authorization_code" }
                                    │
                                    ├─ Exchange code for tokens
                                    ├─ Fetch Gmail address
                                    ├─ Update user record
                                    │
                                    ▼
        JSON Response:
        {
          "success": true,
          "googleEmail": "user@gmail.com",
          "calendarConnected": true,
          "gmailConnected": true
        }
```

---

## 📊 Database State Changes

```
BEFORE Calendar Connection:
┌──────────────────────────────────────────────────────────────────┐
│ users table                                                      │
├──────────────────────────────────────────────────────────────────┤
│ id: 123                                                          │
│ email: "user@example.com"                                        │
│ name: "John Doe"                                                 │
│ google_access_token: NULL                                        │
│ google_refresh_token: NULL                                       │
│ google_calendar_connected: FALSE  ← Not connected                │
│ google_email: NULL                ← No Gmail address             │
│ google_meet_access: FALSE                                        │
└──────────────────────────────────────────────────────────────────┘

AFTER Calendar Connection:
┌──────────────────────────────────────────────────────────────────┐
│ users table                                                      │
├──────────────────────────────────────────────────────────────────┤
│ id: 123                                                          │
│ email: "user@example.com"          ← App email (unchanged)       │
│ name: "John Doe"                                                 │
│ google_access_token: "ya29.a0AfH6..."  ← Calendar access         │
│ google_refresh_token: "1//0g..."       ← For token refresh       │
│ google_calendar_connected: TRUE    ← ✅ Connected                │
│ google_email: "john@gmail.com"     ← ✅ Gmail address            │
│ google_meet_access: TRUE           ← ✅ Can create meetings      │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Features Comparison

```
┌───────────────────────────────┬────────────────┬──────────────────┐
│ Feature                       │ Sign-Up Flow   │ Calendar Flow    │
├───────────────────────────────┼────────────────┼──────────────────┤
│ Base URL Path                 │ /auth/google/  │ /auth/google-    │
│                               │                │ calendar/        │
├───────────────────────────────┼────────────────┼──────────────────┤
│ Authentication Required       │ No             │ Yes (JWT)        │
├───────────────────────────────┼────────────────┼──────────────────┤
│ Purpose                       │ User account   │ Calendar access  │
│                               │ creation       │ only             │
├───────────────────────────────┼────────────────┼──────────────────┤
│ Creates New Users             │ Yes            │ No               │
├───────────────────────────────┼────────────────┼──────────────────┤
│ Updates Existing Users        │ Yes            │ Yes              │
├───────────────────────────────┼────────────────┼──────────────────┤
│ OAuth Scopes                  │ • profile      │ • profile        │
│                               │ • email        │ • email          │
│                               │ • calendar     │ • calendar       │
│                               │                │ • gmail.readonly │
├───────────────────────────────┼────────────────┼──────────────────┤
│ Stores Gmail Address          │ No             │ Yes              │
├───────────────────────────────┼────────────────┼──────────────────┤
│ State Parameter               │ None           │ User ID          │
├───────────────────────────────┼────────────────┼──────────────────┤
│ Database Column               │ Various        │ google_email +   │
│                               │                │ google_calendar_ │
│                               │                │ connected        │
└───────────────────────────────┴────────────────┴──────────────────┘
```

---

## 🎯 Use Cases

### Use Case 1: Email Sign-Up User Wants Calendar
```
1. User signs up with email/password
   POST /api/auth/signup
   
2. User gets JWT token

3. Later, user wants to connect calendar
   GET /api/auth/google-calendar/url
   (requires JWT token)
   
4. User authorizes Google Calendar

5. User's account now has both:
   - App email (user@example.com)
   - Gmail email (user@gmail.com)
```

### Use Case 2: Google Sign-Up User Re-Authorizes
```
1. User signs up with Google
   GET /api/auth/google/url
   
2. User initially denies calendar permissions

3. Later, user changes mind
   GET /api/auth/google-calendar/url
   (requires JWT token)
   
4. User authorizes calendar this time

5. Calendar access is now enabled
```

### Use Case 3: Check Connection Status
```
User wants to see if calendar is connected

GET /api/auth/google-calendar/status
Headers: Authorization: Bearer {token}

Response:
{
  "calendarConnected": true,
  "googleEmail": "user@gmail.com",
  "googleMeetAccess": true
}
```

### Use Case 4: Disconnect Calendar
```
User wants to revoke calendar access

POST /api/auth/google-calendar/disconnect
Headers: Authorization: Bearer {token}

Response:
{
  "success": true,
  "message": "Google Calendar disconnected successfully"
}
```

---

## 🔐 Security Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY MEASURES                            │
└─────────────────────────────────────────────────────────────────┘

1. JWT Authentication Required
   ├─ User must be logged in
   ├─ Valid JWT token in Authorization header
   └─ Prevents unauthorized calendar connections

2. State Parameter (CSRF Protection)
   ├─ User ID encoded in OAuth state
   ├─ Verified on callback
   └─ Ensures authorization links to correct user

3. Separate Token Storage
   ├─ Calendar tokens separate from sign-up
   ├─ Can be revoked independently
   └─ google_calendar_connected flag tracks status

4. Explicit Consent
   ├─ User must manually click "Connect Calendar"
   ├─ Google shows explicit permission screen
   └─ User can deny specific scopes

5. Disconnect Option
   ├─ POST /api/auth/google-calendar/disconnect
   ├─ Clears all Google tokens
   └─ Sets google_calendar_connected = FALSE
```

---

## 📱 Platform Support

```
┌────────────────────────┐     ┌────────────────────────┐
│    WEB PLATFORM        │     │   MOBILE PLATFORM      │
└────────────────────────┘     └────────────────────────┘

GET /google-calendar/url       GET /google-calendar/url
                               ?platform=mobile
        │                              │
        ▼                              ▼
OAuth URL generated           OAuth URL generated
        │                              │
        ▼                              ▼
User redirects to Google      User opens in browser
        │                              │
        ▼                              ▼
Google callback               Google callback
        │                              │
        ▼                              ▼
GET /google-calendar/         GET /google-calendar/
    callback                      mobile-callback
        │                              │
        │                              ├─ Can return JSON
        ▼                              └─ Or redirect to deep link
Redirect to /settings                  │
?calendarSuccess=true                  ▼
                              exp://app/calendar/callback
                              ?success=true

Alternative Mobile Option:
POST /google-calendar/connect
Body: { "code": "xxx" }
        │
        ▼
Direct JSON response
No redirects needed
```

---

## 🎉 What You Get

After connecting Google Calendar, your users have:

✅ **Calendar Integration**
   - Create events with Google Meet links
   - Manage recurring meetings
   - Send calendar invitations

✅ **Gmail Access**
   - Read-only access to Gmail
   - Can fetch user's Gmail address
   - Future feature: email notifications

✅ **User Profile**
   - App email: `email` column
   - Gmail email: `google_email` column
   - Connection status: `google_calendar_connected`

✅ **Security & Control**
   - Explicit user authorization
   - Can disconnect at any time
   - Tokens stored securely
   - JWT authentication required

---

## 📚 Documentation Files

- **GOOGLE_CALENDAR_AUTH.md** - Full API documentation
- **CALENDAR_AUTH_SETUP_SUMMARY.md** - This summary
- **CALENDAR_AUTH_FLOW_DIAGRAM.md** - Flow diagrams
- **README.md** - Updated project documentation
- **test-google-calendar-auth.js** - Test script

