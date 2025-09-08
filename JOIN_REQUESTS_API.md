# Study Group Join Requests API Documentation

This document describes the new join request system that allows users to request to join study groups and group owners to approve or reject those requests.

## Overview

The join request system enables:
- Users to request joining study groups that require approval
- Group owners/admins to view and manage join requests
- Automatic handling of group capacity limits
- Request status tracking (pending, accepted, rejected)
- Optional messages from requesters

## Database Schema

### New Table: `study_group_join_requests`

```sql
CREATE TABLE study_group_join_requests (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
  message TEXT, -- Optional message from requester
  requested_at TIMESTAMP DEFAULT NOW(),
  responded_at TIMESTAMP,
  responded_by INTEGER, -- User ID who responded (group owner/admin)
  FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (responded_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(group_id, user_id) -- One request per user per group
);
```

### Updated Table: `study_groups`

```sql
ALTER TABLE study_groups ADD COLUMN requires_approval BOOLEAN DEFAULT TRUE;
```

## API Endpoints

### 1. Request to Join Study Group

**Endpoint:** `POST /api/study-groups/{groupId}/request-join`

**Description:** Send a request to join a study group.

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

**Request Body:**
```json
{
  "message": "I'd love to join this study group!" // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Join request sent successfully",
  "data": {
    "requestId": 123,
    "groupId": 456,
    "groupTitle": "JavaScript Study Group",
    "message": "I'd love to join this study group!",
    "status": "pending",
    "requestedAt": "2025-09-08T18:30:00.000Z"
  }
}
```

**Error Responses:**
- `400`: Already a member, already has pending request, group is full, or trying to join own group
- `404`: Study group not found or inactive

---

### 2. Get Join Requests (for Group Owners/Admins)

**Endpoint:** `GET /api/study-groups/{groupId}/join-requests`

**Description:** Get join requests for a study group (admin only).

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Query Parameters:**
- `status` (optional): Filter by status (`pending`, `accepted`, `rejected`, `all`) - default: `pending`
- `limit` (optional): Number of results per page - default: `20`
- `offset` (optional): Number of results to skip - default: `0`

**Response:**
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": 123,
        "user_id": 789,
        "message": "I'd love to join this study group!",
        "status": "pending",
        "requested_at": "2025-09-08T18:30:00.000Z",
        "responded_at": null,
        "name": "John Doe",
        "email": "john@example.com",
        "picture": "https://example.com/avatar.jpg"
      }
    ],
    "pagination": {
      "total": 5,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    },
    "filters": {
      "status": "pending"
    }
  }
}
```

**Error Responses:**
- `403`: Not a member of the group or not an admin

---

### 3. Respond to Join Request (Accept/Reject)

**Endpoint:** `POST /api/study-groups/{groupId}/join-requests/{requestId}/respond`

**Description:** Accept or reject a join request (admin only).

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

**Request Body:**
```json
{
  "action": "accept" // or "reject"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Join request accepted successfully",
  "data": {
    "requestId": 123,
    "action": "accept",
    "requesterName": "John Doe",
    "requesterEmail": "john@example.com",
    "respondedAt": "2025-09-08T18:35:00.000Z"
  }
}
```

**Error Responses:**
- `400`: Invalid action, request already processed, or group is full (for accept)
- `403`: Not an admin of the group
- `404`: Join request not found

---

### 4. Get My Join Requests

**Endpoint:** `GET /api/study-groups/my-join-requests`

**Description:** Get the current user's join requests.

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Query Parameters:**
- `status` (optional): Filter by status (`pending`, `accepted`, `rejected`, `all`) - default: `all`
- `limit` (optional): Number of results per page - default: `20`
- `offset` (optional): Number of results to skip - default: `0`

**Response:**
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": 123,
        "group_id": 456,
        "message": "I'd love to join this study group!",
        "status": "pending",
        "requested_at": "2025-09-08T18:30:00.000Z",
        "responded_at": null,
        "group_title": "JavaScript Study Group",
        "group_description": "Weekly JavaScript study sessions",
        "group_theme": "Programming & Technology",
        "max_participants": 10,
        "scheduled_time": "2025-09-10T20:00:00.000Z",
        "duration_minutes": 60,
        "group_creator_name": "Jane Smith",
        "group_creator_email": "jane@example.com"
      }
    ],
    "pagination": {
      "total": 3,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    },
    "filters": {
      "status": "all"
    }
  }
}
```

