# Daily Verse API Documentation

## Overview

The Daily Verse API provides a **completely separate** endpoint from Daily Prayer, delivering daily inspirational Bible verses to users. Each endpoint has its own verse collection and history tracking to ensure users receive different content.

---

## 🎯 Three Separate Daily Endpoints

| Endpoint | Purpose | Verse Collection | History Table |
|----------|---------|------------------|---------------|
| **`/api/bible/daily-verse`** | Daily inspirational verse | 100+ inspirational verses | `user_verse_history` |
| **`/api/bible/daily-prayer`** | Prayer-focused verse | Prayer categories (comfort, strength, peace, etc.) | `user_prayer_history` |
| **`/api/bible/daily-reflection`** | Reflection with prompts | Themed verses (gratitude, forgiveness, etc.) | `user_reflection_history` |

**Each endpoint tracks separately**, so a user can get:
- One daily verse (inspirational)
- One daily prayer (prayer-focused)
- One daily reflection (with questions)

All three will be **different verses** and won't repeat.

---

## 📖 Daily Verse Endpoint

### `GET /api/bible/daily-verse`

Returns a random inspirational Bible verse for the day. Tracks history to avoid showing the same verse twice.

**Authentication:** Required (JWT token)

**Request:**
```bash
GET /api/bible/daily-verse
Authorization: Bearer {your_jwt_token}
```

**Response (First time today):**
```json
{
  "success": true,
  "data": {
    "bible": "KJV",
    "passage": "Jer 29:11",
    "text": "For I know the thoughts that I think toward you, saith the Lord, thoughts of peace, and not of evil, to give you an expected end.",
    "reference": "Jer 29:11",
    "verseDate": "2024-11-20T12:00:00.000Z",
    "isNew": true
  }
}
```

**Response (Subsequent requests same day):**
```json
{
  "success": true,
  "data": {
    "bible": "KJV",
    "passage": "Jer 29:11",
    "text": "For I know the thoughts that I think toward you...",
    "reference": "Jer 29:11",
    "verseDate": "2024-11-20T12:00:00.000Z",
    "isNew": false
  }
}
```

---

## 📚 Verse Collections

### Daily Verse Collection (100+ verses)

Organized by themes:

#### **Wisdom & Guidance** (9 verses)
- Prov 3:5-6, Prov 16:3, Prov 4:23, Prov 18:10, Prov 22:6
- Ps 119:105, Ps 32:8, Ps 25:4-5, James 1:5

#### **Courage & Strength** (9 verses)
- Josh 1:9, Deut 31:6, Isa 40:31, Isa 41:10, Isa 43:2
- Phil 4:13, 2Tim 1:7, Ps 27:1, Ps 18:2

#### **Love & Grace** (8 verses)
- John 3:16, Rom 8:38-39, Eph 2:8-9, 1John 4:9
- Titus 2:11, Rom 5:8, Ps 136:26, Lam 3:22-23

#### **Joy & Peace** (8 verses)
- Neh 8:10, John 16:33, Rom 15:13, Gal 5:22-23
- Phil 4:4, Ps 16:11, John 14:27, Isa 26:3

#### **Hope & Trust** (8 verses)
- Jer 29:11, Ps 37:4, Ps 62:5, Rom 8:28
- Heb 11:1, Ps 130:5, Prov 3:5, Rom 5:5

#### **Purpose & Identity** (8 verses)
- Jer 1:5, Eph 2:10, Ps 139:14, 1Pet 2:9
- Gen 1:27, Phil 1:6, 2Cor 5:17, Isa 43:1

#### **Victory & Overcoming** (7 verses)
- Rom 8:37, 1Cor 15:57, 1John 5:4, Phil 4:19
- Ps 37:23-24, Prov 24:16, Mic 7:8

#### **Blessing & Prosperity** (7 verses)
- Num 6:24-26, Ps 1:1-3, Ps 23:1, Mal 3:10
- Deut 28:2, 3John 1:2, Ps 84:11

#### **Eternal Life & Salvation** (7 verses)
- John 14:6, Acts 4:12, Rom 10:9, 1John 5:12
- John 10:10, John 11:25-26, Titus 3:5

#### **Prayer & Worship** (7 verses)
- Ps 145:18, Matt 7:7-8, John 4:23-24, Ps 100:4
- 1Thess 5:16-18, Phil 4:6, James 5:16

#### **New Beginnings** (5 verses)
- Isa 43:18-19, 2Cor 5:17, Rev 21:5
- Lam 3:22-23, Ps 51:10

**Total: 100+ unique inspirational verses**

---

## 🔄 How It Works

### Daily Verse Logic

1. **Check for Today's Verse**
   - Queries `user_verse_history` for today's date
   - If exists, returns the same verse (cached for the day)

2. **Generate New Verse**
   - Gets user's Bible version preference
   - Loads all 100+ inspirational verses
   - Filters out verses user has already seen
   - Picks random verse from remaining pool

3. **Fetch Bible Text**
   - Fetches actual verse text from Bible Gateway
   - Uses user's preferred translation (KJV, NIV, etc.)
   - Cleans HTML and formats text

4. **Save to History**
   - Stores verse in `user_verse_history` table
   - Prevents showing same verse twice
   - Tracks verse_date for daily caching

5. **Reset When Exhausted**
   - If user has seen all verses, resets pool
   - Allows verses to repeat after seeing all

---

## 🗄️ Database Schema

### `user_verse_history` Table

