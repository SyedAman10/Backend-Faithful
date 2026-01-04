# Frontend Timezone Issue - Debug Guide

## 🐛 Issue Summary

**Problem:** User creates a meeting at 7:00 PM on Dec 20, but the app shows 6:00 PM on Dec 21.

**Root Cause:** The frontend is NOT converting the user's local time to UTC before sending to the backend.

---

## 📊 What's Happening (Your Example)

### Creation Phase:
```
User Action: Creates meeting at 7:00 PM Dec 20, 2025 (Eastern Time)
Frontend Sends: '2025-12-21T00:00:00.000Z' (midnight UTC on Dec 21)
Backend Stores: '2025-12-21T00:00:00.000Z' (UTC)
Timezone Stored: 'America/New_York' (for reference)
```

### Retrieval Phase:
```
User Views From: Central Time (America/Chicago, UTC-6)
Backend Retrieves: '2025-12-21T00:00:00.000Z' (midnight UTC)
Backend Converts: midnight UTC → 6:00 PM CST (Dec 20)
Backend Sends: scheduledTimeLocal: "12/20/2025, 06:00 PM"
Frontend Displays: 6:00 PM Dec 20 ← WRONG!
```

---

## ✅ What Should Happen

### Creation Phase (CORRECT):
```
User Action: Creates meeting at 7:00 PM Dec 20, 2025 (Eastern Time)
Frontend Should Send: '2025-12-21T00:00:00.000Z' (7pm EST = midnight UTC next day)
                      OR BETTER: Use local date/time picker that auto-converts
Backend Stores: Correct UTC time
```

**Example Calculation:**
- User picks: Dec 20, 2025 7:00 PM EST
- EST is UTC-5, so: 7:00 PM + 5 hours = 12:00 AM (midnight) next day UTC
- Should send: `2025-12-21T00:00:00.000Z` ✅

But the issue is the user didn't pick 7:00 PM, they picked midnight (00:00), which should be:
- User picks: Dec 21, 2025 12:00 AM EST (midnight)
- EST is UTC-5, so: 12:00 AM + 5 hours = 5:00 AM UTC
- Should send: `2025-12-21T05:00:00.000Z` ✅

---

## 🔍 Backend Logging Added

I've added detailed logging to help debug. When you retrieve study groups, you'll now see:

```
🕐 TIMEZONE CONVERSION DETAILS (First Group): {
  groupId: 80,
  title: 'das',
  storedInDB: {
    scheduled_time: '2025-12-21T00:00:00.000Z',
    timezone: 'America/New_York'
  },
  viewerTimezone: 'America/Chicago',
  convertedForViewer: {
    scheduledTimeLocal: '12/20/2025, 06:00 PM',
    nextOccurrenceLocal: '12/20/2025, 06:00 PM'
  },
  explanation: 'DB stores UTC: 2025-12-21T00:00:00.000Z | Creator\'s TZ: America/New_York | Viewer\'s TZ: America/Chicago | Shown to viewer: 12/20/2025, 06:00 PM'
}
```

This shows:
1. **What's stored in DB** (UTC)
2. **Who created it** (timezone reference)
3. **Who's viewing** (current timezone)
4. **What backend sends** (converted time)

---

## 🎯 Where the Frontend Bug Is

### Problem 1: Time Not Converting to UTC

The frontend date picker is likely doing this:
```javascript
// ❌ WRONG - Gets UTC midnight instead of converting local time to UTC
const scheduledTime = '2025-12-21T00:00:00.000Z';

// or maybe:
const date = new Date('2025-12-21');
const scheduledTime = date.toISOString(); // This gives midnight UTC, not midnight local!
```

**What it SHOULD do:**
```javascript
// ✅ CORRECT - Convert local time to UTC
const localDate = new Date(2025, 11, 20, 19, 0, 0); // Dec 20, 7:00 PM local time
const scheduledTime = localDate.toISOString(); // Converts to UTC automatically!

// Example output:
// If user is in EST: '2025-12-21T00:00:00.000Z' (7pm EST = midnight UTC)
// If user is in CST: '2025-12-21T01:00:00.000Z' (7pm CST = 1am UTC)
```

**Or if using a date picker component:**
```javascript
// Most date pickers return a Date object
const dateFromPicker = datePickerComponent.value; // Already a Date object in local time

// Convert to UTC ISO string
const scheduledTime = dateFromPicker.toISOString(); // ✅ This works!
```

### Problem 2: Ignoring Backend's scheduledTimeLocal

The backend sends TWO fields:
```json
{
  "scheduled_time": "2025-12-21T00:00:00.000Z",      // Raw UTC
  "scheduledTimeLocal": "12/20/2025, 06:00 PM",      // Converted for viewer
  "timezone": "America/New_York"                      // Creator's timezone
}
```

**What the frontend might be doing WRONG:**
```javascript
// ❌ WRONG - Converting UTC time again on frontend
const date = new Date(group.scheduled_time); // Parses UTC
const display = date.toLocaleString(); // Converts to local time AGAIN
// This double-converts and causes wrong display!
```

