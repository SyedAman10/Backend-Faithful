# Google Calendar Deep Link Fix

## ✅ Issue Fixed

The mobile Google Calendar callback was redirecting to the **website** instead of the **mobile app**.

### ❌ Before (Wrong)
```
Redirecting to: https://faithfulcompanion.ai
```

### ✅ After (Correct)
```
Redirecting to: faithfulcompanion://google-calendar-callback?success=true&userId=123&email=user@gmail.com
```

---

## 🔧 Changes Made

### 1. Updated `routes/auth.js`

**Line ~1096** - Changed environment variable:
```javascript
// OLD
const EXPO_RETURN_URL = process.env.EXPO_RETURN_URL || 'exp://127.0.0.1:8081/--/calendar/callback';

// NEW
const MOBILE_RETURN_URL = process.env.MOBILE_CALENDAR_RETURN_URL || 'faithfulcompanion://google-calendar-callback';
```

**Line ~1175** - Updated redirect URL:
```javascript
// OLD
const redirectUrl = `${EXPO_RETURN_URL}?success=true&email=${encodeURIComponent(userInfo.email)}&calendarConnected=true`;

// NEW
const redirectUrl = `${MOBILE_RETURN_URL}?success=true&userId=${userId}&email=${encodeURIComponent(userInfo.email)}&calendarConnected=true`;
```

**Line ~1187** - Updated error redirect:
```javascript
// OLD
const EXPO_RETURN_URL = process.env.EXPO_RETURN_URL || 'exp://127.0.0.1:8081/--/calendar/callback';

// NEW
const MOBILE_RETURN_URL = process.env.MOBILE_CALENDAR_RETURN_URL || 'faithfulcompanion://google-calendar-callback';
```

---

### 2. Updated `env-template.txt`

Added new environment variable:

```bash
# Mobile Calendar Return URL (for Google Calendar authentication)
# This is separate from the main auth callback
MOBILE_CALENDAR_RETURN_URL=faithfulcompanion://google-calendar-callback
# Development alternative:
# MOBILE_CALENDAR_RETURN_URL=exp://127.0.0.1:8081/--/calendar/callback
```

---

### 3. Updated Documentation

- **GOOGLE_CALENDAR_AUTH.md** - Updated to show correct deep link format
- **env-template.txt** - Added `MOBILE_CALENDAR_RETURN_URL` variable

---

## 🎯 How It Works Now

### Success Flow:
```
1. User authorizes Google Calendar in browser
2. Google redirects to: /api/auth/google-calendar/mobile-callback
3. Backend processes authorization
4. Backend redirects to: faithfulcompanion://google-calendar-callback?success=true&userId=123&email=user@gmail.com
5. ✅ Mobile app receives deep link and opens
```

### Error Flow:
```
1. Authorization fails or user cancels
2. Backend redirects to: faithfulcompanion://google-calendar-callback?error=CalendarConnectionFailed&message=...
3. ✅ Mobile app receives deep link with error
```

---

## 📱 Mobile App Setup

### React Native Deep Link Configuration

Add to your `app.json`:

```json
{
  "expo": {
    "scheme": "faithfulcompanion",
    "plugins": [
      [
        "expo-linking",
        {
          "schemes": ["faithfulcompanion"]
        }
      ]
    ]
  }
}
```

### Handle the Deep Link in Your App

```javascript
import * as Linking from 'expo-linking';
import { useEffect } from 'react';

// In your component or navigation setup
useEffect(() => {
  const handleDeepLink = (event) => {
    const url = event.url;
    
    // Parse: faithfulcompanion://google-calendar-callback?success=true&userId=123&email=user@gmail.com
    if (url.includes('google-calendar-callback')) {
      const params = Linking.parse(url).queryParams;
      
      if (params.success === 'true') {
        // ✅ Calendar connected successfully
        console.log('Calendar connected!');
        console.log('User ID:', params.userId);
        console.log('Gmail:', params.email);
        
        // Show success message
        Alert.alert('Success', 'Google Calendar connected!');
        
        // Navigate to settings or calendar screen
        navigation.navigate('Settings');
      } else if (params.error) {
        // ❌ Error occurred
        console.error('Calendar connection failed:', params.message);
        Alert.alert('Error', params.message || 'Failed to connect calendar');
      }
    }
  };
  
  // Add listener
  const subscription = Linking.addEventListener('url', handleDeepLink);
  
  // Check if app was opened with a deep link
  Linking.getInitialURL().then((url) => {
    if (url) {
      handleDeepLink({ url });
    }
  });
  
  return () => subscription.remove();
}, []);
```

---

## 🧪 Testing

### Test Success Flow:

1. Start your server
2. Open your mobile app
3. Click "Connect Google Calendar"
4. Authorize in browser
5. **Verify app opens** with deep link `faithfulcompanion://google-calendar-callback?success=true&userId=...`

### Test Error Flow:

1. In browser, click "Cancel" on Google authorization
2. **Verify app opens** with deep link `faithfulcompanion://google-calendar-callback?error=...`

### Manual Test (Browser):

Open this URL in your mobile browser to test deep link:
```
faithfulcompanion://google-calendar-callback?success=true&userId=123&email=test@gmail.com
```

---

## 🔧 Environment Variable Options

### Production (Recommended):
```bash
MOBILE_CALENDAR_RETURN_URL=faithfulcompanion://google-calendar-callback
```

### Development (Expo Go):
```bash
MOBILE_CALENDAR_RETURN_URL=exp://127.0.0.1:8081/--/calendar/callback
```

### Custom Development:
```bash
MOBILE_CALENDAR_RETURN_URL=faithfulcompanion://google-calendar-callback
```

---

## ✅ Verification Checklist

- [x] Backend redirects to `faithfulcompanion://` scheme
- [x] Success URL includes `userId` parameter
- [x] Success URL includes `email` parameter
- [x] Success URL includes `calendarConnected=true` parameter
- [x] Error URL includes `error` and `message` parameters
- [x] Environment variable documented
- [x] Mobile app can handle the deep link
- [ ] Test in production mobile build
- [ ] Verify app opens when clicking link

---

## 🚀 Deployment

### Backend:
```bash
# Update your .env file
echo "MOBILE_CALENDAR_RETURN_URL=faithfulcompanion://google-calendar-callback" >> .env

# Restart your server
pm2 restart all
# or
node server.js
```

### Mobile App:
```bash
# Rebuild app with deep link configuration
expo prebuild --clean
npx expo run:ios
# or
npx expo run:android
```

---

## 📝 Summary

✅ **Fixed**: Mobile callback now uses `faithfulcompanion://google-calendar-callback` deep link  
✅ **Added**: `MOBILE_CALENDAR_RETURN_URL` environment variable  
✅ **Separated**: Calendar callback from main auth callback  
✅ **Included**: `userId` parameter in success redirect  
✅ **Updated**: All documentation to reflect changes  

The mobile app will now receive the callback correctly and can handle the Google Calendar connection! 🎉

