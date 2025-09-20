# 📚 Study Groups API Documentation

## **Base URL**: `https://1befd1562ae3.ngrok-free.app/api`

---

## 🔐 **Authentication**

All endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer {JWT_TOKEN}
```

---

## 🚀 **1. Create Study Group API**

**Endpoint:** `POST /api/study-groups/create`

**Description:** Create a new study group with automatic theme generation and optional Google Meet integration.

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Advanced JavaScript Study Group",
  "description": "Deep dive into modern JavaScript concepts",
  "maxParticipants": 15,
  "scheduledTime": "2024-01-25T14:00:00.000Z",
  "durationMinutes": 90,
  "attendeeEmails": ["user1@example.com", "user2@example.com"],
  "isRecurring": false,
  "recurrencePattern": "weekly",
  "recurrenceInterval": 1,
  "recurrenceDaysOfWeek": [1, 3, 5],
  "recurrenceEndDate": "2024-06-30T23:59:59.000Z",
  "requiresApproval": true
}
```

**Optional Headers:**
```
x-timezone: Asia/Karachi
```

**Response:**
```json
{
  "success": true,
  "message": "Study group created successfully",
  "data": {
    "id": 1,
    "title": "Advanced JavaScript Study Group",
    "description": "Deep dive into modern JavaScript concepts",
    "theme": "Programming & Technology",
    "meetLink": "https://meet.google.com/abc-defg-hij",
    "meetId": "meet-id-here",
    "maxParticipants": 15,
    "scheduledTime": "2024-01-25T14:00:00.000Z",
    "scheduledTimeLocal": "1/25/2024, 7:00:00 PM",
    "nextOccurrence": "2024-01-25T14:00:00.000Z",
    "nextOccurrenceLocal": "1/25/2024, 7:00:00 PM",
    "durationMinutes": 90,
    "isRecurring": false,
    "timezone": "Asia/Karachi",
    "createdAt": "2024-01-20T10:30:00.000Z",
    "attendeeCount": 2
  }
}
```

**Example Usage:**
```javascript
const response = await fetch('https://1befd1562ae3.ngrok-free.app/api/study-groups/create', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'Advanced JavaScript Study Group',
    description: 'Deep dive into modern JavaScript concepts',
    maxParticipants: 15,
    scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    durationMinutes: 90
  })
});

const { data } = await response.json();
console.log('Study group created:', data.title);
console.log('Meet link:', data.meetLink);
console.log('Theme:', data.theme);
```

---

## 📚 **2. Get My Study Groups API**

**Endpoint:** `GET /api/study-groups`

**Description:** Retrieve all study groups where the user is a member.

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
x-timezone: Asia/Karachi (optional)
```

**Query Parameters:**
```
?limit=50&offset=0&search=javascript&theme=programming&status=active&role=all
```

**Response:**
```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "id": 1,
        "title": "Advanced JavaScript Study Group",
        "description": "Deep dive into modern JavaScript concepts",
        "theme": "Programming & Technology",
        "meet_link": "https://meet.google.com/abc-defg-hij",
        "meet_id": "abc-defg-hij",
        "max_participants": 15,
        "scheduled_time": "2024-01-25T14:00:00.000Z",
        "scheduled_time_local": "1/25/2024, 7:00:00 PM",
        "next_occurrence": "2024-01-25T14:00:00.000Z",
        "next_occurrence_local": "1/25/2024, 7:00:00 PM",
        "duration_minutes": 90,
        "is_recurring": false,
        "recurrence_pattern": null,
        "recurrence_interval": null,
        "recurrence_days_of_week": null,
        "recurrence_end_date": null,
        "recurrence_end_date_local": null,
        "timezone": "Asia/Karachi",
        "created_at": "2024-01-20T10:30:00.000Z",
        "created_at_local": "1/20/2024, 3:30:00 PM",
        "is_active": true,
        "user_role": "admin",
        "joined_at": "2024-01-20T10:30:00.000Z",
        "creator_name": "John Doe",
        "creator_email": "john@example.com",
        "current_members": 3
      }
    ],
    "totalGroups": 1,
    "pagination": {
      "limit": 50,
      "offset": 0
    },
    "filters": {
      "status": "active",
      "role": "all",
      "search": null
    },
    "timezone": "Asia/Karachi"
  }
}
```

---

## 🌐 **3. Get Public Study Groups API**

**Endpoint:** `GET /api/study-groups/public`

**Description:** Browse all available public study groups.

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
x-timezone: Asia/Karachi (optional)
```

**Query Parameters:**
```
?limit=20&offset=0&search=javascript&theme=programming&requiresApproval=true&date=2024-01-25
```

