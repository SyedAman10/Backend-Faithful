# LiveKit Integration for Study Groups

This document describes the LiveKit video conferencing integration for the Faithful Companion app's Study Groups feature.

---

## **📹 Overview**

LiveKit has been integrated as an alternative to Google Meet for Study Groups, providing:
- ✅ Real-time video and audio conferencing
- ✅ Screen sharing capabilities
- ✅ Lower cost (self-hosted or affordable cloud)
- ✅ Better integration with the app
- ✅ Custom branding and control
- ✅ End-to-end encryption support

---

## **🏗️ Architecture**

```
Mobile/Web Client
    ↓
Request access token from backend
    ↓
Backend generates JWT token (routes/livekit.js)
    ↓
Client connects to LiveKit server
    ↓
Real-time video/audio communication
```

---

## **🔧 Setup**

### **Option 1: LiveKit Cloud (Recommended for Quick Start)**

1. **Sign up for LiveKit Cloud:**
   - Go to https://cloud.livekit.io
   - Create a new project
   - Copy your API Key and API Secret

2. **Add credentials to `.env`:**
   ```env
   LIVEKIT_API_KEY=your_api_key_from_livekit_cloud
   LIVEKIT_API_SECRET=your_api_secret_from_livekit_cloud
   LIVEKIT_SERVER_URL=wss://your-project.livekit.cloud
   ```

3. **Pricing:**
   - Free tier: 10,000 minutes/month
   - Pay-as-you-go: $0.0035/min (~$2.10/hour)
   - Much cheaper than alternatives

### **Option 2: Self-Hosted (For Full Control)**

1. **Install LiveKit Server using Docker:**
   ```bash
   docker run -d \
     --name livekit \
     -p 7880:7880 \
     -p 7881:7881 \
     -p 7882:7882/udp \
     -e LIVEKIT_KEYS="your-api-key: your-secret-key" \
     livekit/livekit-server
   ```

2. **Add credentials to `.env`:**
   ```env
   LIVEKIT_API_KEY=your-api-key
   LIVEKIT_API_SECRET=your-secret-key
   LIVEKIT_SERVER_URL=wss://your-domain.com
   ```

3. **Set up SSL/TLS:**
   - LiveKit requires HTTPS/WSS for production
   - Use Nginx or Caddy as reverse proxy
   - Get SSL certificate from Let's Encrypt

---

## **📊 Database Schema**

### **New Columns in `study_groups` Table:**

```sql
ALTER TABLE study_groups 
ADD COLUMN livekit_room_name VARCHAR(255),
ADD COLUMN livekit_room_sid VARCHAR(255),
ADD COLUMN use_livekit BOOLEAN DEFAULT FALSE,
ADD COLUMN video_provider VARCHAR(50) DEFAULT 'google_meet';
```

| Column | Type | Description |
|--------|------|-------------|
| `livekit_room_name` | VARCHAR(255) | Unique room identifier |
| `livekit_room_sid` | VARCHAR(255) | LiveKit server room SID |
| `use_livekit` | BOOLEAN | Whether group uses LiveKit |
| `video_provider` | VARCHAR(50) | 'google_meet' or 'livekit' |

---

## **🚀 API Endpoints**

### **1. Generate Access Token**

Generate a JWT token for a user to join a specific room.

**Endpoint:** `POST /api/livekit/token`

**Headers:**
```
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "roomName": "study_group_123",
  "participantName": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "serverUrl": "wss://your-project.livekit.cloud",
    "roomName": "study_group_123",
    "identity": "user_15",
    "participantName": "John Doe"
  }
}
```

---

### **2. Create Room**

Explicitly create a room on LiveKit server (optional, rooms auto-create on first join).

**Endpoint:** `POST /api/livekit/rooms`

**Request Body:**
```json
{
  "name": "study_group_123",
  "emptyTimeout": 600,
  "maxParticipants": 20
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sid": "RM_abc123",
    "name": "study_group_123",
    "emptyTimeout": 600,
    "maxParticipants": 20,
    "numParticipants": 0,
    "creationTime": 1697123456
  }
}
```

---

### **3. List Active Rooms**

Get all currently active rooms on LiveKit server.

**Endpoint:** `GET /api/livekit/rooms`

**Response:**
```json
{
  "success": true,
  "data": {
    "rooms": [
      {
        "sid": "RM_abc123",
        "name": "study_group_123",
        "numParticipants": 5,
        "maxParticipants": 20,
        "creationTime": 1697123456,
        "emptyTimeout": 600
      }
    ],
    "total": 1
  }
}
```

