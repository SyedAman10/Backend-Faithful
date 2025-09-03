# Recurring Meetings API Documentation

This document describes the new recurring meetings functionality that allows users to create study groups that repeat on a schedule (daily, weekly, or monthly).

## Overview

The recurring meetings feature enables users to:
- Create study groups that automatically repeat on specified schedules
- Set up meetings on specific days of the week (e.g., every Wednesday at 10 PM)
- Configure daily, weekly, or monthly recurrence patterns
- Automatically generate Google Calendar events with Meet links
- Track individual meeting instances
- Invite participants to recurring meetings

## Database Schema Changes

### New Fields in `study_groups` Table

```sql
ALTER TABLE study_groups ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE;
ALTER TABLE study_groups ADD COLUMN recurrence_pattern VARCHAR(50); -- 'daily', 'weekly', 'monthly'
ALTER TABLE study_groups ADD COLUMN recurrence_interval INTEGER DEFAULT 1; -- every 1 day/week/month
ALTER TABLE study_groups ADD COLUMN recurrence_days_of_week INTEGER[]; -- [1,3,5] for Monday, Wednesday, Friday
ALTER TABLE study_groups ADD COLUMN recurrence_end_date DATE;
ALTER TABLE study_groups ADD COLUMN next_occurrence TIMESTAMP;
```

### New `recurring_meetings` Table

```sql
CREATE TABLE recurring_meetings (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL,
  meeting_date TIMESTAMP NOT NULL,
  meet_link TEXT,
  meet_id VARCHAR(255),
  google_event_id VARCHAR(255),
  attendees_count INTEGER DEFAULT 0,
  is_cancelled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE
);
```

## API Endpoints

### 1. Create Recurring Study Group

**Endpoint:** `POST /api/study-groups/create-recurring`

**Description:** Creates a new recurring study group with automatic Google Calendar integration.

**Request Body:**
```json
{
  "title": "Weekly JavaScript Study Group",
  "description": "Every Wednesday at 10 PM - Advanced JavaScript concepts",
  "maxParticipants": 15,
  "startTime": "2024-01-24T22:00:00.000Z",
  "durationMinutes": 90,
  "attendeeEmails": ["student1@example.com", "student2@example.com"],
  "frequency": "weekly",
  "interval": 1,
  "daysOfWeek": [3],
  "endDate": "2024-12-31",
  "timeZone": "UTC"
}
```

**Parameters:**
- `title` (required): Study group title
- `description`: Study group description
- `maxParticipants`: Maximum number of participants (default: 10)
- `startTime` (required): First meeting time in ISO format
- `durationMinutes`: Meeting duration in minutes (default: 60)
- `attendeeEmails`: Array of email addresses to invite
- `frequency` (required): Recurrence frequency - "daily", "weekly", or "monthly"
- `interval`: Recurrence interval (default: 1) - every 1 day/week/month
- `daysOfWeek`: Array of days for weekly recurrence (0=Sunday, 1=Monday, etc.)
- `endDate`: Optional end date for the recurring series
- `timeZone`: Timezone for the meetings (default: "UTC")

**Response:**
```json
{
  "success": true,
  "message": "Recurring study group created successfully",
  "data": {
    "id": 123,
    "title": "Weekly JavaScript Study Group",
    "description": "Every Wednesday at 10 PM - Advanced JavaScript concepts",
    "theme": "Programming & Technology",
    "meetLink": "https://meet.google.com/abc-defg-hij",
    "meetId": "meet_id_123",
    "maxParticipants": 15,
    "startTime": "2024-01-24T22:00:00.000Z",
    "durationMinutes": 90,
    "frequency": "weekly",
    "interval": 1,
    "daysOfWeek": [3],
    "endDate": "2024-12-31",
    "nextOccurrence": "2024-01-24T22:00:00.000Z",
    "attendeeEmails": ["student1@example.com", "student2@example.com"],
    "createdAt": "2024-01-20T10:00:00.000Z"
  }
}
```

### 2. Get Upcoming Recurring Meetings

**Endpoint:** `GET /api/study-groups/upcoming-recurring?limit=20`

**Description:** Retrieves upcoming recurring meetings for the authenticated user.

