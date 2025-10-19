# Google Account Linking for Email Users

## Overview

This guide explains how users who signed up with email/password can link their Google account to enable Google Meet and Google Calendar features for study groups.

## The Problem

When users sign up with email/password (not Google OAuth), they don't have Google Calendar access. This prevents them from:
- Creating study groups with Google Meet
- Scheduling meetings with Google Calendar integration

## The Solution

Users can now link their Google account to their existing email account. This allows them to:
- ✅ Keep their original email/password login
- ✅ Add Google Calendar and Google Meet capabilities
- ✅ Create and manage study groups with video conferencing

---

## 🔄 User Flow

### 1. Email User Signs Up
```http
POST /api/auth/signup
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "john@example.com",
    "name": "John Doe",
    "picture": null,
    "googleMeetAccess": false
  }
}
```

### 2. User Tries to Create Study Group (Fails)
```http
POST /api/study-groups/create
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "title": "Bible Study Group",
  "scheduledTime": "2025-10-25T18:00:00Z"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Google Calendar access not granted",
  "message": "To create study groups with Google Meet, you need to link your Google account. Please authenticate with Google Calendar first.",
  "requiresGoogleAuth": true,
  "helpText": "Use the /api/auth/google/link-url endpoint to get the OAuth URL, then call /api/auth/link-google with the authorization code."
}
```

### 3. Get Google OAuth URL for Linking
```http
GET /api/auth/google/link-url
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "url": "https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email...",
  "message": "Use this URL to authorize Google Calendar access for creating study groups"
}
```

### 4. User Authorizes Google Account

The frontend should:
1. Open the OAuth URL in a browser/webview
2. User logs in with their Google account
3. User grants Calendar and Meet permissions
4. Google redirects back with an authorization code

### 5. Link Google Account with Authorization Code
```http
POST /api/auth/link-google
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "code": "4/0AQlEd8y..."
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Google account linked successfully. You can now create study groups with Google Meet.",
  "user": {
    "id": 1,
    "email": "john@example.com",
    "name": "John Doe",
    "picture": "https://lh3.googleusercontent.com/...",
    "googleMeetAccess": true,
    "googleEmail": "john.google@gmail.com"
  }
}
```

### 6. Create Study Group (Now Works!)
```http
POST /api/study-groups/create
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "title": "Bible Study Group",
  "description": "Weekly Bible study and discussion",
  "scheduledTime": "2025-10-25T18:00:00Z",
  "durationMinutes": 60
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Study group created successfully",
  "data": {
    "id": 123,
    "title": "Bible Study Group",
    "meetLink": "https://meet.google.com/abc-defg-hij",
    "meetId": "event_id_from_google_calendar",
    "scheduledTime": "2025-10-25T18:00:00.000Z",
    "durationMinutes": 60
  }
}
```

---

## 🔐 Important Notes

### Account Security
- ✅ **Original email login is preserved**: Users can still log in with `john@example.com` and their password
- ✅ **Google account is separate**: The linked Google account (`john.google@gmail.com`) is only used for Calendar/Meet features
- ✅ **No duplicate accounts**: The system prevents linking a Google account that's already linked to another user

### Login Methods After Linking

After linking, users have **one login method**:
- **Email/Password Login**: Continue using original email and password

The Google account is **only for Calendar/Meet features**, not for authentication.

---

## 📊 Database Schema

The `users` table supports both authentication methods:

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  -- Email/Password fields (for email signup)
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  
  -- Google OAuth fields (for Google Calendar/Meet)
  google_id VARCHAR(255) UNIQUE,
  google_email VARCHAR(255),
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_meet_access BOOLEAN DEFAULT FALSE,
  
  -- Common fields
  name VARCHAR(255),
  picture TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Field Explanations

| Field | Purpose |
|-------|---------|
| `email` | Primary email for login (never changes) |
| `password_hash` | For email/password authentication |
| `google_id` | Google user ID (from OAuth) |
| `google_email` | Email from Google account (may differ from primary email) |
| `google_access_token` | For making Google API calls |
| `google_refresh_token` | For refreshing expired access tokens |
| `google_meet_access` | Flag indicating if user can create Google Meet links |