**Response:**
```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "id": 1,
        "title": "Advanced JavaScript Study Group",
        "description": "Deep dive into modern JavaScript concepts",
        "theme": "Programming & Technology",
        "meet_link": "https://meet.google.com/abc-defg-hij",
        "meet_id": "abc-defg-hij",
        "max_participants": 15,
        "scheduled_time": "2024-01-25T14:00:00.000Z",
        "scheduled_time_local": "1/25/2024, 7:00:00 PM",
        "next_occurrence": "2024-01-25T14:00:00.000Z",
        "next_occurrence_local": "1/25/2024, 7:00:00 PM",
        "duration_minutes": 90,
        "is_recurring": false,
        "recurrence_pattern": null,
        "recurrence_interval": null,
        "recurrence_days_of_week": null,
        "recurrence_end_date": null,
        "recurrence_end_date_local": null,
        "timezone": "Asia/Karachi",
        "requires_approval": true,
        "created_at": "2024-01-20T10:30:00.000Z",
        "created_at_local": "1/20/2024, 3:30:00 PM",
        "is_active": true,
        "creator_name": "John Doe",
        "creator_email": "john@example.com",
        "current_members": 3,
        "user_role": null,
        "user_joined_at": null,
        "user_join_request_status": null,
        "user_join_requested_at": null
      }
    ],
    "totalGroups": 1,
    "pagination": {
      "limit": 20,
      "offset": 0
    },
    "filters": {
      "search": null,
      "theme": null,
      "requiresApproval": null,
      "date": null
    },
    "timezone": "Asia/Karachi"
  }
}
```

---

## 🔍 **3. Get Study Group Details API**

**Endpoint:** `GET /api/study-groups/{groupId}`

**Description:** Get detailed information about a specific study group including members.

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "group": {
      "id": 1,
      "title": "Advanced JavaScript Study Group",
      "description": "Deep dive into modern JavaScript concepts",
      "theme": "Programming & Technology",
      "meetLink": "https://meet.google.com/abc-defg-hij",
      "meetId": "meet-id-here",
      "maxParticipants": 15,
      "scheduledTime": "2024-01-25T14:00:00.000Z",
      "durationMinutes": 90,
      "isActive": true,
      "createdAt": "2024-01-20T10:30:00.000Z",
      "creator": {
        "id": 4,
        "name": "John Doe",
        "email": "john@example.com"
      }
    },
    "members": [
      {
        "id": 4,
        "name": "John Doe",
        "email": "john@example.com",
        "picture": "https://...",
        "role": "admin",
        "joined_at": "2024-01-20T10:30:00.000Z"
      },
      {
        "id": 5,
        "name": "Jane Smith",
        "email": "jane@example.com",
        "picture": "https://...",
        "role": "member",
        "joined_at": "2024-01-20T11:00:00.000Z"
      }
    ],
    "totalMembers": 2
  }
}
```

---

## ➕ **4. Join Study Group API**

**Endpoint:** `POST /api/study-groups/{groupId}/join`

**Description:** Join an existing study group.

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully joined study group"
}
```

**Example Usage:**
```javascript
const response = await fetch(`https://1befd1562ae3.ngrok-free.app/api/study-groups/${groupId}/join`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  }
});

const result = await response.json();
if (result.success) {
  console.log('Successfully joined study group!');
}
```

---

## 📝 **5. Request to Join Study Group API**

**Endpoint:** `POST /api/study-groups/{groupId}/request-join`

**Description:** Send a request to join a study group that requires approval, with a custom message.

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

**Request Body:**
```json
{
  "message": "I would love to join this study group because I'm passionate about learning JavaScript and would like to contribute to the discussions."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Join request sent successfully",
  "data": {
    "requestId": 123,
    "requestedAt": "2024-01-20T10:30:00.000Z"
  }
}
```

**Example Usage:**
```javascript
const response = await fetch(`https://1befd1562ae3.ngrok-free.app/api/study-groups/${groupId}/request-join`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: "I'm excited to join this study group! I have experience with React and would love to learn more about advanced concepts."
  })
});

const result = await response.json();
if (result.success) {
  console.log('Join request sent successfully!');
  console.log('Request ID:', result.data.requestId);
}
```

---

## 📋 **6. Get My Join Requests API**

**Endpoint:** `GET /api/study-groups/my-join-requests`

**Description:** Get all join requests sent by the current user.

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": 123,
        "groupId": 1,
        "groupTitle": "Advanced JavaScript Study Group",
        "message": "I would love to join this study group...",
        "status": "pending",
        "requestedAt": "2024-01-20T10:30:00.000Z"
      }
    ],
    "totalRequests": 1
  }
}
```

---

## 📋 **7. Get Join Requests for Group API**

**Endpoint:** `GET /api/study-groups/{groupId}/join-requests`

**Description:** Get all pending join requests for a study group (admin/creator only).

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": 123,
        "userId": 5,
        "userName": "Jane Smith",
        "userEmail": "jane@example.com",
        "message": "I would love to join this study group...",
        "status": "pending",
        "requestedAt": "2024-01-20T10:30:00.000Z"
      }
    ],
    "totalRequests": 1
  }
}
```

---

## ✅ **8. Respond to Join Request API**

**Endpoint:** `POST /api/study-groups/{groupId}/join-requests/{requestId}/respond`

**Description:** Accept or reject a join request (admin/creator only).

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

**Request Body:**
```json
{
  "action": "accept"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Join request accepted successfully",
  "data": {
    "requestId": 123,
    "action": "accepted"
  }
}
```

---

## ➖ **9. Leave Study Group API**

**Endpoint:** `POST /api/study-groups/{groupId}/leave`

**Description:** Leave a study group (non-creators only).

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully left study group"
}
```

