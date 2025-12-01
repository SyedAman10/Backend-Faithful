const axios = require('axios');

// Expo Push Notification API endpoint
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send a push notification via Expo Push Notification Service
 * @param {string} pushToken - Expo push token (ExponentPushToken[...])
 * @param {object} notification - Notification details
 * @param {string} notification.title - Notification title
 * @param {string} notification.body - Notification body
 * @param {object} notification.data - Custom data payload
 * @param {number} notification.badge - Badge count (optional)
 * @param {string} notification.sound - Sound to play (default: 'default')
 * @returns {Promise<object>} Response from Expo Push API
 */
async function sendPushNotification(pushToken, notification) {
  try {
    // Validate push token format
    if (!pushToken || !pushToken.startsWith('ExponentPushToken[')) {
      console.log('⚠️  Invalid push token format:', pushToken);
      return { success: false, error: 'Invalid push token format' };
    }

    const message = {
      to: pushToken,
      sound: notification.sound || 'default',
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      badge: notification.badge || 1,
      priority: 'high',
      channelId: 'default'
    };

    console.log('📤 Sending push notification:', {
      to: pushToken.substring(0, 30) + '...',
      title: message.title,
      body: message.body.substring(0, 50) + '...'
    });

    const response = await axios.post(EXPO_PUSH_URL, message, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate'
      }
    });

    if (response.data.data) {
      const ticket = response.data.data[0];
      
      if (ticket.status === 'error') {
        console.error('❌ Push notification error:', ticket.message);
        return { success: false, error: ticket.message, details: ticket.details };
      }

      console.log('✅ Push notification sent successfully:', ticket.id);
      return { success: true, ticketId: ticket.id };
    }

    return { success: true, response: response.data };

  } catch (error) {
    console.error('❌ Failed to send push notification:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Send a prayer response notification
 * @param {string} pushToken - Recipient's push token
 * @param {object} details - Notification details
 * @param {string} details.responderName - Name of the person who responded (or null for anonymous)
 * @param {boolean} details.isAnonymous - Whether the response is anonymous
 * @param {number} details.prayerRequestId - ID of the prayer request
 * @param {number} details.responseId - ID of the response
 */
async function sendPrayerResponseNotification(pushToken, details) {
  const { responderName, isAnonymous, prayerRequestId, responseId } = details;

  const notification = {
    title: '🙏 Someone responded to your prayer',
    body: isAnonymous 
      ? 'You received a prayer response' 
      : `${responderName} responded to your prayer request`,
    data: {
      type: 'prayer_response',
      requestId: prayerRequestId,
      responseId: responseId
    },
    badge: 1,
    sound: 'default'
  };

  return await sendPushNotification(pushToken, notification);
}

/**
 * Send a journey reminder notification
 * @param {string} pushToken - User's push token
 * @param {number} nextDay - Next day number in the journey
 */
async function sendJourneyReminderNotification(pushToken, nextDay) {
  const notification = {
    title: '📖 Your Journey Awaits',
    body: `Day ${nextDay} is ready for you! Take a few minutes to connect with God today.`,
    data: {
      type: 'journey_reminder',
      day: nextDay
    },
    badge: 1,
    sound: 'default'
  };

  return await sendPushNotification(pushToken, notification);
}

/**
 * Send a custom push notification
 * @param {string} pushToken - User's push token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Custom data payload
 */
async function sendCustomNotification(pushToken, title, body, data = {}) {
  const notification = {
    title,
    body,
    data: {
      type: 'custom',
      ...data
    },
    badge: 1,
    sound: 'default'
  };

  return await sendPushNotification(pushToken, notification);
}

module.exports = {
  sendPushNotification,
  sendPrayerResponseNotification,
  sendJourneyReminderNotification,
  sendCustomNotification
};