---

## 🎯 User Scenarios

### Scenario 1: Email User Links Google
1. Signs up with `john@example.com` / password
2. Links Google account `john.google@gmail.com`
3. Logs in with `john@example.com` / password
4. Can create study groups with Google Meet

### Scenario 2: Separate Emails
1. Signs up with work email `john@company.com` / password
2. Links personal Gmail `john.personal@gmail.com`
3. Logs in with `john@company.com` / password
4. Google Calendar events use `john.personal@gmail.com`

### Scenario 3: Email User Never Links Google
1. Signs up with `jane@example.com` / password
2. Never links Google account
3. Cannot create study groups with scheduled times
4. Can still browse and join existing study groups

---

## 🚀 Frontend Implementation Example (React Native)

```javascript
// Check if user needs to link Google
const createStudyGroup = async (groupData) => {
  try {
    const response = await fetch('https://api.example.com/api/study-groups/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(groupData)
    });
    
    const data = await response.json();
    
    if (!response.ok && data.requiresGoogleAuth) {
      // User needs to link Google account
      Alert.alert(
        'Google Account Required',
        data.message,
        [
          {
            text: 'Link Google Account',
            onPress: () => linkGoogleAccount()
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }
    
    // Success! Study group created
    return data;
  } catch (error) {
    console.error('Error creating study group:', error);
  }
};

// Link Google account flow
const linkGoogleAccount = async () => {
  try {
    // Step 1: Get OAuth URL
    const urlResponse = await fetch('https://api.example.com/api/auth/google/link-url', {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    const { url } = await urlResponse.json();
    
    // Step 2: Open browser for OAuth (using WebBrowser or similar)
    const result = await WebBrowser.openAuthSessionAsync(
      url,
      'your-app://auth-callback'
    );
    
    if (result.type === 'success') {
      // Extract authorization code from URL
      const code = new URL(result.url).searchParams.get('code');
      
      // Step 3: Link account with code
      const linkResponse = await fetch('https://api.example.com/api/auth/link-google', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      });
      
      const linkData = await linkResponse.json();
      
      if (linkData.success) {
        Alert.alert('Success', 'Google account linked successfully!');
        // Update user data in your state
        setUser(linkData.user);
      }
    }
  } catch (error) {
    console.error('Error linking Google account:', error);
  }
};
```

---

## ⚠️ Error Handling

### Common Errors

#### Error: Google account already linked to another user
```json
{
  "success": false,
  "error": "This Google account is already linked to another user",
  "message": "Please use a different Google account"
}
```

**Solution**: User should use a different Google account for linking.

#### Error: Authorization code invalid
```json
{
  "success": false,
  "error": "Failed to link Google account",
  "message": "invalid_grant: Malformed auth code"
}
```

**Solution**: The authorization code expired or was already used. User should restart the OAuth flow.

---

## 🔍 Testing the Flow

### 1. Create Email User
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 2. Try Creating Study Group (Should Fail)
```bash
curl -X POST http://localhost:3000/api/study-groups/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Group",
    "scheduledTime": "2025-10-25T18:00:00Z"
  }'
```

### 3. Get Link URL
```bash
curl -X GET http://localhost:3000/api/auth/google/link-url \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Visit URL in Browser, Authorize, Get Code

### 5. Link Google Account
```bash
curl -X POST http://localhost:3000/api/auth/link-google \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "4/0AQlEd8y..."
  }'
```

### 6. Try Creating Study Group Again (Should Succeed)
```bash
curl -X POST http://localhost:3000/api/study-groups/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Group",
    "scheduledTime": "2025-10-25T18:00:00Z",
    "durationMinutes": 60
  }'
```

---

## 📝 Summary

This implementation allows:
- ✅ Users to sign up with email/password
- ✅ Later link Google account for Calendar/Meet features
- ✅ Keep original email login credentials
- ✅ Separate authentication (email) from Google API access
- ✅ Secure handling of OAuth tokens
- ✅ Clear error messages guiding users to link their account

The user experience is seamless: users can start with a simple email signup and add Google features when needed, without creating duplicate accounts or losing their original login credentials.