---

## 🗑️ **10. Delete Study Group API**

**Endpoint:** `DELETE /api/study-groups/{groupId}`

**Description:** Delete a study group (creator only).

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response:**
```json
{
  "success": true,
  "message": "Study group deleted successfully"
}
```

---

## 🎨 **Automatic Features**

### **Random Theme Generation:**
The API automatically assigns one of these themes:
- Mathematics & Sciences
- Programming & Technology
- Languages & Literature
- History & Philosophy
- Business & Economics
- Arts & Design
- Health & Medicine
- Engineering & Architecture
- Social Sciences
- Environmental Studies
- Computer Science
- Physics & Chemistry
- Biology & Medicine
- Psychology & Sociology
- Music & Performing Arts

### **Google Meet Integration:**
- Automatically creates Google Meet when `scheduledTime` is provided
- Requires user to have granted Google Meet access
- Generates unique meet links based on creator ID and group ID
- Integrates with Google Calendar for scheduling

---

## 🗄️ **Database Schema**

### **Tables Created Automatically:**

```sql
-- Study groups table
CREATE TABLE study_groups (
  id SERIAL PRIMARY KEY,
  creator_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  theme VARCHAR(100),
  meet_link TEXT,
  meet_id VARCHAR(255),
  max_participants INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE,
  scheduled_time TIMESTAMP,
  duration_minutes INTEGER DEFAULT 60,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Study group members table
CREATE TABLE study_group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role VARCHAR(50) DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(group_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_study_groups_creator_id ON study_groups(creator_id);
CREATE INDEX idx_study_groups_meet_id ON study_groups(meet_id);
CREATE INDEX idx_study_group_members_group_id ON study_group_members(group_id);
CREATE INDEX idx_study_group_members_user_id ON study_group_members(user_id);
```

---

## 🔄 **Complete Study Group Flow**

### **1. Create Study Group:**
```javascript
// User creates study group
const createResponse = await fetch('/api/study-groups/create', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    title: 'My Study Group',
    description: 'Description here',
    scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 60
  })
});

const { data } = await createResponse.json();
const groupId = data.id;
const meetLink = data.meetLink;
```

### **2. Share with Others:**
```javascript
// Share the group ID or meet link with others
console.log(`Join my study group: ${groupId}`);
console.log(`Meet link: ${meetLink}`);
```

### **3. Others Join:**
```javascript
// Other users join using the group ID
const joinResponse = await fetch(`/api/study-groups/${groupId}/join`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${otherUserToken}` }
});
```

### **4. Start Study Session:**
```javascript
// When it's time to study, use the meet link
if (meetLink) {
  window.open(meetLink, '_blank');
}
```

---

## 🧪 **Testing the API**

### **1. Health Check:**
```bash
curl https://1befd1562ae3.ngrok-free.app/api/health
```

### **2. Create Study Group (with JWT):**
```bash
curl -X POST https://1befd1562ae3.ngrok-free.app/api/study-groups/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Study Group",
    "description": "Testing the API",
    "maxParticipants": 5,
    "scheduledTime": "2024-01-25T14:00:00.000Z",
    "durationMinutes": 60
  }'
```

### **3. Get My Groups:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://1befd1562ae3.ngrok-free.app/api/study-groups/my-groups
```

---

## 🚨 **Error Handling**

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "ErrorType",
  "message": "Detailed error message"
}
```

**Common Error Types:**
- `400`: Bad Request (missing required fields, group full, already member)
- `401`: Unauthorized (invalid JWT token)
- `403`: Forbidden (no Google Meet access, not creator)
- `404`: Not Found (group doesn't exist)
- `500`: Internal Server Error

---

## 📊 **Features**

✅ **Automatic theme generation** - Random study themes assigned  
✅ **Google Meet integration** - Automatic meet link creation  
✅ **Unique meet links** - Based on creator ID and group ID  
✅ **Member management** - Join, leave, role-based access  
✅ **Scheduling support** - Optional scheduled study sessions  
✅ **JWT authentication** - Secure access control  
✅ **Comprehensive logging** - Detailed request/response logging  
✅ **Data validation** - Input validation and error handling  
✅ **Soft delete** - Groups can be deactivated without data loss  

---

## 🎯 **Next Steps**

1. **Install dependencies:** `npm install`
2. **Restart server:** `npm run dev`
3. **Grant Google Meet access** to users via `/api/auth/google-meet-access`
4. **Test study group creation** with your JWT token
5. **Integrate with mobile app** using the provided examples

The Study Groups API is now ready to create collaborative learning environments with Google Meet integration! 🚀
