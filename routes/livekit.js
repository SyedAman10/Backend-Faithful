const express = require('express');
const router = express.Router();
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../config/database');

// LiveKit configuration
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_SERVER_URL = process.env.LIVEKIT_SERVER_URL;

// Initialize LiveKit Room Service Client
const roomService = LIVEKIT_API_KEY && LIVEKIT_API_SECRET 
  ? new RoomServiceClient(LIVEKIT_SERVER_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
  : null;

/**
 * Generate LiveKit Access Token
 * POST /api/livekit/token
 * Body: { roomName: string, participantName?: string }
 */
router.post('/token', authenticateToken, async (req, res) => {
  console.log('🎫 Generate LiveKit Token Request:', {
    userId: req.user.id,
    userEmail: req.user.email,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  try {
    // Validate LiveKit configuration
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_SERVER_URL) {
      console.error('❌ LiveKit not configured');
      return res.status(500).json({
        success: false,
        error: 'LiveKit service not configured',
        message: 'Please configure LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_SERVER_URL in environment variables'
      });
    }

    const { roomName, participantName } = req.body;
    const userId = req.user.id;
    const userName = req.user.name || participantName || `User ${userId}`;

    if (!roomName) {
      console.log('❌ Room name missing');
      return res.status(400).json({
        success: false,
        error: 'Room name is required',
        message: 'Please provide a room name'
      });
    }

    console.log('🔑 Creating access token:', {
      roomName: roomName,
      userId: userId,
      userName: userName,
      timestamp: new Date().toISOString()
    });

    // Create access token
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: `user_${userId}`,
      name: userName,
      metadata: JSON.stringify({
        userId: userId,
        email: req.user.email
      })
    });

    // Add room permissions
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true
    });

    const jwt = token.toJwt();

    console.log('✅ Access token generated successfully:', {
      roomName: roomName,
      identity: `user_${userId}`,
      tokenLength: jwt.length,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        token: jwt,
        serverUrl: LIVEKIT_SERVER_URL,
        roomName: roomName,
        identity: `user_${userId}`,
        participantName: userName
      }
    });

  } catch (error) {
    console.error('❌ Generate LiveKit token error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      error: 'Failed to generate access token',
      message: error.message
    });
  }
});

/**
 * Create LiveKit Room
 * POST /api/livekit/rooms
 * Body: { name: string, emptyTimeout?: number, maxParticipants?: number }
 */
router.post('/rooms', authenticateToken, async (req, res) => {
  console.log('🏠 Create LiveKit Room Request:', {
    userId: req.user.id,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  try {
    if (!roomService) {
      return res.status(500).json({
        success: false,
        error: 'LiveKit service not configured'
      });
    }

    const { name, emptyTimeout = 600, maxParticipants = 20 } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Room name is required'
      });
    }

    console.log('🔨 Creating LiveKit room:', {
      name: name,
      emptyTimeout: emptyTimeout,
      maxParticipants: maxParticipants,
      timestamp: new Date().toISOString()
    });

    // Create room on LiveKit server
    const room = await roomService.createRoom({
      name: name,
      emptyTimeout: emptyTimeout,
      maxParticipants: maxParticipants
    });

    console.log('✅ LiveKit room created:', {
      sid: room.sid,
      name: room.name,
      numParticipants: room.numParticipants,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        sid: room.sid,
        name: room.name,
        emptyTimeout: room.emptyTimeout,
        maxParticipants: room.maxParticipants,
        numParticipants: room.numParticipants,
        creationTime: room.creationTime
      }
    });

  } catch (error) {
    console.error('❌ Create LiveKit room error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      error: 'Failed to create room',
      message: error.message
    });
  }
});

/**
 * List Active LiveKit Rooms
 * GET /api/livekit/rooms
 */
router.get('/rooms', authenticateToken, async (req, res) => {
  console.log('📋 List LiveKit Rooms Request:', {
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });

  try {
    if (!roomService) {
      return res.status(500).json({
        success: false,
        error: 'LiveKit service not configured'
      });
    }

    console.log('🔍 Fetching active rooms from LiveKit...');

    const rooms = await roomService.listRooms();

    console.log('✅ Active rooms retrieved:', {
      count: rooms.length,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        rooms: rooms.map(room => ({
          sid: room.sid,
          name: room.name,
          numParticipants: room.numParticipants,
          maxParticipants: room.maxParticipants,
          creationTime: room.creationTime,
          emptyTimeout: room.emptyTimeout
        })),
        total: rooms.length
      }
    });

  } catch (error) {
    console.error('❌ List LiveKit rooms error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      error: 'Failed to list rooms',
      message: error.message
    });
  }
});

