# Prayer API Picture Priority Fix

## Issue
Prayer API was returning `google_picture` instead of respecting the custom picture priority (custom_picture > google_picture > picture).

## Root Cause
The prayer routes were using `u.picture` directly instead of using `COALESCE(u.custom_picture, u.google_picture, u.picture)` to prioritize custom pictures.

## Solution
Updated all prayer-related SQL queries to use the same picture priority logic as the user profile endpoint.

### Files Modified
- `routes/prayer.js`

### Changes Made

#### 1. Get All Prayer Requests (`GET /api/prayer/requests`)
**Before:**
```sql
u.picture as author_picture
ELSE u.picture END as display_picture
```

**After:**
```sql
COALESCE(u.custom_picture, u.google_picture, u.picture) as author_picture
ELSE COALESCE(u.custom_picture, u.google_picture, u.picture) END as display_picture
```

#### 2. Get Single Prayer Request (`GET /api/prayer/requests/:id`)
**Before:**
```sql
u.picture as author_picture
ELSE u.picture END as display_picture
```

**After:**
```sql
COALESCE(u.custom_picture, u.google_picture, u.picture) as author_picture
ELSE COALESCE(u.custom_picture, u.google_picture, u.picture) END as display_picture
```

#### 3. Get Prayer Responses
**Before:**
```sql
u.picture as responder_picture
ELSE u.picture END as display_picture
```

**After:**
```sql
COALESCE(u.custom_picture, u.google_picture, u.picture) as responder_picture
ELSE COALESCE(u.custom_picture, u.google_picture, u.picture) END as display_picture
```

## Picture Priority Logic

```
1st Priority: custom_picture (user uploaded their own picture)
2nd Priority: google_picture (picture from Google sign-in)
3rd Priority: picture (legacy/fallback)
```

### SQL Implementation
```sql
COALESCE(u.custom_picture, u.google_picture, u.picture)
```

This ensures:
- If user has uploaded a custom picture → use that
- Else if user signed in with Google → use Google picture
- Else → use legacy picture field (if any)

## Testing

### Test Case 1: User with Custom Picture
1. User uploads custom picture via `POST /api/users/profile/picture`
2. User creates a prayer request
3. Prayer feed should show custom picture ✅
4. Prayer detail should show custom picture ✅

### Test Case 2: User with Google Picture Only
1. User signs in with Google (no custom picture uploaded)
2. User creates a prayer request
3. Prayer feed should show Google picture ✅
4. Prayer detail should show Google picture ✅

### Test Case 3: User Changes from Google to Custom
1. User initially has Google picture
2. User uploads custom picture
3. All prayer requests/responses should now show custom picture ✅

### Test Case 4: User Reverts to Google Picture
1. User had custom picture
2. User deletes custom picture via `DELETE /api/users/profile/picture`
3. All prayer requests/responses should revert to Google picture ✅

## Affected Endpoints

All these endpoints now correctly prioritize custom pictures:

1. `GET /api/prayer/requests` - Prayer feed
2. `GET /api/prayer/requests/:id` - Single prayer with responses
3. All prayer response data includes correct responder pictures

## Anonymous Prayer Handling

The fix maintains anonymous prayer logic:
- If `is_anonymous = true` → `display_picture = NULL`
- If `is_anonymous = false` → `display_picture = COALESCE(custom, google, legacy)`

## Consistency Across Backend

Now all endpoints use the same picture priority:

✅ `GET /api/users/profile` - User profile
✅ `GET /api/prayer/requests` - Prayer feed
✅ `GET /api/prayer/requests/:id` - Prayer detail
✅ Prayer responses

## Database Schema Reference

```sql
users table:
- picture TEXT              -- Legacy field (generic)
- google_picture TEXT       -- From Google OAuth
- custom_picture TEXT       -- User uploaded (priority)
```

## Impact

**Before Fix:**
- User uploads custom picture
- Profile shows custom picture ✅
- Prayer feed shows Google picture ❌ (BUG)

**After Fix:**
- User uploads custom picture
- Profile shows custom picture ✅
- Prayer feed shows custom picture ✅ (FIXED)

---

**Fixed Date:** December 1, 2025
**Status:** ✅ Complete
**Testing:** Ready for verification

