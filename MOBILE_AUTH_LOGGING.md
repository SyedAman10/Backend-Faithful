# Mobile Google Authentication - Return URLs & Logging Guide

## 🔗 Return URLs Configuration

### 1. **Backend Callback URL** (Google OAuth redirects here)
```
http://152.53.190.3:3000/api/auth/google/mobile-callback
```

**What happens here:**
- Google redirects to this URL after user authorization
- Your backend processes the authorization code
- Backend then redirects to your mobile app

### 2. **Mobile App Return URL** (Deep link back to your app)
```
exp://127.0.0.1:8081/--/auth/callback
```

**Configuration:**
- Set via `EXPO_RETURN_URL` environment variable
- Default fallback: `exp://127.0.0.1:8081/--/auth/callback`
- For production: `exp://your-app-scheme/--/auth/callback`

## 📱 Complete Mobile Authentication Flow

### Step 1: Get OAuth URL
```
GET http://152.53.190.3:3000/api/auth/google/url?platform=mobile
```
**Response:** Google OAuth URL with `redirect_uri=http://152.53.190.3:3000/api/auth/google/mobile-callback`

### Step 2: User Authorizes with Google
- Mobile app opens Google OAuth URL in WebView/browser
- User signs in and authorizes your app
- Google redirects to: `http://152.53.190.3:3000/api/auth/google/mobile-callback?code=AUTHORIZATION_CODE`

### Step 3: Backend Processes Callback
- Backend receives the authorization code
- Backend redirects to: `exp://127.0.0.1:8081/--/auth/callback?code=AUTHORIZATION_CODE`

### Step 4: Mobile App Completes Authentication
```
POST http://152.53.190.3:3000/api/auth/google/mobile
Body: { "code": "AUTHORIZATION_CODE" }
```
**Response:** JWT token + user data

## 🔍 Enhanced Logging System

### 1. **OAuth URL Generation** (`/google/url`)
```
🚀 OAuth URL Request: { platform, userAgent, accept, timestamp }
🔧 OAuth Client Selected: { platform, clientType, redirectUri }
🔗 Generated OAuth URL: { platform, url, urlLength, containsRedirectUri, timestamp }
```

### 2. **Mobile Callback** (`/google/mobile-callback`)
```
📱 Mobile Callback Received: { method, url, query, headers, timestamp }
🔍 Callback Parameters: { code, codeLength, googleError, state, hasCode }
🔗 Using Expo return URL: exp://127.0.0.1:8081/--/auth/callback
📋 Response Type Check: { wantsJson, acceptHeader, willReturnJson }
📤 Sending JSON Response: { success, code, redirectUrl, message }
🔄 Full redirect URL: exp://127.0.0.1:8081/--/auth/callback?code=...
```

### 3. **Mobile Authentication** (`/google/mobile`)
```
📱 Mobile Authentication Request: { method, url, body, headers, timestamp }
🔍 Request Body Analysis: { hasCode, codeLength, codePreview, bodyKeys }
🔄 Starting token exchange with Google...
🔑 Google Tokens Received: { hasAccessToken, hasRefreshToken, accessTokenLength, refreshTokenLength, tokenExchangeTime, timestamp }
✅ OAuth client credentials set
👤 Fetching user info from Google...
👤 User Info Received: { email, name, hasPicture, pictureUrl, userInfoFetchTime, timestamp }
💾 Processing user authentication...
```

### 4. **User Authentication Processing** (`handleUserAuth`)
```
🔍 UserInfo received: { ... }
✅ Extracted user data: { googleId, email, name, hasPicture }
🔍 Checking if user exists in database...
📊 Database Query Result: { userFound, queryTime, timestamp }
🆕 Creating new user in database... (or 🔄 Updating existing user...)
✅ New user created: { userId, email, insertTime, timestamp }
🔐 Generating JWT token...
✅ JWT token generated: { tokenLength, jwtTime, timestamp }
🎯 handleUserAuth completed successfully: { userId, email, hasToken, totalTime, timestamp }
```

### 5. **Final Response**
```
📤 Sending Success Response: { success, hasToken, tokenLength, userEmail, timestamp }
```

## 🛠️ Environment Variables Required

```bash
# Google OAuth
GOOGLE_CLIENT_ID=1019455265952-8k2njj865hs65mthr0ghn92fblt3rq30.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# JWT
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
JWT_EXPIRES_IN=7d

# Mobile App
EXPO_RETURN_URL=exp://127.0.0.1:8081/--/auth/callback

# Backend URLs
BACKEND_URL=http://152.53.190.3:3000
FRONTEND_URL=http://152.53.190.3:3000
```

## 🔧 Google Cloud Console Configuration

### Authorized Redirect URIs:
1. `http://152.53.190.3:3000/api/auth/google/mobile-callback` (Production)
2. `http://localhost:3000/api/auth/google/mobile-callback` (Development)

### Authorized JavaScript Origins:
1. `http://152.53.190.3:3000` (Production)
2. `http://localhost:3000` (Development)

## 📊 Performance Monitoring

The logging system tracks:
- **Token Exchange Time**: How long Google takes to return tokens
- **User Info Fetch Time**: How long to get user profile from Google
- **Database Operation Time**: How long user creation/update takes
- **JWT Generation Time**: How long token creation takes
- **Total Authentication Time**: End-to-end authentication duration

## 🚨 Error Handling

### Common Error Scenarios:
1. **No Authorization Code**: `error=NoCode`
2. **Invalid Code**: `error=InvalidCode`
3. **Google OAuth Error**: `error=GoogleOAuthError&message=...`
4. **Authentication Failed**: `error=AuthFailed&message=...`

### Error Response Format:
```json
{
  "success": false,
  "error": "ErrorType",
  "message": "Detailed error message",
  "redirectUrl": "exp://...?error=ErrorType&message=..."
}
```

## 🔍 Debugging Tips

1. **Check Console Logs**: All steps are logged with timestamps
2. **Monitor Network Requests**: Track the OAuth flow in browser dev tools
3. **Verify Redirect URIs**: Ensure Google Cloud Console has correct redirect URIs
4. **Check Environment Variables**: Verify all required env vars are set
5. **Monitor Database**: Check if users are being created/updated correctly

## 📱 Mobile App Integration Example

```javascript
// Get OAuth URL
const response = await fetch('http://152.53.190.3:3000/api/auth/google/url?platform=mobile');
const { url } = await response.json();

// Open OAuth in WebView
const result = await WebBrowser.openAuthSessionAsync(url, 'exp://127.0.0.1:8081/--/auth/callback');

if (result.type === 'success') {
  // Extract code from URL
  const urlParams = new URLSearchParams(result.url.split('?')[1]);
  const code = urlParams.get('code');
  
  // Complete authentication
  const authResponse = await fetch('http://152.53.190.3:3000/api/auth/google/mobile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });
  
  const { token, user } = await authResponse.json();
  // Store token and navigate to main app
}
```
