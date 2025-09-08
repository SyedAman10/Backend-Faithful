const { OAuth2Client } = require('google-auth-library');
const { google } = require('googleapis');
const { pool } = require('../config/database');

// Create OAuth2 client
const createOAuthClient = () => {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
};

// Refresh access token using refresh token
const refreshAccessToken = async (refreshToken) => {
  try {
    const oauth2Client = createOAuthClient();
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    
    // Update the token in database
    await pool.query(
      'UPDATE users SET google_access_token = $1, updated_at = CURRENT_TIMESTAMP WHERE google_refresh_token = $2',
      [credentials.access_token, refreshToken]
    );

    return credentials.access_token;
  } catch (error) {
    console.error('❌ Failed to refresh access token:', error.message);
    throw error;
  }
};

// Get valid access token for a user
const getValidAccessToken = async (userId) => {
  try {
    // Get user's tokens from database
    const result = await pool.query(
      'SELECT google_access_token, google_refresh_token FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const { google_access_token, google_refresh_token } = result.rows[0];

    if (!google_refresh_token) {
      throw new Error('No refresh token available');
    }

    // Try to use current access token first
    if (google_access_token) {
      try {
        // Test if current token is valid by making a simple API call
        const oauth2Client = createOAuthClient();
        oauth2Client.setCredentials({ access_token: google_access_token });
        
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        await calendar.calendarList.list({ maxResults: 1 });
        
        return google_access_token; // Token is still valid
      } catch (error) {
        if (error.code === 401) {
          console.log('🔄 Access token expired, refreshing...');
          // Token is expired, refresh it
          return await refreshAccessToken(google_refresh_token);
        }
        throw error;
      }
    } else {
      // No access token, refresh to get a new one
      return await refreshAccessToken(google_refresh_token);
    }
  } catch (error) {
    console.error('❌ Failed to get valid access token:', error.message);
    throw error;
  }
};

// Create Google Calendar event with Meet
const createGoogleCalendarEvent = async (userId, eventData) => {
  try {
    const accessToken = await getValidAccessToken(userId);
    
    const oauth2Client = createOAuthClient();
    oauth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const event = {
      summary: eventData.title,
      description: eventData.description || `Study Group: ${eventData.title}`,
      start: {
        dateTime: eventData.startTime,
        timeZone: eventData.timeZone || 'UTC',
      },
      end: {
        dateTime: eventData.endTime,
        timeZone: eventData.timeZone || 'UTC',
      },
      attendees: eventData.attendees || [],
      conferenceData: {
        createRequest: {
          requestId: eventData.requestId || `study-group-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      },
      guestsCanModify: false,
      guestsCanInviteOthers: false,
      guestsCanSeeOtherGuests: true
    };

    // Add recurrence if specified
    if (eventData.recurrence) {
      event.recurrence = eventData.recurrence;
    }

    console.log('📅 Creating Google Calendar event:', {
      title: eventData.title,
      startTime: eventData.startTime,
      endTime: eventData.endTime,
      attendees: eventData.attendees?.length || 0,
      isRecurring: !!eventData.recurrence
    });

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1,
      sendUpdates: 'all'
    });

    console.log('✅ Google Calendar event created successfully:', {
      eventId: response.data.id,
      meetId: response.data.conferenceData?.conferenceId,
      meetLink: response.data.hangoutLink
    });

    return {
      meetId: response.data.conferenceData?.conferenceId,
      meetLink: response.data.hangoutLink,
      eventId: response.data.id,
      attendees: response.data.attendees || []
    };
  } catch (error) {
    console.error('❌ Failed to create Google Calendar event:', error.message);
    throw error;
  }
};

// Update Google Calendar event
const updateGoogleCalendarEvent = async (userId, eventId, eventData) => {
  try {
    const accessToken = await getValidAccessToken(userId);
    
    const oauth2Client = createOAuthClient();
    oauth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const event = {
      summary: eventData.title,
      description: eventData.description || `Study Group: ${eventData.title}`,
      start: {
        dateTime: eventData.startTime,
        timeZone: eventData.timeZone || 'UTC',
      },
      end: {
        dateTime: eventData.endTime,
        timeZone: eventData.timeZone || 'UTC',
      },
      attendees: eventData.attendees || [],
      conferenceData: {
        createRequest: {
          requestId: eventData.requestId || `study-group-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      },
      guestsCanModify: false,
      guestsCanInviteOthers: false,
      guestsCanSeeOtherGuests: true
    };

    // Add recurrence if specified
    if (eventData.recurrence) {
      event.recurrence = eventData.recurrence;
    }

    console.log('📅 Updating Google Calendar event:', {
      eventId: eventId,
      title: eventData.title,
      startTime: eventData.startTime,
      endTime: eventData.endTime,
      attendees: eventData.attendees?.length || 0,
      isRecurring: !!eventData.recurrence
    });

    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId: eventId,
      resource: event,
      conferenceDataVersion: 1,
      sendUpdates: 'all'
    });

    console.log('✅ Google Calendar event updated successfully:', {
      eventId: response.data.id,
      meetId: response.data.conferenceData?.conferenceId,
      meetLink: response.data.hangoutLink
    });

    return {
      meetId: response.data.conferenceData?.conferenceId,
      meetLink: response.data.hangoutLink,
      eventId: response.data.id,
      attendees: response.data.attendees || []
    };
  } catch (error) {
    console.error('❌ Failed to update Google Calendar event:', error.message);
    throw error;
  }
};

// Delete Google Calendar event
const deleteGoogleCalendarEvent = async (userId, eventId) => {
  try {
    const accessToken = await getValidAccessToken(userId);
    
    const oauth2Client = createOAuthClient();
    oauth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    console.log('🗑️ Deleting Google Calendar event:', {
      eventId: eventId,
      userId: userId
    });

    // First, try to get the event to check if it exists
    try {
      await calendar.events.get({
        calendarId: 'primary',
        eventId: eventId
      });
      console.log('✅ Event exists, proceeding with deletion');
    } catch (getError) {
      if (getError.code === 404) {
        console.log('⚠️ Event not found in Google Calendar, it may have been already deleted');
        // Event doesn't exist, consider this a success
        return { success: true, message: 'Event not found (already deleted)' };
      } else {
        throw getError;
      }
    }

    // Delete the event
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
      sendUpdates: 'all'
    });

    console.log('✅ Google Calendar event deleted successfully:', {
      eventId: eventId
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Failed to delete Google Calendar event:', {
      error: error.message,
      code: error.code,
      eventId: eventId,
      userId: userId
    });
    
    // Provide more specific error messages
    if (error.code === 404) {
      throw new Error('Google Calendar event not found. It may have been already deleted or moved.');
    } else if (error.code === 403) {
      throw new Error('Insufficient permissions to delete Google Calendar event. Please check your Google Calendar access.');
    } else if (error.code === 401) {
      throw new Error('Google Calendar authentication expired. Please re-authenticate with Google.');
    } else {
      throw new Error(`Google Calendar deletion failed: ${error.message}`);
    }
  }
};

module.exports = {
  getValidAccessToken,
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  refreshAccessToken
};