---

### **4. Get Room Details**

Get details about a specific room including participants.

**Endpoint:** `GET /api/livekit/rooms/:roomName`

**Response:**
```json
{
  "success": true,
  "data": {
    "room": {
      "sid": "RM_abc123",
      "name": "study_group_123",
      "numParticipants": 3,
      "maxParticipants": 20,
      "creationTime": 1697123456,
      "emptyTimeout": 600
    },
    "participants": [
      {
        "sid": "PA_xyz789",
        "identity": "user_15",
        "name": "John Doe",
        "state": "ACTIVE",
        "joinedAt": 1697123460,
        "metadata": "{\"userId\":15,\"email\":\"john@example.com\"}"
      }
    ]
  }
}
```

---

### **5. Delete Room**

End a room and disconnect all participants.

**Endpoint:** `DELETE /api/livekit/rooms/:roomName`

**Response:**
```json
{
  "success": true,
  "message": "Room 'study_group_123' has been deleted",
  "data": {
    "roomName": "study_group_123",
    "deletedAt": "2025-10-13T14:30:00.000Z"
  }
}
```

---

### **6. Remove Participant**

Remove a specific participant from a room.

**Endpoint:** `POST /api/livekit/rooms/:roomName/remove-participant`

**Request Body:**
```json
{
  "participantIdentity": "user_15"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Participant removed from room",
  "data": {
    "roomName": "study_group_123",
    "participantIdentity": "user_15",
    "removedAt": "2025-10-13T14:30:00.000Z"
  }
}
```

---

### **7. Check LiveKit Status**

Verify if LiveKit is properly configured.

**Endpoint:** `GET /api/livekit/status`

**Response:**
```json
{
  "success": true,
  "data": {
    "configured": true,
    "serverUrl": "wss://your-project.livekit.cloud",
    "hasApiKey": true,
    "hasApiSecret": true,
    "hasServerUrl": true
  }
}
```

---

## **📱 Study Groups Integration**

### **Creating a Study Group with LiveKit**

**Endpoint:** `POST /api/study-groups/create`

**Request Body:**
```json
{
  "title": "Bible Study - Gospel of John",
  "description": "Weekly study of John's Gospel",
  "maxParticipants": 15,
  "scheduledTime": "2025-10-15T19:00:00.000Z",
  "durationMinutes": 60,
  "videoProvider": "livekit",
  "useLiveKit": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Study group created successfully",
  "data": {
    "id": 123,
    "title": "Bible Study - Gospel of John",
    "videoProvider": "livekit",
    "useLiveKit": true,
    "livekitRoomName": "study_group_1697123456_abc123",
    "meetLink": null,
    "meetId": null,
    ...
  }
}
```

---

## **🎯 Frontend Integration Flow**

### **1. User Joins Study Group**

```javascript
// Step 1: Fetch study group details
const groupResponse = await fetch('/api/study-groups/123', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const group = await groupResponse.json();

// Step 2: Check if LiveKit is enabled
if (group.data.useLiveKit && group.data.livekitRoomName) {
  // Step 3: Get access token for LiveKit
  const tokenResponse = await fetch('/api/livekit/token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      roomName: group.data.livekitRoomName,
      participantName: userName
    })
  });
  
  const livekitData = await tokenResponse.json();
  
  // Step 4: Connect to LiveKit room
  connectToLiveKitRoom(
    livekitData.data.serverUrl,
    livekitData.data.token
  );
} else {
  // Use Google Meet link
  openGoogleMeet(group.data.meetLink);
}
```

### **2. React Native Example (using @livekit/react-native)**

