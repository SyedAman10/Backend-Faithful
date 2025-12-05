# 📬 Push Notifications - Frontend Implementation Prompt

Copy and paste this into your frontend Cursor chat:

---

## 🎯 IMPLEMENTATION REQUEST

I need to implement push notifications in our React Native Expo app. The backend API is already complete and ready.

### ✅ Backend APIs Available

1. **Save Push Token**
   - Endpoint: `PUT /api/users/preferences`
   - Saves push token and notification settings

2. **Notification Types We'll Receive**
   - Prayer responses: When someone replies to user's prayer
   - Journey reminders: Daily reminders 24 hours after completing a journey day

---

## 📋 IMPLEMENTATION REQUIREMENTS

### Step 1: Install Required Packages
```bash
npx expo install expo-notifications expo-device expo-constants
```

### Step 2: Request Permissions & Get Push Token

Create a utility function that:
- Requests notification permissions (iOS & Android)
- Gets Expo push token
- Returns the token in format: `ExponentPushToken[...]`

### Step 3: Send Token to Backend

After user logs in or on app startup:
- Call: `PUT /api/users/preferences`
- Headers: 
  - `Authorization: Bearer {jwtToken}`
  - `Content-Type: application/json`
- Body:
```json
{
  "pushToken": "ExponentPushToken[xxxxxx]",
  "notificationSettings": {
    "pushEnabled": true,
    "journeyReminders": true,
    "prayerUpdates": true
  }
}
```

### Step 4: Configure Notification Handler

Set up notification behavior:
- Show alert when app is foregrounded
- Play sound
- Update badge

### Step 5: Handle Notification Taps

Listen for user tapping notifications and navigate based on `data.type`:

**Prayer Response Notification:**
```json
{
  "type": "prayer_response",
  "requestId": 456,
  "responseId": 789
}
```
→ Navigate to Prayer Detail screen

**Journey Reminder Notification:**
```json
{
  "type": "journey_reminder",
  "day": 5
}
```
→ Navigate to Journey Day screen

### Step 6: Settings UI (Optional but Recommended)

Create a settings screen where users can toggle:
- Master switch: Enable/disable all push notifications
- Journey reminders: Toggle journey reminder notifications
- Prayer updates: Toggle prayer response notifications

Update backend when user changes settings:
```json
PUT /api/users/preferences
{
  "notificationSettings": {
    "pushEnabled": false,  // User toggled
    "journeyReminders": true,
    "prayerUpdates": false
  }
}
```

---

## 🎨 SUGGESTED FILE STRUCTURE

```
src/
├── utils/
│   └── pushNotifications.js       # Core notification logic
├── hooks/
│   └── usePushNotifications.js    # React hook for notifications
├── screens/
│   └── NotificationSettingsScreen.js  # Settings UI
└── navigation/
    └── linkingConfig.js           # Deep linking config
```

---

## 📱 CODE EXAMPLES TO IMPLEMENT

### 1. Push Notifications Utility (utils/pushNotifications.js)

```javascript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Request permissions and get push token
export async function registerForPushNotificationsAsync() {
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
  } else {
    alert('Must use physical device for Push Notifications');
  }

  return token;
}

// Send token to backend
export async function savePushTokenToBackend(pushToken, jwtToken, apiUrl) {
  try {
    const response = await fetch(`${apiUrl}/api/users/preferences`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
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
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to save push token');
    }

    console.log('✅ Push token saved successfully');
    return data;
  } catch (error) {
    console.error('❌ Error saving push token:', error);
    throw error;
  }
}
```

### 2. React Hook (hooks/usePushNotifications.js)

```javascript
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync, savePushTokenToBackend } from '../utils/pushNotifications';

export function usePushNotifications(navigation, authToken, apiUrl) {
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // Register for push notifications and save token
    async function setupNotifications() {
      if (authToken) {
        const pushToken = await registerForPushNotificationsAsync();
        if (pushToken) {
          await savePushTokenToBackend(pushToken, authToken, apiUrl);
        }
      }
    }

    setupNotifications();

    // Listen for notifications while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 Notification received:', notification);
    });

    // Listen for user tapping on notifications
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      
      console.log('👆 Notification tapped:', data);

      // Navigate based on notification type
      if (data.type === 'prayer_response') {
        navigation.navigate('PrayerDetail', { 
          requestId: data.requestId,
          responseId: data.responseId 
        });
      } else if (data.type === 'journey_reminder') {
        navigation.navigate('Journey', { 
          day: data.day 
        });
      }
    });

    // Cleanup
    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, [authToken, navigation, apiUrl]);
}
```

