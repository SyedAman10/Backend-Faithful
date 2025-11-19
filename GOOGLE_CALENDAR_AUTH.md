# Google Calendar Authentication API

This document describes the **separate Google Calendar authentication endpoints** that are distinct from the user sign-up flow. These endpoints allow authenticated users to explicitly connect their Google Calendar and Gmail access.

## Overview

These endpoints provide a separate authentication flow specifically for Google Calendar that:
- **Is independent from sign-up**: Users can be authenticated via email/password or Google sign-up, then separately connect their calendar
- **Captures Gmail email**: Gets the actual Gmail address associated with the Google account
- **Grants Calendar & Gmail access**: Requests calendar and Gmail read permissions
- **Maintains security**: Requires existing authentication (JWT token) to prevent unauthorized connections

## Key Differences from Sign-Up Endpoints

| Feature | Sign-Up Endpoints | Calendar Endpoints |
|---------|------------------|-------------------|
| Base Path | `/api/auth/google/` | `/api/auth/google-calendar/` |
| Authentication Required | No | Yes (JWT token) |
| Primary Purpose | User registration/login | Calendar & Gmail connection |
| User Creation | Creates new users | Updates existing users |
| Scopes Requested | Profile, Calendar | Profile, Calendar, **Gmail** |

## Database Schema

### New Columns in `users` Table

```sql
google_calendar_connected BOOLEAN DEFAULT FALSE  -- Explicit calendar connection flag
google_email VARCHAR(255)                         -- Gmail address from OAuth
```

## Migration

Run the migration to add new columns:

```bash
node scripts/run-calendar-migration.js
```

Or manually execute:

```bash
psql -d your_database < config/calendar-connection-migration.sql
```

## API Endpoints

### 1. Get Calendar OAuth URL

**Endpoint:** `GET /api/auth/google-calendar/url`

**Authentication:** Required (JWT token in Authorization header)

**Query Parameters:**
- `platform` (optional): `web` or `mobile` (default: `web`)

**Description:** Generates a Google OAuth URL specifically for calendar/Gmail authorization. The user's ID is passed in the `state` parameter to link the authorization back to their account.

**Request:**
```bash
curl -X GET "http://localhost:3000/api/auth/google-calendar/url?platform=mobile" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "url": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "message": "Please authorize calendar access"
}
```

**OAuth Scopes Requested:**
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`
- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/gmail.readonly` *(Gmail access)*

---

### 2. Web Calendar OAuth Callback

**Endpoint:** `GET /api/auth/google-calendar/callback`

**Authentication:** Not required (public callback endpoint)

**Query Parameters:**
- `code` (required): Authorization code from Google
- `state` (required): User ID passed in OAuth request
- `error` (optional): Error from Google OAuth

**Description:** Handles the OAuth callback for web applications. Exchanges the code for tokens, retrieves user info including Gmail address, and updates the user record.

**Behavior:**
- On success: Redirects to `{FRONTEND_URL}/settings?calendarSuccess=true&email={googleEmail}`
- On error: Redirects to `{FRONTEND_URL}/settings?calendarError={errorMessage}`

---

### 3. Mobile Calendar OAuth Callback

**Endpoint:** `GET /api/auth/google-calendar/mobile-callback`

**Authentication:** Not required (public callback endpoint)

**Query Parameters:**
- `code` (required): Authorization code from Google
- `state` (required): User ID passed in OAuth request
- `error` (optional): Error from Google OAuth

**Description:** Handles the OAuth callback for mobile applications. Similar to web callback but redirects to Expo deep link.

**Behavior:**
- On success: Redirects to `{EXPO_RETURN_URL}?success=true&email={googleEmail}&calendarConnected=true`
- On error: Redirects to `{EXPO_RETURN_URL}?error={errorType}&message={errorMessage}`
- If `Accept: application/json` header is present, returns JSON instead of redirect

**JSON Response (when requested):**
```json
{
  "success": true,
  "googleEmail": "user@gmail.com",
  "calendarConnected": true,
  "message": "Google Calendar connected successfully"
}
```

---

### 4. Mobile Calendar Connect (POST)

**Endpoint:** `POST /api/auth/google-calendar/connect`

**Authentication:** Required (JWT token)

**Request Body:**
```json
{
  "code": "4/0AY0e-g7..."
}
```

**Description:** Alternative mobile endpoint using POST instead of redirect. Accepts authorization code, exchanges it for tokens, and updates user record.

**Request:**
```bash
curl -X POST "http://localhost:3000/api/auth/google-calendar/connect" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "4/0AY0e-g7..."}'
```

**Response:**
```json
{
  "success": true,
  "googleEmail": "user@gmail.com",
  "calendarConnected": true,
  "gmailConnected": true,
  "message": "Google Calendar and Gmail connected successfully"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Calendar connection failed",
  "message": "Invalid authorization code"
}
```

---

### 5. Get Calendar Connection Status

**Endpoint:** `GET /api/auth/google-calendar/status`

**Authentication:** Required (JWT token)

**Description:** Check if the authenticated user has connected their Google Calendar.

**Request:**
```bash
curl -X GET "http://localhost:3000/api/auth/google-calendar/status" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "calendarConnected": true,
  "googleEmail": "user@gmail.com",
  "googleMeetAccess": true
}
```

---

### 6. Disconnect Google Calendar

**Endpoint:** `POST /api/auth/google-calendar/disconnect`

**Authentication:** Required (JWT token)

**Description:** Disconnect Google Calendar and remove stored tokens.

