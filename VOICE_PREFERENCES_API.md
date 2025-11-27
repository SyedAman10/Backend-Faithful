# Voice Preferences API Documentation

## Overview

Voice preferences allow users to save their preferred text-to-speech voice settings for Bible reading and other app features.

---

## 🎤 Voice Preference Fields

Two new fields have been added to user preferences:

| Field | Type | Max Length | Description | Example |
|-------|------|------------|-------------|---------|
| `voiceId` | VARCHAR | 200 chars | Voice identifier from iOS/Android TTS | `com.apple.ttsbundle.Samantha-compact` |
| `voiceName` | VARCHAR | 100 chars | Human-readable voice name | `Samantha (Enhanced)` |

---

## 📝 API Endpoints

### 1. Save Voice Preferences

**Endpoint:** `PUT /api/users/preferences`

**Authentication:** Required (JWT token)

**Description:** Updates user preferences including voice settings.

**Request:**
```bash
PUT /api/users/preferences
Authorization: Bearer {token}
Content-Type: application/json
```

**Body:**
```json
{
  "voiceId": "com.apple.ttsbundle.Samantha-compact",
  "voiceName": "Samantha (Enhanced)"
}
```

**Full Body (All Preferences):**
```json
{
  "denomination": "Baptist",
  "bibleVersion": "KJV",
  "ageGroup": "25-34",
  "referralSource": "Friend",
  "bibleAnswers": "Daily devotional",
  "bibleSpecific": "Morning prayer",
  "voiceId": "com.apple.ttsbundle.Samantha-compact",
  "voiceName": "Samantha (Enhanced)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Preferences updated successfully",
  "user": {
    "id": 123,
    "email": "user@example.com",
    "name": "John Doe",
    "denomination": "Baptist",
    "bible_version": "KJV",
    "age_group": "25-34",
    "referral_source": "Friend",
    "bible_answers": "Daily devotional",
    "bible_specific": "Morning prayer",
    "voice_id": "com.apple.ttsbundle.Samantha-compact",
    "voice_name": "Samantha (Enhanced)",
    "profile_completed": true,
    "updated_at": "2024-11-20T12:00:00.000Z"
  }
}
```

---

### 2. Load Voice Preferences

**Endpoint:** `GET /api/users/profile`

**Authentication:** Required (JWT token)

**Description:** Returns user profile including voice preferences.

**Request:**
```bash
GET /api/users/profile
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 123,
    "email": "user@example.com",
    "name": "John Doe",
    "picture": "https://...",
    "google_meet_access": true,
    "denomination": "Baptist",
    "bible_version": "KJV",
    "age_group": "25-34",
    "referral_source": "Friend",
    "bible_answers": "Daily devotional",
    "bible_specific": "Morning prayer",
    "voice_id": "com.apple.ttsbundle.Samantha-compact",
    "voice_name": "Samantha (Enhanced)",
    "profile_completed": true,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-11-20T12:00:00.000Z"
  }
}
```

---

## 🎯 Use Cases

### Use Case 1: iOS App Voice Selection

```javascript
// User selects voice in settings
const selectedVoice = {
  id: "com.apple.ttsbundle.Samantha-compact",
  name: "Samantha (Enhanced)"
};

// Save to backend
await fetch('/api/users/preferences', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    voiceId: selectedVoice.id,
    voiceName: selectedVoice.name
  })
});
```

### Use Case 2: Load Saved Voice on App Start

```javascript
// Load user preferences
const response = await fetch('/api/users/profile', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { user } = await response.json();

// Use saved voice or default
const voiceId = user.voice_id || 'com.apple.voice.compact.en-US.Samantha';
const voiceName = user.voice_name || 'Samantha';

// Initialize TTS with saved voice
await Speech.speak(text, {
  voice: voiceId
});
```

### Use Case 3: Update Only Voice Preference

```javascript
// Update just the voice, leave other preferences unchanged
await fetch('/api/users/preferences', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    voiceId: "com.apple.ttsbundle.Alex-compact",
    voiceName: "Alex"
  })
});
```

