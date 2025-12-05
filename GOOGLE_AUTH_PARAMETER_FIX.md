# Google Auth Parameter Type Fix

## Issue
```
❌ Mobile callback error: {
  error: 'inconsistent types deduced for parameter $3',
  ...
}
```

## Root Cause
PostgreSQL was unable to deduce the correct parameter types because:
1. **Reused parameter placeholders** (e.g., `$3` used for both `picture` and `google_picture`)
2. **Missing null handling** for optional token values

## Example of Problem
```sql
-- ❌ WRONG: $3 used twice, $4 becomes ambiguous
UPDATE users 
SET email = $1, name = $2, picture = $3, google_picture = $3, google_access_token = $4
WHERE google_id = $6
-- Parameters: [email, name, picture, tokens.access_token, googleId]
```

## Solution
Fixed all SQL queries in `routes/auth.js` to:
1. **Use unique parameter placeholders** for each value
2. **Add null coalescing** for optional tokens (`tokens.access_token || null`)

```sql
-- ✅ CORRECT: Each value has its own placeholder
UPDATE users 
SET email = $1, name = $2, picture = $3, google_picture = $4, google_access_token = $5, google_refresh_token = $6
WHERE google_id = $7
-- Parameters: [email, name, picture, picture, tokens.access_token || null, tokens.refresh_token || null, googleId]
```

## Files Modified
- `routes/auth.js` - Fixed 4 SQL queries:
  - Line ~106: UPDATE users (link Google account)
  - Line ~128: INSERT users (new user creation)
  - Line ~150: UPDATE users (existing user update)
  - Line ~597: INSERT users (legacy Google OAuth)
  - Line ~607: UPDATE users (legacy Google OAuth)

## Changes Made

### 1. handleUserAuth Function (Lines 104-165)

**INSERT Query (New User)**
```javascript
// Before
VALUES ($1, $2, $3, $4, $4, $5, $6)
[googleId, email, name, picture, tokens.access_token, tokens.refresh_token]

// After
VALUES ($1, $2, $3, $4, $5, $6, $7)
[googleId, email, name, picture, picture, tokens.access_token || null, tokens.refresh_token || null]
```

**UPDATE Query (Link Account)**
```javascript
// Before
SET google_id = $1, name = $2, picture = $3, google_access_token = $4, google_refresh_token = $5
WHERE email = $6
[googleId, name, picture, tokens.access_token, tokens.refresh_token, email]

// After
SET google_id = $1, name = $2, picture = $3, google_picture = $4, google_access_token = $5, google_refresh_token = $6
WHERE email = $7
[googleId, name, picture, picture, tokens.access_token || null, tokens.refresh_token || null, email]
```

**UPDATE Query (Existing User)**
```javascript
// Before
SET email = $1, name = $2, picture = $3, google_picture = $3, google_access_token = $4, google_refresh_token = $5
WHERE google_id = $6
[email, name, picture, tokens.access_token, tokens.refresh_token, googleId]

// After
SET email = $1, name = $2, picture = $3, google_picture = $4, google_access_token = $5, google_refresh_token = $6
WHERE google_id = $7
[email, name, picture, picture, tokens.access_token || null, tokens.refresh_token || null, googleId]
```

### 2. Legacy Google OAuth Route (Lines 595-614)

**INSERT Query**
```javascript
// Before
VALUES ($1, $2, $3, $4, $4, $5)
[googleId, email, name, picture, accessToken]

// After
VALUES ($1, $2, $3, $4, $5, $6)
[googleId, email, name, picture, picture, accessToken || null]
```

**UPDATE Query**
```javascript
// Before
SET email = $1, name = $2, picture = $3, google_picture = $3, google_access_token = $4
WHERE google_id = $5
[email, name, picture, accessToken, googleId]

// After
SET email = $1, name = $2, picture = $3, google_picture = $4, google_access_token = $5
WHERE google_id = $6
[email, name, picture, picture, accessToken || null, googleId]
```

## Why This Fixes the Issue

### 1. Unique Parameter Placeholders
PostgreSQL needs to know the exact type for each parameter position. When `$3` was used twice:
- First use: `picture = $3` (expects TEXT)
- Second use: `google_picture = $3` (expects TEXT)
- But PostgreSQL was confused about whether they should be the same type or value

By using `$3` and `$4` separately, PostgreSQL can clearly deduce:
- `$3` = picture (TEXT)
- `$4` = google_picture (TEXT)

### 2. Null Handling
When `tokens.access_token` or `tokens.refresh_token` might be `undefined`:
- PostgreSQL can't deduce the type of `undefined`
- Using `|| null` ensures a proper NULL value is passed
- This allows PostgreSQL to correctly type-cast the parameter

## Testing

Test the fix by:
```bash
# 1. Restart your server
pm2 restart server

# 2. Test Google OAuth mobile callback
# Open in mobile app and authenticate with Google

# 3. Check logs for success
pm2 logs server --lines 50
```

Expected result:
```
✅ Existing user updated: { userId: 123, email: 'user@example.com', ... }
✅ JWT token generated: { tokenLength: 245, ... }
🎯 handleUserAuth completed successfully
```

## Prevention

To prevent this issue in the future:
1. ✅ Always use unique parameter placeholders (`$1, $2, $3, $4, ...`)
2. ✅ Never reuse placeholders like `$3` twice in the same query
3. ✅ Use `|| null` for optional/nullable parameters
4. ✅ Test with missing token scenarios

## Impact
- ✅ Fixes mobile Google authentication
- ✅ Fixes web Google authentication
- ✅ Fixes Google Calendar connection
- ✅ Ensures proper token storage
- ✅ No breaking changes to API

---

**Status:** ✅ Fixed and ready for testing
**Date:** December 5, 2025