**Request:**
```bash
curl -X POST "http://localhost:3000/api/auth/google-calendar/disconnect" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Google Calendar disconnected successfully"
}
```

---

## Integration Flow

### Web Application Flow

1. **User clicks "Connect Google Calendar" in settings**
2. **Frontend calls** `GET /api/auth/google-calendar/url` with user's JWT token
3. **Backend responds** with OAuth URL containing user ID in `state` parameter
4. **User is redirected** to Google OAuth consent screen
5. **User authorizes** calendar and Gmail access
6. **Google redirects** to `/api/auth/google-calendar/callback?code=...&state={userId}`
7. **Backend exchanges** code for tokens and retrieves Gmail address
8. **Backend updates** user record with tokens and sets `google_calendar_connected = TRUE`
9. **User is redirected** back to settings page with success message

### Mobile Application Flow (Option 1: Redirect)

1. **User taps "Connect Google Calendar"**
2. **App calls** `GET /api/auth/google-calendar/url?platform=mobile` with JWT
3. **Backend responds** with OAuth URL
4. **App opens** OAuth URL in browser (using `Linking.openURL` or `WebBrowser`)
5. **User authorizes** in browser
6. **Google redirects** to `/api/auth/google-calendar/mobile-callback`
7. **Backend processes** and redirects to deep link: `exp://...?success=true&email=...`
8. **App receives** deep link and updates UI

### Mobile Application Flow (Option 2: POST with Code)

1. **User taps "Connect Google Calendar"**
2. **App calls** `GET /api/auth/google-calendar/url?platform=mobile`
3. **App opens** OAuth URL in WebBrowser with redirect set
4. **App intercepts** callback URL and extracts `code` parameter
5. **App calls** `POST /api/auth/google-calendar/connect` with code
6. **Backend returns** JSON response directly
7. **App updates** UI based on response

---

## Environment Variables

Ensure these variables are set in your `.env` file:

```env
# Google OAuth credentials
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here

# Backend URL (used for redirect URIs)
BACKEND_URL=http://localhost:3000
# or for ngrok:
# BACKEND_URL=https://your-ngrok-url.ngrok-free.app

# Frontend URL (for web redirects)
FRONTEND_URL=http://localhost:3000

# Expo return URL (for mobile deep links)
EXPO_RETURN_URL=exp://127.0.0.1:8081/--/calendar/callback
```

---

## Google Cloud Console Configuration

Add these redirect URIs to your Google OAuth 2.0 Client:

### Web Redirects
```
http://localhost:3000/api/auth/google-calendar/callback
https://your-production-domain.com/api/auth/google-calendar/callback
https://your-ngrok-url.ngrok-free.app/api/auth/google-calendar/callback
```

### Mobile Redirects
```
http://localhost:3000/api/auth/google-calendar/mobile-callback
https://your-production-domain.com/api/auth/google-calendar/mobile-callback
https://your-ngrok-url.ngrok-free.app/api/auth/google-calendar/mobile-callback
```

---

## Security Considerations

1. **Authentication Required**: All OAuth URL generation endpoints require a valid JWT token
2. **State Parameter**: User ID is passed in `state` to prevent CSRF attacks and ensure authorization is linked to correct user
3. **Token Storage**: Access and refresh tokens are securely stored in database
4. **Scope Limitation**: Only requests necessary scopes (calendar.events and gmail.readonly)
5. **Separate from Sign-up**: Keeps calendar authorization separate from user registration

---

## Error Handling

### Common Errors

| Error | Description | Resolution |
|-------|-------------|------------|
| `Missing authorization code` | OAuth callback received without code | User may have denied access - retry authorization |
| `Invalid authorization code` | Code has expired or already been used | Generate new OAuth URL and retry |
| `User not found` | Invalid user ID in state parameter | Ensure user is authenticated before starting OAuth flow |
| `Calendar connection failed` | Token exchange failed | Check Google Cloud Console configuration and redirect URIs |

### Error Logging

All endpoints include comprehensive logging:
- 📅 Calendar-specific operations
- 🔑 Token exchange status
- 👤 User info retrieval
- ✅/❌ Success/failure indicators

---

## Testing

### Test Web Flow

1. Start your server: `node server.js`
2. Get a JWT token by logging in
3. Call the URL endpoint:
```bash
curl -X GET "http://localhost:3000/api/auth/google-calendar/url" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```
4. Open the returned URL in a browser
5. Authorize the application
6. Verify user is redirected to settings with success parameter

### Test Mobile Flow

1. Use the same process but with `?platform=mobile`
2. Test deep link handling in your Expo app
3. Verify the app receives the success callback

### Check Connection Status

```bash
curl -X GET "http://localhost:3000/api/auth/google-calendar/status" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Database Queries

### Check Calendar Connections

```sql
SELECT 
  id, 
  email, 
  google_email, 
  google_calendar_connected,
  google_meet_access,
  created_at,
  updated_at
FROM users
WHERE google_calendar_connected = TRUE;
```

### Find Users with Gmail Connected

```sql
SELECT 
  id, 
  email AS app_email, 
  google_email AS gmail_email
FROM users
WHERE google_email IS NOT NULL;
```

---

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Verify Google Cloud Console redirect URI configuration
3. Ensure all required scopes are enabled in Google Cloud Console
4. Verify environment variables are correctly set
5. Test with fresh authorization codes (codes expire quickly)

---

## Version History

- **v1.0.0** (2024) - Initial release with separate calendar authentication endpoints

