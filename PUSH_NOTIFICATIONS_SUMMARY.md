# 📬 Push Notifications - Quick Reference

## ✅ Implementation Complete

### What Was Implemented

1. **Database Schema** ✅
   - `push_token` column (VARCHAR 255)
   - `notification_settings` column (JSONB)
   - Index for efficient lookups
   - Migration: `node scripts/run-push-notifications-migration.js`

2. **API Endpoint** ✅
   - `PUT /api/users/preferences` - Save push token & settings

3. **Notification Triggers** ✅
   - Prayer responses (when someone replies)
   - Journey reminders (daily cron at 9 AM)

---

## 📱 Quick Start - Frontend

### 1. Install Packages
```bash
npx expo install expo-notifications expo-device expo-constants
```

### 2. Get Push Token
```javascript
import * as Notifications from 'expo-notifications';

const token = (await Notifications.getExpoPushTokenAsync()).data;
// Returns: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
```

### 3. Save to Backend
```javascript
await fetch('https://your-api.com/api/users/preferences', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    pushToken: token,
    notificationSettings: {
      pushEnabled: true,
      journeyReminders: true,
      prayerUpdates: true
    }
  })
});
```

### 4. Handle Notifications
```javascript
Notifications.addNotificationResponseReceivedListener(response => {
  const data = response.notification.request.content.data;
  
  if (data.type === 'prayer_response') {
    navigation.navigate('PrayerDetail', { requestId: data.requestId });
  } else if (data.type === 'journey_reminder') {
    navigation.navigate('Journey', { day: data.day });
  }
});
```

---

## 🔧 Backend Files Created/Modified

### New Files
- `config/push-notifications-migration.sql`
- `scripts/run-push-notifications-migration.js`
- `utils/pushNotifications.js`
- `utils/journeyReminderCron.js`

### Modified Files
- `routes/users.js` - Added push token handling
- `routes/prayer.js` - Added notification trigger
- `server.js` - Initialize cron job
- `env-template.txt` - Added TZ variable

---

## 📊 Notification Types

### 1. Prayer Response
**When:** Someone responds to your prayer request
**Title:** "🙏 Someone responded to your prayer"
**Body:** "John Doe responded to your prayer request" (or "You received a prayer response" if anonymous)
**Data:**
```json
{
  "type": "prayer_response",
  "requestId": 456,
  "responseId": 789
}
```

### 2. Journey Reminder
**When:** 24 hours after completing a journey day (sent at 9 AM)
**Title:** "📖 Your Journey Awaits"
**Body:** "Day 5 is ready for you! Take a few minutes to connect with God today."
**Data:**
```json
{
  "type": "journey_reminder",
  "day": 5
}
```

---

## 🎛️ User Preferences

### Default Settings (applied automatically)
```json
{
  "pushEnabled": true,
  "journeyReminders": true,
  "prayerUpdates": true
}
```

### How Users Control Notifications
- **pushEnabled**: Master switch (disables all notifications)
- **journeyReminders**: Toggle journey reminders on/off
- **prayerUpdates**: Toggle prayer response notifications on/off

---

## 🔍 Testing

### Test Prayer Notification
1. User A creates prayer request (with push token saved)
2. User B responds to prayer
3. User A receives notification

### Test Journey Reminder
```bash
# Check cron logs (server console)
🔔 ======== Journey Reminder Cron Job Started ========
📊 Found 42 users eligible for journey reminders
✅ Reminder sent to user 123
```

### Manual Test
```javascript
const { sendJourneyReminderNotification } = require('./utils/pushNotifications');
await sendJourneyReminderNotification('ExponentPushToken[...]', 5);
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid push token format" | Ensure token starts with `ExponentPushToken[` |
| Notifications not received | Check: token saved, pushEnabled=true, physical device, permissions granted |
| Cron not running | Check server logs for "Journey reminder cron job scheduled successfully" |
| Token expired | Refresh token on each app launch |

---

## 📝 Environment Variables

Add to `.env`:
```bash
TZ=America/New_York  # Set timezone for cron jobs (optional, defaults to UTC)
```

**Note:** No API keys needed for Expo Push Notifications!

---

## 🗄️ Database Queries

**Check user's push settings:**
```sql
SELECT 
  email,
  push_token,
  notification_settings->>'pushEnabled' as push_enabled,
  notification_settings->>'journeyReminders' as journey_reminders,
  notification_settings->>'prayerUpdates' as prayer_updates
FROM users
WHERE id = 123;
```

**Count users with push enabled:**
```sql
SELECT COUNT(*) 
FROM users 
WHERE push_token IS NOT NULL 
  AND notification_settings->>'pushEnabled' = 'true';
```

---

## 📞 Support Resources

- Full Documentation: `PUSH_NOTIFICATIONS_COMPLETE.md`
- Expo Docs: https://docs.expo.dev/push-notifications/overview/
- Test Tool: https://expo.dev/notifications
- Expo Status: https://status.expo.dev/

---

## ✅ Deployment Checklist

- [x] Run database migration
- [x] Update environment variables
- [x] Restart server
- [ ] Frontend integration (mobile team)
- [ ] Test on physical devices
- [ ] Monitor for 24 hours

---

**Status:** ✅ Backend Ready - Awaiting Frontend Integration
**Date:** December 1, 2025

