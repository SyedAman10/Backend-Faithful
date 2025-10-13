# LiveKit Quick Setup Guide

Follow these steps to get LiveKit running with your Faithful Companion app.

---

## **🚀 Quick Start (5 Minutes)**

### **Step 1: Sign Up for LiveKit Cloud**

1. Go to https://cloud.livekit.io
2. Click "Sign Up" and create an account
3. Create a new project (e.g., "Faithful Companion")
4. You'll see your dashboard with:
   - **API Key** (looks like: `APIAbcDefGhi123`)
   - **API Secret** (looks like: `secret123456789...`)
   - **WebSocket URL** (looks like: `wss://faithful-companion-xyz.livekit.cloud`)

### **Step 2: Configure Your Backend**

1. Open your `.env` file (copy from `env-template.txt` if you don't have one)

2. Add these three lines:
   ```env
   LIVEKIT_API_KEY=APIAbcDefGhi123
   LIVEKIT_API_SECRET=secret123456789...
   LIVEKIT_SERVER_URL=wss://faithful-companion-xyz.livekit.cloud
   ```

3. **Replace with your actual values from LiveKit Cloud dashboard!**

### **Step 3: Restart Your Server**

```bash
# Stop current server (Ctrl+C if running)

# Restart
npm start

# Or if using PM2
pm2 restart server
```

### **Step 4: Test the Integration**

```bash
# Check LiveKit status
curl http://localhost:3000/api/livekit/status \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Expected response:
{
  "success": true,
  "data": {
    "configured": true,
    "serverUrl": "wss://faithful-companion-xyz.livekit.cloud",
    "hasApiKey": true,
    "hasApiSecret": true,
    "hasServerUrl": true
  }
}
```

✅ **You're done!** LiveKit is now integrated with your Study Groups.

---

## **📱 Using LiveKit in Study Groups**

### **Creating a Study Group with LiveKit:**

When creating a study group, add these fields:

```json
{
  "title": "Bible Study - Gospel of John",
  "description": "Weekly study session",
  "videoProvider": "livekit",
  "useLiveKit": true,
  "maxParticipants": 15,
  "scheduledTime": "2025-10-15T19:00:00.000Z"
}
```

The backend will automatically:
1. Generate a unique room name
2. Store it in the database
3. Return the room details

### **Joining a Meeting:**

1. **Frontend requests access token:**
   ```javascript
   POST /api/livekit/token
   {
     "roomName": "study_group_1697123456_abc123",
     "participantName": "John Doe"
   }
   ```

2. **Backend returns token:**
   ```javascript
   {
     "token": "eyJhbGciOiJIUzI1NiIs...",
     "serverUrl": "wss://your-project.livekit.cloud",
     "roomName": "study_group_1697123456_abc123"
   }
   ```

3. **Frontend connects to LiveKit:**
   ```javascript
   const room = new Room();
   await room.connect(serverUrl, token);
   ```

---

## **💰 Free Tier Limits**

LiveKit Cloud Free Tier includes:
- ✅ **10,000 minutes per month** (166 hours)
- ✅ **Up to 100 concurrent participants**
- ✅ **Unlimited rooms**
- ✅ All features (video, audio, screen share, data channels)

**Example Usage:**
- 20 study groups × 1 hour each × 4 weeks = 80 hours/month ✅
- 5 participants per group = well within limits ✅

---

## **🔧 Advanced Setup (Self-Hosted)**

If you want to host LiveKit yourself:

### **Docker Setup:**

```bash
# 1. Create a docker-compose.yml
cat > docker-compose.yml <<EOF
version: '3.8'
services:
  livekit:
    image: livekit/livekit-server
    ports:
      - "7880:7880"
      - "7881:7881"
      - "7882:7882/udp"
    environment:
      - LIVEKIT_KEYS=your-api-key: your-secret-key
    restart: unless-stopped
EOF

# 2. Start LiveKit
docker-compose up -d

# 3. Update .env
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-secret-key
LIVEKIT_SERVER_URL=wss://your-domain.com
```

### **Nginx Reverse Proxy:**

```nginx
server {
    listen 443 ssl http2;
    server_name livekit.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:7880;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## **📊 Monitoring**

### **Check Active Rooms:**

```bash
curl http://localhost:3000/api/livekit/rooms \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **Get Room Details:**

```bash
curl http://localhost:3000/api/livekit/rooms/study_group_123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **View Usage in LiveKit Cloud:**

Go to your LiveKit Cloud dashboard to see:
- Real-time active participants
- Monthly usage (minutes)
- Room history
- Bandwidth usage

---

## **🐛 Common Issues**

### **Issue: "LiveKit service not configured"**

**Solution:**
1. Check that you added all three environment variables to `.env`
2. Restart your server
3. Verify with `/api/livekit/status`

### **Issue: Can't connect to room**

**Solution:**
1. **Check server URL format**: Must start with `wss://` (secure WebSocket)
2. **Verify API credentials**: Go to LiveKit Cloud dashboard and copy again
3. **Check firewall**: Ensure ports 7880-7882 are open (self-hosted only)

### **Issue: "Invalid token" error**

**Solution:**
1. Token expires after a certain time (default: 6 hours)
2. Request a new token from `/api/livekit/token`
3. Check that `LIVEKIT_API_SECRET` matches your LiveKit Cloud secret

---

## **✅ Verification Checklist**

Before going live, verify:

- [ ] `.env` file has all three LiveKit variables
- [ ] Server restarts without errors
- [ ] `/api/livekit/status` returns `"configured": true`
- [ ] Can generate a token successfully
- [ ] Can create a study group with `useLiveKit: true`
- [ ] Frontend can connect to LiveKit room

---

## **📚 Next Steps**

1. **Read full documentation**: `LIVEKIT_INTEGRATION.md`
2. **Test with mobile app**: Use LiveKit React Native SDK
3. **Enable screen sharing**: Add to frontend
4. **Set up recording**: Configure in LiveKit Cloud
5. **Monitor usage**: Keep an eye on your monthly minutes

---

## **💡 Tips**

- **Start with Google Meet + LiveKit**: Let users choose their preferred platform
- **Monitor your usage**: Check LiveKit Cloud dashboard regularly
- **Upgrade when needed**: If you exceed free tier, upgrade to pay-as-you-go
- **Test audio/video quality**: Test on different devices and networks
- **Use room names wisely**: Use consistent naming like `study_group_{id}`

---

## **🎯 Production Checklist**

Before deploying to production:

- [ ] Using LiveKit Cloud (recommended) or properly secured self-hosted
- [ ] SSL/TLS enabled (HTTPS/WSS required)
- [ ] Environment variables secured (not in version control)
- [ ] Tested on multiple devices (iOS, Android, Web)
- [ ] Monitoring set up (LiveKit dashboard + backend logs)
- [ ] Backup plan (Google Meet as fallback)
- [ ] User documentation/help guide created

---

**That's it! You're ready to use LiveKit for your Study Groups.** 🎥✨

For questions, check the full documentation in `LIVEKIT_INTEGRATION.md` or visit https://docs.livekit.io