```jsx
import { useRoom, AudioSession } from '@livekit/react-native';
import { Room } from 'livekit-client';

function StudyGroupCall({ groupId, userName }) {
  const [room] = useState(() => new Room());
  const { connect, participants } = useRoom(room);

  useEffect(() => {
    // Start audio session
    AudioSession.startAudioSession();
    
    // Get LiveKit token from backend
    fetch(`/api/livekit/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        roomName: `study_group_${groupId}`,
        participantName: userName
      })
    })
    .then(res => res.json())
    .then(data => {
      // Connect to LiveKit room
      connect(data.data.serverUrl, data.data.token, {
        audio: true,
        video: true
      });
    });

    return () => {
      room.disconnect();
      AudioSession.stopAudioSession();
    };
  }, []);

  return (
    <View>
      {participants.map(participant => (
        <ParticipantView 
          key={participant.sid} 
          participant={participant} 
        />
      ))}
    </View>
  );
}
```

---

## **🔐 Security**

### **Access Token Permissions**

Tokens generated by the backend include these grants:

```javascript
token.addGrant({
  roomJoin: true,           // Can join the room
  room: roomName,           // Specific room only
  canPublish: true,         // Can publish audio/video
  canSubscribe: true,       // Can see others' streams
  canPublishData: true,     // Can send chat messages
  canUpdateOwnMetadata: true // Can update their name/metadata
});
```

### **Additional Security Options:**

- **Room-level access control**: Check if user is a member of the study group before issuing token
- **Moderator permissions**: Give study group creator/admin additional grants
- **E2EE**: Enable end-to-end encryption for sensitive discussions
- **Recording**: Enable server-side recording for compliance

---

## **💰 Cost Comparison**

| Provider | Pricing Model | Cost per Hour |
|----------|---------------|---------------|
| **LiveKit Cloud** | Per-minute | $2.10/hour |
| **LiveKit Self-hosted** | Server costs | ~$0.50-2/hour |
| **Google Meet (Workspace)** | Per user/month | $6-18/user/month |
| **Twilio Video** | Per-minute | $4-8/hour |
| **Zoom** | Per host/month | $15-20/host/month |

**For 100 hours/month:**
- LiveKit Cloud: ~$210
- Self-hosted: ~$100 (server)
- Google Workspace: $600+ (10 users)

---

## **📊 Monitoring & Analytics**

### **Room Events (via Webhooks - Optional)**

LiveKit can send webhooks for:
- Room created/destroyed
- Participant joined/left
- Recording started/stopped
- Track published/unpublished

**Setup:** Configure webhook URL in LiveKit server config or Cloud dashboard.

### **Usage Tracking**

Monitor LiveKit usage via:
1. **LiveKit Cloud Dashboard**: Real-time metrics, usage reports
2. **Backend API**: Query `/api/livekit/rooms` for active rooms
3. **Database**: Track `study_groups` with `use_livekit = true`

---

## **🐛 Troubleshooting**

### **Issue: "LiveKit service not configured"**

**Solution:** Add credentials to `.env` and restart server:
```env
LIVEKIT_API_KEY=your_key
LIVEKIT_API_SECRET=your_secret
LIVEKIT_SERVER_URL=wss://your-server.livekit.cloud
```

### **Issue: "Failed to connect to room"**

**Possible causes:**
1. **Invalid token**: Regenerate token from backend
2. **Server URL wrong**: Check `LIVEKIT_SERVER_URL` in `.env`
3. **Network issues**: Ensure ports 7880, 7881, 7882 are open (self-hosted)
4. **HTTPS required**: LiveKit requires secure connection in production

### **Issue: "No video/audio"**

**Solution:**
1. Check device permissions (camera/microphone)
2. Test on different device/browser
3. Verify `canPublish: true` in token grants
4. Check network firewall rules

---

## **🚀 Future Enhancements**

Potential improvements:

1. **Screen Sharing** - Share Bible passages, presentations
2. **Recording** - Record study sessions for later review
3. **Chat** - Text chat alongside video
4. **Breakout Rooms** - Small group discussions within larger meetings
5. **Background Blur** - Privacy for home environments
6. **Live Transcription** - AI-powered captions
7. **Virtual Backgrounds** - Branded backgrounds

---

## **📚 Resources**

- **LiveKit Docs**: https://docs.livekit.io
- **React Native SDK**: https://docs.livekit.io/client-sdks/react-native/
- **API Reference**: https://docs.livekit.io/server-api/
- **Examples**: https://github.com/livekit/livekit-examples
- **Cloud Dashboard**: https://cloud.livekit.io

---

## **✅ Testing**

### **Test Token Generation:**
```bash
curl -X POST http://localhost:3000/api/livekit/token \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roomName": "test_room",
    "participantName": "Test User"
  }'
```

### **Test Room Creation:**
```bash
curl -X POST http://localhost:3000/api/livekit/rooms \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test_room",
    "maxParticipants": 10
  }'
```

### **Test Study Group with LiveKit:**
```bash
curl -X POST http://localhost:3000/api/study-groups/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Bible Study",
    "description": "Testing LiveKit integration",
    "videoProvider": "livekit",
    "useLiveKit": true,
    "maxParticipants": 10
  }'
```

---

Your Study Groups now have professional video conferencing powered by LiveKit! 🎥✨