```sql
CREATE TABLE user_verse_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  version VARCHAR(50) NOT NULL,        -- Bible translation (KJV, NIV, etc.)
  book VARCHAR(100) NOT NULL,          -- Book name (Jeremiah, Psalms, etc.)
  chapter INTEGER NOT NULL,            -- Chapter number
  verse INTEGER NOT NULL,              -- Verse number
  text TEXT NOT NULL,                  -- Actual verse text
  reference VARCHAR(200) NOT NULL,     -- Full reference (Jer 29:11)
  verse_date TIMESTAMP DEFAULT NOW(),  -- When verse was shown
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, version, book, chapter, verse)
);
```

### Indexes

```sql
idx_user_verse_history_user_id         -- Fast lookups by user
idx_user_verse_history_verse_date      -- Fast date queries
idx_user_verse_history_user_version    -- Fast user+version queries
```

---

## 📊 Comparison with Other Endpoints

### Daily Verse vs Daily Prayer

```
Daily Verse (/api/bible/daily-verse)
├── 100+ inspirational verses
├── General themes (wisdom, courage, love, etc.)
├── One verse per day
├── user_verse_history table
└── No categories

Daily Prayer (/api/bible/daily-prayer)
├── 50+ prayer-focused verses
├── Prayer categories (comfort, strength, peace, faith, hope, love)
├── One verse per day per category
├── user_prayer_history table
└── ?category=comfort parameter
```

### Daily Verse vs Daily Reflection

```
Daily Verse (/api/bible/daily-verse)
├── Just the verse
├── Simple inspirational message
└── No prompts or questions

Daily Reflection (/api/bible/daily-reflection)
├── Verse + Reflection theme
├── Reflection prompts
├── 5 reflection questions
├── user_reflection_history table
└── ?theme=gratitude parameter
```

---

## 🎯 Use Cases

### Use Case 1: Morning Devotional
```javascript
// Get daily verse in the morning
const response = await fetch('/api/bible/daily-verse', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data } = await response.json();

// Display: "Jer 29:11 - For I know the thoughts..."
showNotification(data.passage, data.text);
```

### Use Case 2: Lock Screen Widget
```javascript
// Show daily verse on lock screen
// Same verse all day (isNew: false after first call)
const verse = await getDailyVerse();
updateLockScreenWidget(verse.text, verse.reference);
```

### Use Case 3: Daily Reminder
```javascript
// Send push notification at 8 AM
// Different from daily prayer at 12 PM
// Different from daily reflection at 8 PM
schedulePushNotification({
  time: '08:00',
  endpoint: '/api/bible/daily-verse',
  title: 'Daily Verse',
  body: 'Your inspirational verse is ready!'
});
```

---

## 🔐 Authentication

All endpoints require JWT authentication:

```javascript
headers: {
  'Authorization': 'Bearer YOUR_JWT_TOKEN'
}
```

The Bible version is automatically pulled from the user's profile (`bible_version` field).

---

## 💡 Features

### ✅ Automatic Caching
- First request of the day: generates new verse (`isNew: true`)
- Subsequent requests: returns same verse (`isNew: false`)
- Resets at midnight (user's timezone-aware)

### ✅ No Repeats
- Tracks every verse shown to user
- Filters out previously seen verses
- Only shows new verses until pool exhausted

### ✅ Pool Reset
- When all verses seen, automatically resets
- Allows verses to repeat after full cycle
- Ensures users always get a verse

### ✅ Bible Version Support
- Uses user's preferred translation
- Supports: KJV, NIV, NLT, ESV, and more
- Updates automatically when user changes preference

### ✅ Separate from Prayer
- Different verse collection
- Different history tracking
- Can call both APIs same day for different verses

---

## 🧪 Testing

### Test the Endpoint

```bash
# Get your JWT token first
TOKEN="your_jwt_token_here"

# Call daily verse endpoint
curl -X GET "http://localhost:3000/api/bible/daily-verse" \
  -H "Authorization: Bearer $TOKEN"
```

### Test Multiple Calls (Same Day)

```bash
# First call - should return isNew: true
curl -X GET "http://localhost:3000/api/bible/daily-verse" \
  -H "Authorization: Bearer $TOKEN"

# Second call - should return isNew: false (same verse)
curl -X GET "http://localhost:3000/api/bible/daily-verse" \
  -H "Authorization: Bearer $TOKEN"
```

### Check History

```sql
-- See all verses user has received
SELECT 
  reference, 
  verse_date::date as date,
  version
FROM user_verse_history
WHERE user_id = 123
ORDER BY verse_date DESC;
```

---

## 📈 API Response Codes

| Code | Description |
|------|-------------|
| 200 | Success - verse returned |
| 401 | Unauthorized - invalid/missing token |
| 500 | Server error - verse fetching failed |

---

## 🚀 Future Enhancements

Potential additions:
- [ ] Favorite verses
- [ ] Share verse with friends
- [ ] Verse themes/categories
- [ ] Custom verse collections
- [ ] Verse of the week
- [ ] Memorization tracker
- [ ] Audio verse playback

---

## 📝 Summary

- **Endpoint:** `GET /api/bible/daily-verse`
- **Purpose:** Daily inspirational Bible verse
- **Verses:** 100+ unique verses (separate from prayer)
- **History:** Tracks in `user_verse_history` table
- **Caching:** One verse per day (resets at midnight)
- **No Repeats:** Filters out previously seen verses
- **Bible Version:** Uses user's preference

---

## 🎉 All Daily Endpoints

```bash
# Daily Inspirational Verse
GET /api/bible/daily-verse

# Daily Prayer Verse (by category)
GET /api/bible/daily-prayer?category=comfort

# Daily Reflection (with questions)
GET /api/bible/daily-reflection?theme=gratitude
```

**Each endpoint is independent** and provides different content! 🙏