---

### 5. Updated Join Study Group (Direct Join)

**Endpoint:** `POST /api/study-groups/{groupId}/join`

**Description:** Directly join a study group (only works if group doesn't require approval).

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Successfully joined study group",
  "data": {
    "groupId": 456,
    "groupTitle": "JavaScript Study Group"
  }
}
```

**Response (Requires Approval):**
```json
{
  "success": false,
  "error": "This study group requires approval to join",
  "message": "Please use the request-join endpoint to send a join request",
  "requiresApproval": true,
  "groupTitle": "JavaScript Study Group"
}
```

---

## Updated Create Study Group

**Endpoint:** `POST /api/study-groups/create`

**New Field in Request Body:**
```json
{
  "title": "My Study Group",
  "description": "Description here",
  "requiresApproval": true, // New field - default: true
  "maxParticipants": 10,
  "scheduledTime": "2025-09-10T20:00:00.000Z"
}
```

**New Field in Response:**
```json
{
  "success": true,
  "data": {
    "id": 456,
    "title": "My Study Group",
    "requiresApproval": true, // New field
    // ... other fields
  }
}
```

---

## Frontend Integration Examples

### 1. Request to Join a Group

```javascript
const requestToJoin = async (groupId, message = '') => {
  try {
    const response = await fetch(`/api/study-groups/${groupId}/request-join`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Join request sent:', result.data);
      // Show success message
    } else {
      console.error('Failed to send request:', result.error);
      // Show error message
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
```

### 2. Get and Display Join Requests (Admin View)

```javascript
const getJoinRequests = async (groupId, status = 'pending') => {
  try {
    const response = await fetch(`/api/study-groups/${groupId}/join-requests?status=${status}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Display requests in UI
      result.data.requests.forEach(request => {
        console.log(`Request from ${request.name}: ${request.message}`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
```

### 3. Respond to Join Request

```javascript
const respondToRequest = async (groupId, requestId, action) => {
  try {
    const response = await fetch(`/api/study-groups/${groupId}/join-requests/${requestId}/respond`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action }) // 'accept' or 'reject'
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`Request ${action}ed:`, result.data);
      // Update UI to reflect the change
    } else {
      console.error('Failed to respond:', result.error);
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
```

### 4. Check if Group Requires Approval

```javascript
const joinGroup = async (groupId) => {
  try {
    const response = await fetch(`/api/study-groups/${groupId}/join`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Successfully joined
      console.log('Joined group:', result.data);
    } else if (result.requiresApproval) {
      // Group requires approval, show request form
      console.log('Group requires approval, redirecting to request form');
      // Show request form UI
    } else {
      // Other error
      console.error('Error:', result.error);
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
```

---

## Workflow Examples

### For Users Wanting to Join Groups:

1. **Find a study group** (via search, browse, or direct link)
2. **Check if group requires approval** by attempting direct join
3. **If approval required**: Send join request with optional message
4. **Wait for response** and check status via "My Join Requests"
5. **If accepted**: User is automatically added to the group

### For Group Owners/Admins:

1. **Create study group** with `requiresApproval: true` (default)
2. **Receive join requests** via the join requests endpoint
3. **Review requests** and requester information
4. **Accept or reject** requests based on criteria
5. **Accepted users** are automatically added to the group

---

## Error Handling

The API provides comprehensive error handling for common scenarios:

- **Duplicate requests**: Prevents multiple pending requests from the same user
- **Group capacity**: Checks capacity before accepting requests
- **Permission checks**: Ensures only admins can manage requests
- **Status validation**: Prevents responding to already processed requests
- **Group existence**: Validates group exists and is active

---

## Database Indexes

For optimal performance, the following indexes are automatically created:

```sql
CREATE INDEX idx_study_group_join_requests_group_id ON study_group_join_requests(group_id);
CREATE INDEX idx_study_group_join_requests_user_id ON study_group_join_requests(user_id);
CREATE INDEX idx_study_group_join_requests_status ON study_group_join_requests(status);
```

This ensures fast queries even with large numbers of join requests.