**Query Parameters:**
- `limit`: Maximum number of meetings to return (default: 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "meetings": [
      {
        "group_id": 123,
        "title": "Weekly JavaScript Study Group",
        "description": "Every Wednesday at 10 PM",
        "theme": "Programming & Technology",
        "meet_link": "https://meet.google.com/abc-defg-hij",
        "duration_minutes": 90,
        "is_recurring": true,
        "recurrence_pattern": "weekly",
        "recurrence_interval": 1,
        "recurrence_days_of_week": [3],
        "next_occurrence": "2024-01-24T22:00:00.000Z",
        "meeting_id": 456,
        "meeting_date": "2024-01-24T22:00:00.000Z",
        "google_event_id": "google_event_123",
        "role": "admin"
      }
    ],
    "totalMeetings": 1
  }
}
```

## Usage Examples

### Weekly Study Group (Every Wednesday at 10 PM)

```javascript
const response = await fetch('/api/study-groups/create-recurring', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'Weekly JavaScript Study Group',
    description: 'Every Wednesday at 10 PM - Advanced JavaScript concepts',
    startTime: '2024-01-24T22:00:00.000Z', // Wednesday 10 PM UTC
    durationMinutes: 90,
    frequency: 'weekly',
    interval: 1, // every week
    daysOfWeek: [3], // Wednesday (0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday)
    endDate: '2024-12-31', // Optional: end of year
    timeZone: 'UTC'
  })
});
```

### Daily Study Group (Every Morning at 7 AM)

```javascript
const response = await fetch('/api/study-groups/create-recurring', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'Daily Morning Study Session',
    description: 'Every morning at 7 AM - Quick review and daily goals',
    startTime: '2024-01-24T07:00:00.000Z', // 7 AM UTC
    durationMinutes: 30,
    frequency: 'daily',
    interval: 1, // every day
    timeZone: 'UTC'
  })
});
```

### Bi-Weekly Study Group (Every Other Week on Monday and Thursday)

```javascript
const response = await fetch('/api/study-groups/create-recurring', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'Bi-Weekly Advanced Topics',
    description: 'Every other week on Monday and Thursday - Advanced programming concepts',
    startTime: '2024-01-22T19:00:00.000Z', // Monday 7 PM UTC
    durationMinutes: 120,
    frequency: 'weekly',
    interval: 2, // every 2 weeks
    daysOfWeek: [1, 4], // Monday and Thursday
    timeZone: 'UTC'
  })
});
```

### Monthly Study Group (First Saturday of Every Month)

```javascript
const response = await fetch('/api/study-groups/create-recurring', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'Monthly Project Review',
    description: 'First Saturday of every month - Project presentations and feedback',
    startTime: '2024-02-03T14:00:00.000Z', // First Saturday 2 PM UTC
    durationMinutes: 180,
    frequency: 'monthly',
    interval: 1, // every month
    timeZone: 'UTC'
  })
});
```

## Day of Week Mapping

| Number | Day      |
|--------|----------|
| 0      | Sunday   |
| 1      | Monday   |
| 2      | Tuesday  |
| 3      | Wednesday|
| 4      | Thursday |
| 5      | Friday   |
| 6      | Saturday |

## Google Calendar Integration

- **Automatic Event Creation**: Each recurring study group automatically creates a Google Calendar event with Meet link
- **Recurrence Rules**: Uses standard iCalendar RRULE format for Google Calendar compatibility
- **Attendee Invitations**: Automatically sends email invitations to all participants
- **Token Management**: Automatically refreshes expired Google OAuth tokens

## Error Handling

### Common Error Responses

**Invalid Recurrence Parameters:**
```json
{
  "success": false,
  "error": "Invalid recurrence parameters",
  "details": [
    "Weekly recurrence requires at least one day of the week.",
    "Invalid day of week. Must be 0-6 (Sunday-Saturday)."
  ]
}
```

**Missing Google Calendar Access:**
```json
{
  "success": false,
  "error": "Google Calendar access not granted. Please authenticate with Google first."
}
```

**Invalid Frequency:**
```json
{
  "success": false,
  "error": "Frequency must be daily, weekly, or monthly"
}
```

## Testing

Use the provided `test-recurring-meetings.js` script to test the API:

```bash
# Install dependencies
npm install axios

# Run the test script
node test-recurring-meetings.js
```

**Note:** Replace `YOUR_AUTH_TOKEN_HERE` with an actual authentication token obtained from the Google OAuth flow.

## Security Considerations

- All endpoints require authentication via JWT token
- Users can only create recurring meetings for themselves
- Users can only view meetings where they are members
- Google OAuth tokens are automatically refreshed when expired
- Rate limiting is applied to prevent abuse

## Future Enhancements

- **Meeting Cancellation**: Cancel individual recurring meeting instances
- **Rescheduling**: Modify recurring meeting schedules
- **Attendance Tracking**: Track attendance for individual meeting instances
- **Notification System**: Send reminders before recurring meetings
- **Conflict Detection**: Warn about scheduling conflicts
- **Bulk Operations**: Create multiple recurring meetings at once
