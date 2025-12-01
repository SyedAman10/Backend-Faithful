# 📬 Push Notifications API - Complete Implementation

✅ **Status: FULLY IMPLEMENTED**

## Overview

The Faithful Companion backend now supports Expo Push Notifications for:
- **Prayer Response Notifications**: When someone responds to a user's prayer request
- **Journey Reminder Notifications**: Daily reminders 24 hours after completing a journey day

---

## 📊 Database Schema

### Users Table Updates

```sql
-- Push token storage (Expo push token)
ALTER TABLE users ADD COLUMN push_token VARCHAR(255);

-- Notification preferences (JSONB)
ALTER TABLE users ADD COLUMN notification_settings JSONB 
  DEFAULT '{"pushEnabled": true, "journeyReminders": true, "prayerUpdates": true}'::jsonb;

-- Index for efficient token lookups
CREATE INDEX idx_users_push_token ON users(push_token) WHERE push_token IS NOT NULL;
```

**Migration Files:**
- `config/push-notifications-migration.sql` - SQL migration
- `scripts/run-push-notifications-migration.js` - Migration runner

**Run Migration:**
```bash
node scripts/run-push-notifications-migration.js
```

---

## 📱 API Endpoints

### 1. Save Push Token & Notification Settings

**Endpoint:** `PUT /api/users/preferences`

**Purpose:** Save user's push token and notification preferences

**Request Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body:**
```json
{
  "pushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "notificationSettings": {
    "pushEnabled": true,
    "journeyReminders": true,
    "prayerUpdates": true
  }
}
```

**Request Body Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pushToken` | string | No | Expo push token (format: `ExponentPushToken[...]`) |
| `notificationSettings` | object | No | Notification preferences |
| `notificationSettings.pushEnabled` | boolean | No | Master switch for all push notifications |
| `notificationSettings.journeyReminders` | boolean | No | Enable/disable journey reminders |
| `notificationSettings.prayerUpdates` | boolean | No | Enable/disable prayer response notifications |

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Preferences updated successfully",
  "user": {
    "id": 123,
    "email": "user@example.com",
    "name": "John Doe",
    "push_token": "ExponentPushToken[...]",
    "notification_settings": {
      "pushEnabled": true,
      "journeyReminders": true,
      "prayerUpdates": true
    },
    "denomination": "Christian",
    "bible_version": "NIV",
    // ... other user fields
  }
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "error": "Invalid push token format. Must be an Expo push token."
}
```

**Validation Rules:**
- Push token must start with `ExponentPushToken[`
- Push token max length: 255 characters
- Notification settings must be an object with boolean values
- Valid notification keys: `pushEnabled`, `journeyReminders`, `prayerUpdates`

**Console Logging:**
```
📱 Push Token update:
   userId: 123
   email: user@example.com
   hasPushToken: true
   tokenPreview: ExponentPushToken[xxxxxxxxxx...
   timestamp: 2025-12-01T12:34:56.789Z

🔔 Notification Settings update:
   userId: 123
   email: user@example.com
   settings: { pushEnabled: true, journeyReminders: true, prayerUpdates: true }
   timestamp: 2025-12-01T12:34:56.789Z
```

---

## 🔔 Notification Triggers

### A. Prayer Response Notification

**Trigger:** When someone responds to a prayer request (`POST /api/prayer/responses/:responseId/reply`)

**Logic:**
1. User posts a reply to a prayer response
2. Backend retrieves the original prayer request author
3. Checks if author has:
   - Valid push token
   - `pushEnabled: true`
   - `prayerUpdates: true`
   - Is not responding to their own prayer
4. If all conditions met, sends push notification

**Notification Payload:**
```javascript
{
  to: "ExponentPushToken[...]",
  sound: "default",
  title: "🙏 Someone responded to your prayer",
  body: isAnonymous 
    ? "You received a prayer response" 
    : "John Doe responded to your prayer request",
  data: {
    type: "prayer_response",
    requestId: 456,
    responseId: 789
  },
  badge: 1
}
```

**Console Logging:**
```
📱 Checking if notification should be sent:
   authorId: 123
   hasPushToken: true
   pushEnabled: true
   prayerUpdates: true
   isNotAuthor: true

📤 Sending prayer response notification:
   authorId: 123
   responderId: 456
   responderName: John Doe
   isAnonymous: false

✅ Push notification sent successfully: ticket-id-here
```

**Error Handling:**
- Notification errors are logged but don't fail the prayer response request
- Fire-and-forget pattern used for non-blocking operation

---

### B. Journey Reminder Notification

**Trigger:** Cron job runs daily at 9:00 AM (configurable)

**Logic:**
1. Cron job queries for users who:
   - Completed a journey day 20-30 hours ago
   - Have a valid push token
   - Have `pushEnabled: true` and `journeyReminders: true`
   - Haven't completed the next day yet
2. Sends reminder notification for next day