### 3. Use in App Component

```javascript
import { usePushNotifications } from './hooks/usePushNotifications';

function App() {
  const navigation = useNavigation();
  const authToken = useSelector(state => state.auth.token); // Or however you store auth
  const API_URL = 'https://your-backend-url.com';

  // Initialize push notifications
  usePushNotifications(navigation, authToken, API_URL);

  return (
    // Your app components
  );
}
```

### 4. Notification Settings Screen (Optional)

```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';

export default function NotificationSettingsScreen({ authToken, apiUrl }) {
  const [settings, setSettings] = useState({
    pushEnabled: true,
    journeyReminders: true,
    prayerUpdates: true
  });

  const updateSetting = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    try {
      const response = await fetch(`${apiUrl}/api/users/preferences`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notificationSettings: newSettings
        })
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }

      console.log('✅ Settings updated');
    } catch (error) {
      console.error('❌ Failed to update settings:', error);
      // Revert the change
      setSettings(settings);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notification Settings</Text>

      <View style={styles.setting}>
        <Text style={styles.label}>Push Notifications</Text>
        <Switch
          value={settings.pushEnabled}
          onValueChange={(value) => updateSetting('pushEnabled', value)}
        />
      </View>

      <View style={styles.setting}>
        <Text style={styles.label}>Journey Reminders</Text>
        <Switch
          value={settings.journeyReminders}
          onValueChange={(value) => updateSetting('journeyReminders', value)}
          disabled={!settings.pushEnabled}
        />
      </View>

      <View style={styles.setting}>
        <Text style={styles.label}>Prayer Updates</Text>
        <Switch
          value={settings.prayerUpdates}
          onValueChange={(value) => updateSetting('prayerUpdates', value)}
          disabled={!settings.pushEnabled}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  setting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  label: {
    fontSize: 16,
  },
});
```

---

## 🧪 TESTING CHECKLIST

After implementation, test:

- [ ] Push token is saved to backend after login
- [ ] Notifications appear when app is closed
- [ ] Notifications appear when app is in background
- [ ] Tapping notification navigates to correct screen
- [ ] Settings toggles work correctly
- [ ] Push token refreshes on app restart
- [ ] Works on both iOS and Android physical devices

---

## 📱 PLATFORM-SPECIFIC NOTES

**iOS:**
- Requires physical device (not simulator)
- Push notifications work automatically with Expo

**Android:**
- Requires physical device (not emulator)
- Firebase Cloud Messaging (FCM) handled by Expo
- Notification channels configured automatically

---

## 🐛 COMMON ISSUES & SOLUTIONS

**Issue: "Must use physical device"**
- Solution: Push notifications don't work on simulators/emulators

**Issue: Token format invalid**
- Solution: Ensure token starts with `ExponentPushToken[`

**Issue: Not receiving notifications**
- Check: Permissions granted, push token saved to backend, device has internet

**Issue: Notification tap doesn't navigate**
- Check: Navigation reference is correct, screen names match

---

## 🎯 DELIVERABLES

Please implement:

1. ✅ Push notification utility functions
2. ✅ Custom hook for notification management
3. ✅ Integration in main App component
4. ✅ Notification tap handling with navigation
5. ✅ (Optional) Settings screen for user control

---

## 📚 ADDITIONAL RESOURCES

- Expo Notifications Docs: https://docs.expo.dev/push-notifications/overview/
- Test Notifications: https://expo.dev/notifications
- Notification Format: JSON with `data.type` for routing

---

**Backend Status:** ✅ Fully Implemented and Ready
**API Documentation:** See `PUSH_NOTIFICATIONS_COMPLETE.md` in backend repo

Please let me know when implementation is complete so we can test the full flow!

