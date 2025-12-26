# Study Group Invitation System - Setup Guide

## Overview
The study group invitation system has been updated to send email invitations instead of automatically adding users as members. Users must now accept invitations to join study groups.

## Changes Made

### 1. Database Changes
- ✅ Added `study_group_invitations` table to track invitations
- ✅ Table tracks: email, user_id, status (pending/accepted/declined), invited_by, timestamps

### 2. Email Service
- ✅ Created `utils/emailService.js` with nodemailer
- ✅ Sends styled HTML invitation emails
- ✅ Includes group details, meeting link, and accept button

### 3. API Endpoints Added

#### Get Pending Invitations
```
GET /api/study-groups/invitations/pending
Headers: Authorization: Bearer <token>
Response: List of pending invitations for the logged-in user
```

#### Accept/Decline Invitation
```
POST /api/study-groups/invitations/:invitationId/respond
Headers: Authorization: Bearer <token>
Body: { "response": "accept" } or { "response": "decline" }
Response: Success/error message
```

#### Get Group Invitations (Admin Only)
```
GET /api/study-groups/:groupId/invitations
Headers: Authorization: Bearer <token>
Response: List of all invitations for the group (admin only)
```

### 4. Modified Behavior
- ✅ Creating a study group now sends invitations instead of auto-adding members
- ✅ Invited users receive an email notification
- ✅ Google Calendar invites are still sent (via `sendUpdates: 'all'`)
- ✅ Users can accept/decline invitations through the API

## Email Configuration

### Required Environment Variables

Add these to your `.env` file:

```env
# Email Service Configuration (Optional - if not configured, invitations won't send emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
SMTP_FROM_EMAIL=noreply@yourapp.com

# Frontend URL (for invitation links)
FRONTEND_URL=http://localhost:3000
```

### Gmail Setup Instructions

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Create App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Generate a new app password
   - Use this password in `SMTP_PASSWORD`

3. **Gmail Settings**:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail@gmail.com
SMTP_PASSWORD=your-16-character-app-password
```

### Alternative Email Services

#### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
```

#### Mailgun
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-mailgun-username
SMTP_PASSWORD=your-mailgun-password
```

#### AWS SES
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASSWORD=your-ses-smtp-password
```

## Testing

### 1. Create Study Group with Invitations

```bash
POST /api/study-groups/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Bible Study Group",
  "description": "Weekly Bible study",
  "scheduledTime": "2025-12-30T18:00:00.000Z",
  "attendeeEmails": ["user1@example.com", "user2@example.com"]
}
```

**Expected Behavior:**
- ✅ Study group created
- ✅ Creator added as admin
- ✅ Invitations created in database with status 'pending'
- ✅ Email sent to each invited user (if email configured)
- ✅ Google Calendar event created with attendees

**Log Output:**
```
✅ Invitation sent successfully: { groupId: 61, email: 'user@example.com', userId: 3, hasAccount: true }
```

### 2. Check Pending Invitations

```bash
GET /api/study-groups/invitations/pending
Authorization: Bearer <token>
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "invitations": [
      {
        "id": 1,
        "group_id": 61,
        "title": "Bible Study Group",
        "description": "Weekly Bible study",
        "inviter_name": "John Doe",
        "scheduled_time": "2025-12-30T18:00:00.000Z",
        "meet_link": "https://meet.google.com/xxx-xxxx-xxx",
        "status": "pending",
        "invited_at": "2025-12-25T16:34:30.000Z"
      }
    ],
    "count": 1
  }
}
```

### 3. Accept Invitation

```bash
POST /api/study-groups/invitations/1/respond
Authorization: Bearer <token>
Content-Type: application/json

{
  "response": "accept"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Invitation accepted successfully",
  "data": {
    "groupId": 61,
    "groupTitle": "Bible Study Group",
    "meetLink": "https://meet.google.com/xxx-xxxx-xxx"
  }
}
```

**Database Changes:**
- ✅ `study_group_invitations.status` → 'accepted'
- ✅ `study_group_invitations.responded_at` → current timestamp
- ✅ User added to `study_group_members` with role 'member'

## Troubleshooting

### Issue: Emails Not Being Sent

**Check:**
1. Are SMTP environment variables configured?
2. Is the SMTP password correct?
3. Check server logs for email errors

**Log Messages:**
```
⚠️ Email service not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env
📧 Email service not configured, skipping email to: user@example.com
```

**Solution:**
- Configure SMTP settings in `.env`
- Restart the server after adding environment variables

### Issue: Still Auto-Adding Members

**Check:**
- Ensure you've restarted the server after code changes
- Check if you're using the correct endpoint (`/api/study-groups/create`)
- Look for log messages like:
  - ✅ `Invitation sent successfully` (new behavior)
  - ❌ `Added new member to study group` (old behavior)

### Issue: Users Can't Accept Invitations

**Check:**
1. Is the user logged in? (Need valid JWT token)
2. Does the invitation exist and is it still 'pending'?
3. Is the study group still active?

**Error Messages:**
- "Invitation not found or already responded" → Already accepted/declined
- "Study group is full" → Max participants reached
- "Access denied" → User not authenticated

## Migration Guide

### For Existing Study Groups

Existing study groups and members are not affected. The new invitation system only applies to:
- New study groups created after this update
- New members invited to existing groups

### Frontend Integration

Update your frontend to:

1. **Show Pending Invitations**:
```javascript
const response = await fetch('/api/study-groups/invitations/pending', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data } = await response.json();
// Display data.invitations
```

2. **Accept/Decline Invitations**:
```javascript
const accept = async (invitationId) => {
  await fetch(`/api/study-groups/invitations/${invitationId}/respond`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ response: 'accept' })
  });
};
```

3. **Handle Email Links**:
- Email contains link to: `${FRONTEND_URL}/study-groups/invitation/${token}`
- Frontend should redirect to login if not authenticated
- After login, show invitation details and accept/decline buttons

## Benefits

✅ **User Consent**: Users must explicitly accept invitations
✅ **Email Notifications**: Users receive email notifications about invitations
✅ **Better UX**: Clear invitation flow instead of surprise group memberships
✅ **Tracking**: See who accepted/declined invitations
✅ **Google Calendar**: Still integrates with Google Calendar for meeting management

## Notes

- If email service is not configured, invitations are still created in the database but no emails are sent
- Google Calendar invitations are still sent (independent of our email service)
- Users can see pending invitations in the app even without email notifications