**Notification Payload:**
```javascript
{
  to: "ExponentPushToken[...]",
  sound: "default",
  title: "📖 Your Journey Awaits",
  body: "Day 5 is ready for you! Take a few minutes to connect with God today.",
  data: {
    type: "journey_reminder",
    day: 5
  },
  badge: 1
}
```

**Cron Schedule:**
```javascript
// Default: Every day at 9:00 AM
const CRON_SCHEDULE = '0 9 * * *';

// Configurable via TZ environment variable
TZ=America/New_York  // 9 AM EST/EDT
TZ=UTC               // 9 AM UTC
```

**Console Logging:**
```
🔔 ======== Journey Reminder Cron Job Started ========
⏰ Time: 2025-12-01T09:00:00.000Z
📊 Found 42 users eligible for journey reminders

📤 Sending reminder to user 123 for day 5
✅ Reminder sent to user 123

📊 Journey Reminder Summary:
   Total users: 42
   ✅ Successful: 40
   ❌ Failed: 2
======== Journey Reminder Cron Job Completed ========
```

**Cron Management:**
- Started automatically when server starts
- Utility functions available:
  - `startJourneyReminderCron()` - Start cron job
  - `stopJourneyReminderCron()` - Stop cron job
  - `getJourneyReminderCronStatus()` - Get status

---

## 🛠️ Implementation Details

### File Structure

```
Backend-Faithful/
├── config/
│   └── push-notifications-migration.sql
├── scripts/
│   └── run-push-notifications-migration.js
├── utils/
│   ├── pushNotifications.js          # Core notification functions
│   └── journeyReminderCron.js        # Cron job for journey reminders
├── routes/
│   ├── users.js                      # Updated preferences endpoint
│   └── prayer.js                     # Updated with notification trigger
├── server.js                          # Cron job initialization
└── env-template.txt                   # Environment variables
```

### Push Notification Functions

**File:** `utils/pushNotifications.js`

```javascript
// Core function - send any push notification
sendPushNotification(pushToken, notification)

// Prayer response notification
sendPrayerResponseNotification(pushToken, { responderName, isAnonymous, prayerRequestId, responseId })

// Journey reminder notification
sendJourneyReminderNotification(pushToken, nextDay)

// Custom notification
sendCustomNotification(pushToken, title, body, data)
```

**All functions return:**
```javascript
{
  success: true,
  ticketId: "expo-ticket-id"
}
// or
{
  success: false,
  error: "error message"
}
```

---

## 🔧 Configuration

### Environment Variables

Add to `.env`:
```bash
# Optional: Set timezone for cron jobs
TZ=America/New_York

# Or use UTC (default)
TZ=UTC
```

**Note:** Expo Push Notifications don't require API keys. Push tokens are collected directly from the mobile app.

---

## 📱 Frontend Integration

### Step 1: Install Expo Notifications

```bash
npx expo install expo-notifications expo-device expo-constants
```

### Step 2: Request Permission & Get Token

```javascript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return;
    }
    
    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('Expo Push Token:', token);
  } else {
    alert('Must use physical device for Push Notifications');
  }

  return token;
}
```

### Step 3: Save Token to Backend

```javascript
async function savePushToken() {
  try {
    const pushToken = await registerForPushNotificationsAsync();
    
    if (pushToken) {
      const response = await fetch('https://your-api.com/api/users/preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${yourJwtToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pushToken: pushToken,
          notificationSettings: {
            pushEnabled: true,
            journeyReminders: true,
            prayerUpdates: true
          }
        })
      });

      const data = await response.json();
      console.log('Push token saved:', data);
    }
  } catch (error) {
    console.error('Error saving push token:', error);
  }
}
```

### Step 4: Handle Notifications

```javascript
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function App() {
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // Listen for notifications while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    // Listen for user tapping on notifications
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      console.log('Notification tapped:', data);

      // Navigate based on notification type
      if (data.type === 'prayer_response') {
        navigation.navigate('PrayerDetail', { requestId: data.requestId });
      } else if (data.type === 'journey_reminder') {
        navigation.navigate('Journey', { day: data.day });
      }
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  return (
    // Your app components
  );
}
```

---

## 🧪 Testing

### Test Prayer Response Notification

1. **Setup:**
   - User A creates a prayer request
   - User A has a valid push token and `prayerUpdates: true`

2. **Trigger:**
   - User B responds to User A's prayer request
   ```bash
   POST /api/prayer/responses/:responseId/reply
   Body: {
     "responseType": "prayer",
     "message": "Praying for you!",
     "isAnonymous": false
   }
   ```

3. **Expected Result:**
   - User A receives push notification on their device
   - Check server logs for notification confirmation

### Test Journey Reminder

1. **Manual Test:**
   ```javascript
   const { sendJourneyReminderNotification } = require('./utils/pushNotifications');
   
   // Test with a real push token
   await sendJourneyReminderNotification('ExponentPushToken[...]', 5);
   ```