/**
 * Get Room Details
 * GET /api/livekit/rooms/:roomName
 */
router.get('/rooms/:roomName', authenticateToken, async (req, res) => {
  console.log('🔍 Get Room Details Request:', {
    userId: req.user.id,
    roomName: req.params.roomName,
    timestamp: new Date().toISOString()
  });

  try {
    if (!roomService) {
      return res.status(500).json({
        success: false,
        error: 'LiveKit service not configured'
      });
    }

    const { roomName } = req.params;

    console.log('🔍 Fetching room details:', { roomName });

    const rooms = await roomService.listRooms([roomName]);
    
    if (rooms.length === 0) {
      console.log('❌ Room not found:', { roomName });
      return res.status(404).json({
        success: false,
        error: 'Room not found',
        message: `Room '${roomName}' does not exist or is not active`
      });
    }

    const room = rooms[0];

    // Get participants in the room
    const participants = await roomService.listParticipants(roomName);

    console.log('✅ Room details retrieved:', {
      roomName: room.name,
      participantCount: participants.length,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        room: {
          sid: room.sid,
          name: room.name,
          numParticipants: room.numParticipants,
          maxParticipants: room.maxParticipants,
          creationTime: room.creationTime,
          emptyTimeout: room.emptyTimeout
        },
        participants: participants.map(p => ({
          sid: p.sid,
          identity: p.identity,
          name: p.name,
          state: p.state,
          joinedAt: p.joinedAt,
          metadata: p.metadata
        }))
      }
    });

  } catch (error) {
    console.error('❌ Get room details error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get room details',
      message: error.message
    });
  }
});

/**
 * Delete LiveKit Room
 * DELETE /api/livekit/rooms/:roomName
 */
router.delete('/rooms/:roomName', authenticateToken, async (req, res) => {
  console.log('🗑️ Delete LiveKit Room Request:', {
    userId: req.user.id,
    roomName: req.params.roomName,
    timestamp: new Date().toISOString()
  });

  try {
    if (!roomService) {
      return res.status(500).json({
        success: false,
        error: 'LiveKit service not configured'
      });
    }

    const { roomName } = req.params;

    console.log('🗑️ Deleting room:', { roomName });

    await roomService.deleteRoom(roomName);

    console.log('✅ Room deleted successfully:', {
      roomName: roomName,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Room '${roomName}' has been deleted`,
      data: {
        roomName: roomName,
        deletedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Delete room error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      error: 'Failed to delete room',
      message: error.message
    });
  }
});

/**
 * Remove Participant from Room
 * POST /api/livekit/rooms/:roomName/remove-participant
 * Body: { participantIdentity: string }
 */
router.post('/rooms/:roomName/remove-participant', authenticateToken, async (req, res) => {
  console.log('👤 Remove Participant Request:', {
    userId: req.user.id,
    roomName: req.params.roomName,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  try {
    if (!roomService) {
      return res.status(500).json({
        success: false,
        error: 'LiveKit service not configured'
      });
    }

    const { roomName } = req.params;
    const { participantIdentity } = req.body;

    if (!participantIdentity) {
      return res.status(400).json({
        success: false,
        error: 'Participant identity is required'
      });
    }

    console.log('👤 Removing participant:', {
      roomName: roomName,
      participantIdentity: participantIdentity,
      timestamp: new Date().toISOString()
    });

    await roomService.removeParticipant(roomName, participantIdentity);

    console.log('✅ Participant removed:', {
      roomName: roomName,
      participantIdentity: participantIdentity,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Participant removed from room',
      data: {
        roomName: roomName,
        participantIdentity: participantIdentity,
        removedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Remove participant error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      error: 'Failed to remove participant',
      message: error.message
    });
  }
});

/**
 * Get LiveKit Configuration Status
 * GET /api/livekit/status
 */
router.get('/status', authenticateToken, async (req, res) => {
  console.log('🔍 LiveKit Status Check:', {
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });

  const isConfigured = !!(LIVEKIT_API_KEY && LIVEKIT_API_SECRET && LIVEKIT_SERVER_URL);

  res.json({
    success: true,
    data: {
      configured: isConfigured,
      serverUrl: isConfigured ? LIVEKIT_SERVER_URL : null,
      hasApiKey: !!LIVEKIT_API_KEY,
      hasApiSecret: !!LIVEKIT_API_SECRET,
      hasServerUrl: !!LIVEKIT_SERVER_URL
    }
  });
});

module.exports = router;