**What it SHOULD do:**
```javascript
// ✅ CORRECT - Use the pre-converted field from backend
const display = group.scheduledTimeLocal; // Already converted by backend!
// OR use the snake_case version:
const display = group.scheduled_time_local;
```

---

## 🧪 How to Test/Debug Frontend

### Step 1: Check What Frontend Sends
Add console logs before API call:

```javascript
// In your "Create Study Group" function
console.log('🔍 FRONTEND DEBUG - Before sending to API:', {
  userSelectedDate: datePickerValue,
  userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  scheduledTimeBeingSent: scheduledTime,
  isISO: scheduledTime.includes('Z'),
  explanation: 'If user picks 7pm EST, this should be midnight UTC (next day)'
});

// Make API call
await createStudyGroup({ scheduledTime, ... });
```

### Step 2: Check What Frontend Receives
Add console logs after API response:

```javascript
// In your "Get Study Groups" function
const response = await getStudyGroups();
console.log('🔍 FRONTEND DEBUG - Received from API:', {
  firstGroup: response.data.groups[0],
  fields: {
    scheduled_time: response.data.groups[0].scheduled_time,
    scheduledTimeLocal: response.data.groups[0].scheduledTimeLocal,
    scheduled_time_local: response.data.groups[0].scheduled_time_local,
    timezone: response.data.groups[0].timezone
  },
  whatToDisplay: 'Use scheduledTimeLocal or scheduled_time_local field!'
});
```

### Step 3: Check What Frontend Displays
Add console logs in your display component:

```javascript
// In your StudyGroupCard or wherever you display the time
console.log('🔍 FRONTEND DEBUG - Displaying:', {
  groupId: group.id,
  usingField: 'scheduled_time or scheduledTimeLocal?',
  displayValue: timeBeingShown,
  shouldUse: group.scheduledTimeLocal,
  warning: 'If using scheduled_time and converting, you are double-converting!'
});
```

---

## 📋 Frontend Checklist

- [ ] **Date Picker Conversion**: Does the date picker convert local time to UTC before sending?
- [ ] **API Request**: Is `scheduledTime` sent as UTC ISO string?
- [ ] **Display Field**: Is the frontend using `scheduledTimeLocal` from backend?
- [ ] **No Double Conversion**: Is the frontend converting `scheduled_time` again (don't do this!)?
- [ ] **Timezone Header**: Is the frontend sending `x-timezone` header with user's timezone?

---

## 🎯 Quick Fix for Frontend

### Fix #1: Creating Study Group
```javascript
// When user picks a date/time
const userPickedDate = datePickerComponent.value; // Should be a Date object

// Convert to UTC ISO string (this is what backend expects)
const scheduledTime = userPickedDate.toISOString();

// Get user's timezone for x-timezone header
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Send to API
await fetch('/api/study-groups/create', {
  method: 'POST',
  headers: {
    'x-timezone': userTimezone, // e.g., "America/New_York"
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'My Group',
    scheduledTime: scheduledTime, // UTC ISO string
    // ... other fields
  })
});
```

### Fix #2: Displaying Study Group Time
```javascript
// When displaying a study group
function StudyGroupCard({ group }) {
  // ✅ CORRECT - Use the pre-converted field from backend
  const displayTime = group.scheduledTimeLocal || group.scheduled_time_local;
  
  // ❌ WRONG - Don't do this:
  // const displayTime = new Date(group.scheduled_time).toLocaleString();
  
  return (
    <div>
      <h3>{group.title}</h3>
      <p>Time: {displayTime}</p>
      <p>Created in: {group.timezone}</p>
    </div>
  );
}
```

---

## 🔧 Backend Changes Made

I've added detailed logging to help debug:

1. **File**: `routes/study-groups.js`
2. **Endpoints**: 
   - `GET /api/study-groups` (line ~1374)
   - `GET /api/study-groups/public` (line ~1186)

3. **What's logged**:
   - UTC time stored in DB
   - Creator's timezone
   - Viewer's timezone
   - Converted time sent to viewer
   - Explanation of the conversion

This will help you see exactly what the backend is sending vs. what the frontend is displaying.

---

## 📞 Next Steps

1. **Check your frontend code** for the date picker component
2. **Add the debug logging** shown above
3. **Run the app** and create a test meeting
4. **Check console logs** in both frontend and backend
5. **Compare**:
   - What user selected
   - What frontend sent
   - What backend stored
   - What backend returned
   - What frontend displayed

The logs will reveal exactly where the conversion is failing!

---

## 💡 Key Insight

**The backend is working correctly!** It's:
- ✅ Storing UTC times
- ✅ Reading viewer's timezone from `x-timezone` header
- ✅ Converting UTC to viewer's timezone
- ✅ Sending `scheduledTimeLocal` with converted time

**The frontend has TWO bugs:**
1. ❌ Not converting user's local time to UTC when creating
2. ❌ Either not using `scheduledTimeLocal` or double-converting `scheduled_time`

Fix these two issues and the timezone problem will be resolved!