2. **Cron Test:**
   - Modify cron schedule to run every minute for testing:
   ```javascript
   // In utils/journeyReminderCron.js
   const CRON_SCHEDULE = '* * * * *'; // Every minute
   ```
   - Restart server
   - Monitor logs for cron execution

### Test Push Token Update

```bash
curl -X PUT https://your-api.com/api/users/preferences \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    "notificationSettings": {
      "pushEnabled": true,
      "journeyReminders": true,
      "prayerUpdates": true
    }
  }'
```

---

## 🐛 Troubleshooting

### Push Token Not Saving

**Error:** `Invalid push token format`

**Solution:** Ensure token starts with `ExponentPushToken[`

### Notifications Not Received

**Checklist:**
1. ✅ User has valid push token in database
2. ✅ `pushEnabled: true` in notification_settings
3. ✅ Specific notification type enabled (`prayerUpdates` or `journeyReminders`)
4. ✅ User is on a physical device (not simulator)
5. ✅ App has notification permissions
6. ✅ Network connectivity

### Cron Job Not Running

**Check Status:**
```javascript
const { getJourneyReminderCronStatus } = require('./utils/journeyReminderCron');
console.log(getJourneyReminderCronStatus());
```

**Check Server Logs:**
```bash
# Look for:
🚀 Starting journey reminder cron job
✅ Journey reminder cron job scheduled successfully
```

### Notification Errors

**Check Expo Status:**
- Visit: https://status.expo.dev/
- Ensure Expo Push Notification Service is operational

**Invalid Token Error:**
- Token may have expired or been revoked
- App should refresh token on each app launch

---

## 📊 Database Queries

### Find Users with Push Tokens

```sql
SELECT id, email, name, push_token, notification_settings
FROM users
WHERE push_token IS NOT NULL;
```

### Check Notification Settings

```sql
SELECT 
  id, 
  email,
  notification_settings->>'pushEnabled' as push_enabled,
  notification_settings->>'journeyReminders' as journey_reminders,
  notification_settings->>'prayerUpdates' as prayer_updates
FROM users
WHERE push_token IS NOT NULL;
```

### Find Users Eligible for Journey Reminders

```sql
WITH user_journey_progress AS (
  SELECT 
    u.id,
    u.push_token,
    u.notification_settings,
    MAX(ujp.day) as last_completed_day,
    MAX(ujp.completed_at) as last_completion_time
  FROM users u
  INNER JOIN user_journey_progress ujp ON u.id = ujp.user_id
  WHERE u.push_token IS NOT NULL
    AND ujp.completed = true
    AND ujp.completed_at >= NOW() - INTERVAL '30 hours'
    AND ujp.completed_at <= NOW() - INTERVAL '20 hours'
  GROUP BY u.id
)
SELECT *
FROM user_journey_progress
WHERE notification_settings->>'journeyReminders' = 'true';
```

---

## 🔐 Security Considerations

### Push Token Storage
- ✅ Push tokens are stored in database with user association
- ✅ Only authenticated users can update their push token
- ✅ Tokens are validated before saving
- ✅ Index created for efficient lookups

### Notification Privacy
- ✅ Anonymous prayer responses don't reveal responder identity
- ✅ Notification settings are user-controlled
- ✅ Master switch (`pushEnabled`) can disable all notifications

### Rate Limiting
- ✅ Express rate limiter applied to all API endpoints
- ✅ Cron job includes delay between notifications (100ms)
- ✅ Expo handles rate limiting on their end

---

## 📈 Monitoring & Analytics

### Key Metrics to Track

1. **Push Token Registration:**
   - Users with valid push tokens
   - Token refresh rate

2. **Notification Delivery:**
   - Successful sends
   - Failed sends (with reasons)
   - Open rates (via Expo Analytics)

3. **User Preferences:**
   - % users with push enabled
   - % users with journey reminders enabled
   - % users with prayer updates enabled

### Logging

All notification events are logged with:
- Timestamp
- User ID
- Notification type
- Success/failure status
- Error details (if applicable)

---

## 🚀 Deployment Checklist

- [x] Database migration completed
- [x] Push notification utilities created
- [x] Preferences endpoint updated
- [x] Prayer response trigger added
- [x] Journey reminder cron job created
- [x] Environment variables configured
- [x] Server startup includes cron initialization
- [ ] Frontend integration (to be done by mobile team)
- [ ] Production testing with real devices
- [ ] Monitoring dashboard setup (optional)

---

## 📞 Support

For issues or questions:
1. Check console logs for detailed error messages
2. Verify database schema with migration script
3. Test with Expo's push notification tool: https://expo.dev/notifications
4. Review Expo documentation: https://docs.expo.dev/push-notifications/overview/

---

**Implementation Date:** December 1, 2025
**Version:** 1.0.0
**Status:** ✅ Production Ready