---

## 🎤 Common Voice IDs

### iOS Voices

```javascript
const iOSVoices = [
  {
    id: "com.apple.ttsbundle.Samantha-compact",
    name: "Samantha (Enhanced)",
    language: "en-US"
  },
  {
    id: "com.apple.ttsbundle.Alex-compact",
    name: "Alex",
    language: "en-US"
  },
  {
    id: "com.apple.voice.compact.en-US.Zoe",
    name: "Zoe",
    language: "en-US"
  },
  {
    id: "com.apple.voice.compact.en-GB.Daniel",
    name: "Daniel",
    language: "en-GB"
  }
];
```

### Android Voices

```javascript
const androidVoices = [
  {
    id: "en-us-x-sfg#female_1-local",
    name: "US English Female",
    language: "en-US"
  },
  {
    id: "en-us-x-iom#male_1-local",
    name: "US English Male",
    language: "en-US"
  },
  {
    id: "en-gb-x-rjs#male_1-local",
    name: "British English Male",
    language: "en-GB"
  }
];
```

---

## 🔧 Validation

### Voice ID Validation
- **Max Length:** 200 characters
- **Optional:** Can be null/undefined
- **Format:** Any string (no specific format enforced)

### Voice Name Validation
- **Max Length:** 100 characters
- **Optional:** Can be null/undefined
- **Format:** Human-readable string

### Error Responses

**Voice ID too long:**
```json
{
  "success": false,
  "error": "Voice ID must be 200 characters or less"
}
```

**Voice name too long:**
```json
{
  "success": false,
  "error": "Voice name must be 100 characters or less"
}
```

---

## 📊 Database Schema

### Users Table (Updated)

```sql
-- Voice preference columns
voice_id VARCHAR(200),              -- Voice identifier
voice_name VARCHAR(100),            -- Human-readable name

-- Index for faster lookups
CREATE INDEX idx_users_voice_id ON users(voice_id);
```

**Comments:**
- `voice_id`: Text-to-speech voice identifier (e.g., com.apple.ttsbundle.Samantha-compact)
- `voice_name`: Human-readable voice name (e.g., Samantha (Enhanced))

---

## 🚀 Migration

The voice preference columns have been added automatically.

### Verify Migration

```sql
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('voice_id', 'voice_name');
```

---

## 🧪 Testing

### Test Voice Preference Save

```bash
curl -X PUT "http://localhost:3000/api/users/preferences" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "voiceId": "com.apple.ttsbundle.Samantha-compact",
    "voiceName": "Samantha (Enhanced)"
  }'
```

### Test Voice Preference Load

```bash
curl -X GET "http://localhost:3000/api/users/profile" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test Update Only Voice

```bash
# This will update only voice, leaving other preferences unchanged
curl -X PUT "http://localhost:3000/api/users/preferences" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "voiceId": "com.apple.ttsbundle.Alex-compact",
    "voiceName": "Alex"
  }'
```

---

## 📝 Summary

✅ **Database:** Added `voice_id` and `voice_name` columns  
✅ **PUT Endpoint:** Updated to accept voice preferences  
✅ **GET Endpoint:** Returns voice preferences  
✅ **Validation:** Max length checks (200 for ID, 100 for name)  
✅ **Backward Compatible:** Voice fields are optional  
✅ **Migration:** Completed successfully  

---

## 📚 Related Endpoints

- `PUT /api/users/preferences` - Save all user preferences (including voice)
- `GET /api/users/profile` - Load user profile (includes voice)
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/stats` - Get user statistics

---

## 🎉 Ready to Use!

Your app can now save and load voice preferences using the existing user preferences system. The voice settings will persist across sessions and devices (when user logs in).

**Example Flow:**
1. User selects voice in app settings
2. App calls `PUT /api/users/preferences` with voice data
3. Next time app opens, `GET /api/users/profile` returns saved voice
4. App uses saved voice for TTS features

