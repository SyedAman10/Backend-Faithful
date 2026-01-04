const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { createGoogleCalendarEvent, updateGoogleCalendarEvent, deleteGoogleCalendarEvent } = require('../utils/googleAuth');
const { 
  generateRecurrenceRule, 
  calculateNextOccurrence, 
  validateRecurrenceParams,
  formatRecurrenceDescription 
} = require('../utils/recurringMeetings');

const router = express.Router();

// Study themes for random generation
const STUDY_THEMES = [
  'Mathematics & Sciences',
  'Programming & Technology',
  'Languages & Literature',
  'History & Philosophy',
  'Business & Economics',
  'Arts & Design',
  'Health & Medicine',
  'Engineering & Architecture',
  'Social Sciences',
  'Environmental Studies',
  'Computer Science',
  'Physics & Chemistry',
  'Biology & Medicine',
  'Psychology & Sociology',
  'Music & Performing Arts'
];

// Helper function to generate random study theme
const generateRandomTheme = () => {
  const randomIndex = Math.floor(Math.random() * STUDY_THEMES.length);
  return STUDY_THEMES[randomIndex];
};

// Helper function to create recurring meeting instances
const createRecurringMeetingInstances = async (client, groupId, startTime, durationMinutes, pattern, interval, daysOfWeek, endDate = null, maxInstances = 52) => {
  console.log('🔄 Creating recurring meeting instances:', {
    groupId,
    startTime: startTime.toISOString(),
    pattern,
    interval,
    daysOfWeek,
    endDate: endDate ? endDate.toISOString() : 'none',
    maxInstances
  });
  
  const instances = [];
  let currentDate = new Date(startTime);
  let count = 0;
  
  // Convert endDate to Date object if it's a string
  let endDateObj = null;
  if (endDate) {
    endDateObj = endDate instanceof Date ? endDate : new Date(endDate);
    // Set end date to end of day to include the last day
    endDateObj.setHours(23, 59, 59, 999);
  }
  
  while (count < maxInstances) {
    // Check if we've reached the end date
    if (endDateObj && currentDate > endDateObj) {
      console.log(`⏹️ Reached end date ${endDateObj.toISOString()}, stopping instance creation`);
      break;
    }
    
    const instanceEndTime = new Date(currentDate);
    instanceEndTime.setMinutes(instanceEndTime.getMinutes() + durationMinutes);
    
    console.log(`📅 Creating instance ${count + 1}:`, {
      date: currentDate.toISOString(),
      dayOfWeek: currentDate.getDay(),
      dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDate.getDay()],
      localDate: currentDate.toString(),
      isBeforeEndDate: endDateObj ? currentDate <= endDateObj : true
    });
    
    // Insert recurring meeting instance
    const instanceResult = await client.query(
      `INSERT INTO recurring_meetings (group_id, meeting_date) 
       VALUES ($1, $2) RETURNING id`,
      [groupId, currentDate]
    );
    
    instances.push({
      id: instanceResult.rows[0].id,
      meetingDate: currentDate,
      endTime: instanceEndTime
    });
    
    count++;
    
    // Calculate next occurrence
    switch (pattern.toLowerCase()) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + interval);
        break;
      case 'weekly':
        if (daysOfWeek && daysOfWeek.length > 0) {
          // Find next occurrence on specified days
          let found = false;
          for (let week = 1; week <= 8; week++) {
            for (const dayOfWeek of daysOfWeek) {
              const nextDate = new Date(currentDate);
              // If current day matches target day, move to next week
              if (nextDate.getDay() === dayOfWeek) {
                nextDate.setDate(nextDate.getDate() + 7 * interval);
                console.log(`⏭️ Current day matches target day ${dayOfWeek}, moving to next week:`, nextDate.toISOString());
              } else {
                // Calculate days to next occurrence of this day
                let daysToAdd = (dayOfWeek - nextDate.getDay() + 7) % 7;
                if (daysToAdd === 0) daysToAdd = 7; // Move to next week
                nextDate.setDate(nextDate.getDate() + daysToAdd);
                console.log(`📅 Moving to next occurrence of day ${dayOfWeek}, adding ${daysToAdd} days:`, nextDate.toISOString());
              }
              
              if (nextDate > currentDate) {
                currentDate = nextDate;
                found = true;
                console.log(`✅ Next occurrence set to:`, currentDate.toISOString());
                break;
              }
            }
            if (found) break;
          }
        } else {
          currentDate.setDate(currentDate.getDate() + (7 * interval));
        }
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + interval);
        break;
    }
  }
  
  console.log(`✅ Created ${instances.length} recurring meeting instances (stopped at end date: ${endDateObj ? endDateObj.toISOString() : 'none'})`);
  return instances;
};

// Create Study Group API
router.post('/create', authenticateToken, async (req, res) => {
  console.log('🚀 Create Study Group Request:', {
    userId: req.user.id,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  try {
    let { 
      title, 
      description, 
      maxParticipants = 10, 
      scheduledTime, 
      durationMinutes = 60,
      attendeeEmails = [], // Array of email addresses to invite
      isRecurring = false,
      recurrencePattern = 'weekly', // 'daily', 'weekly', 'monthly'
      recurrenceInterval = 1, // every 1 day/week/month
      recurrenceDaysOfWeek = [], // [1,3,5] for Monday, Wednesday, Friday
      recurrenceEndDate = null, // Optional end date for recurring meetings
      requiresApproval = true, // Whether the group requires approval to join
      useLiveKit = false, // Whether to use LiveKit instead of Google Meet
      videoProvider = 'google_meet' // 'google_meet' or 'livekit'
    } = req.body;
    
    const creatorId = req.user.id;

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Study group title is required'
      });
    }

    // Validate scheduledTime if provided
    if (scheduledTime !== undefined && scheduledTime !== null) {
      if (scheduledTime === '') {
        // Convert empty string to null - no Google Calendar event will be created
        scheduledTime = null;
      } else {
        // Validate that it's a valid date
        const date = new Date(scheduledTime);
        if (isNaN(date.getTime())) {
          return res.status(400).json({
            success: false,
            error: 'Invalid scheduled time format. Please use ISO 8601 format (e.g., 2025-09-03T20:00:00.000Z)'
          });
        }
      }
    }

    // Validate recurring meeting parameters if isRecurring is true
    if (isRecurring) {
      if (!scheduledTime) {
        return res.status(400).json({
          success: false,
          error: 'Scheduled time is required for recurring meetings'
        });
      }

      const validationErrors = validateRecurrenceParams(
        recurrencePattern, 
        recurrenceInterval, 
        recurrenceDaysOfWeek, 
        recurrenceEndDate
      );

      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid recurrence parameters',
          details: validationErrors
        });
      }

      // For weekly recurrence, require days of week
      if (recurrencePattern === 'weekly' && (!recurrenceDaysOfWeek || recurrenceDaysOfWeek.length === 0)) {
        return res.status(400).json({
          success: false,
          error: 'Weekly recurrence requires specifying days of the week'
        });
      }
    }

    // Check if user has Google Calendar access
    const userResult = await pool.query(
      'SELECT google_meet_access, google_access_token FROM users WHERE id = $1',
      [creatorId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userResult.rows[0];

    if (!user.google_access_token) {
      return res.status(403).json({
        success: false,
        error: 'Google Calendar access not granted. Please authenticate with Google first.'
      });
    }

    // Generate random theme
    const theme = generateRandomTheme();

    // Start database transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Calculate next occurrence for recurring meetings
      let nextOccurrence = scheduledTime;
      if (isRecurring && scheduledTime) {
        nextOccurrence = calculateNextOccurrence(
          new Date(scheduledTime),
          recurrencePattern,
          recurrenceInterval,
          recurrenceDaysOfWeek
        );
        console.log('🔄 Calculated next occurrence for recurring meeting:', {
          scheduledTime: scheduledTime,
          nextOccurrence: nextOccurrence,
          isRecurring: isRecurring
        });
      } else {
        console.log('📅 Using scheduled time as next occurrence for regular meeting:', {
          scheduledTime: scheduledTime,
          nextOccurrence: nextOccurrence,
          isRecurring: isRecurring
        });
      }

      // Get timezone from request header or default to UTC
      // We only store the timezone string, NOT converted times
      const timezoneHeader = req.headers['x-timezone'] || 'UTC';

      console.log('🕐 Time storage info:', {
        scheduledTime, // This is already in UTC (ISO string)
        nextOccurrence, // This is already in UTC
        recurrenceEndDate, // This is already in UTC (if provided)
        timezone: timezoneHeader, // We store this to know the creator's timezone
        note: 'Storing UTC times in DB, timezone for reference only'
      });

      // Generate LiveKit room name if using LiveKit
      let livekitRoomName = null;
      if (useLiveKit || videoProvider === 'livekit') {
        livekitRoomName = `study_group_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        console.log('🎥 Generated LiveKit room name:', { livekitRoomName });
      }

      // Create study group - store ONLY UTC times, timezone separately
      const groupResult = await client.query(
        `INSERT INTO study_groups (
          creator_id, title, description, theme, max_participants, 
          scheduled_time, duration_minutes, is_recurring, recurrence_pattern,
          recurrence_interval, recurrence_days_of_week, recurrence_end_date, 
          next_occurrence, requires_approval, timezone,
          use_livekit, video_provider, livekit_room_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) 
        RETURNING id, title, theme, created_at, is_recurring, next_occurrence, requires_approval, use_livekit, video_provider, livekit_room_name`,
        [
          creatorId, title, description, theme, maxParticipants, 
          scheduledTime, durationMinutes,
          isRecurring, recurrencePattern, recurrenceInterval, recurrenceDaysOfWeek, 
          recurrenceEndDate, nextOccurrence, 
          requiresApproval, timezoneHeader,
          useLiveKit || videoProvider === 'livekit', videoProvider, livekitRoomName
        ]
      );

      const group = groupResult.rows[0];

      // Create Google Calendar event if scheduled time is provided
      let meetData = null;
      console.log('📅 Scheduled time check:', {
        scheduledTime: scheduledTime,
        scheduledTimeType: typeof scheduledTime,
        willCreateEvent: !!scheduledTime
      });
      
      if (scheduledTime) {
        try {
          // Prepare event data
          const startTime = new Date(scheduledTime);
          const endTime = new Date(startTime);
          endTime.setMinutes(endTime.getMinutes() + durationMinutes);

          const attendees = attendeeEmails.map(email => ({ email }));
          
          const eventData = {
            title,
            description: description || `Study group: ${title}`,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            attendees,
            timeZone: 'UTC'
          };

          // Add recurrence if it's a recurring meeting
          if (isRecurring) {
            eventData.recurrence = [generateRecurrenceRule(
              recurrencePattern,
              recurrenceInterval,
              recurrenceDaysOfWeek,
              recurrenceEndDate
            )];
          }

          meetData = await createGoogleCalendarEvent(creatorId, eventData);

          console.log('📝 Storing Google Calendar event data:', {
            groupId: group.id,
            eventId: meetData.eventId,
            meetId: meetData.meetId,
            meetLink: meetData.meetLink
          });

          // Update group with meet information
          await client.query(
            `UPDATE study_groups 
             SET meet_link = $1, meet_id = $2 
             WHERE id = $3`,
            [meetData.meetLink, meetData.eventId, group.id]
          );

          group.meet_link = meetData.meetLink;
          group.meet_id = meetData.eventId;

          // Create recurring meeting instances if it's a recurring meeting
          if (isRecurring) {
            await createRecurringMeetingInstances(
              client,
              group.id,
              startTime,
              durationMinutes,
              recurrencePattern,
              recurrenceInterval,
              recurrenceDaysOfWeek,
              recurrenceEndDate
            );
          }
        } catch (meetError) {
          console.error('❌ Google Calendar event creation failed:', meetError.message);
          
          if (isRecurring) {
            // For recurring meetings, this is a critical failure - rollback
            await client.query('ROLLBACK');
            client.release();
            
            return res.status(500).json({
              success: false,
              error: 'Failed to create recurring study group',
              message: `Google Calendar integration failed: ${meetError.message}`,
              details: 'Recurring meetings require Google Calendar integration to work properly.'
            });
          } else {
            // For regular meetings, continue without meet link but log the error
            console.warn('⚠️ Continuing without Google Meet link for regular study group');
          }
        }
      }

      // Add creator as member with admin role
      await client.query(
        `INSERT INTO study_group_members (group_id, user_id, role) 
         VALUES ($1, $2, 'admin')`,
        [group.id, creatorId]
      );

      // Add invited users as members if they exist in the system
      if (attendeeEmails.length > 0) {
        for (const email of attendeeEmails) {
          try {
            // Check if user exists in the system
            const invitedUserResult = await client.query(
              'SELECT id FROM users WHERE email = $1',
              [email]
            );

            if (invitedUserResult.rows.length > 0) {
              const invitedUserId = invitedUserResult.rows[0].id;
              
              // Check if user is already a member (including inactive members)
              const existingMemberResult = await client.query(
                'SELECT id, is_active FROM study_group_members WHERE group_id = $1 AND user_id = $2',
                [group.id, invitedUserId]
              );

              if (existingMemberResult.rows.length > 0) {
                const existingMember = existingMemberResult.rows[0];
                
                if (existingMember.is_active) {
                  console.log('ℹ️ User already an active member:', email);
                } else {
                  // Reactivate the member
                  await client.query(
                    'UPDATE study_group_members SET is_active = true, joined_at = CURRENT_TIMESTAMP WHERE group_id = $1 AND user_id = $2',
                    [group.id, invitedUserId]
                  );
                  
                  console.log('✅ Reactivated existing member:', {
                    groupId: group.id,
                    userId: invitedUserId,
                    email: email
                  });
                }
              } else {
                // Add as new member
                await client.query(
                  `INSERT INTO study_group_members (group_id, user_id, role) 
                   VALUES ($1, $2, 'member')`,
                  [group.id, invitedUserId]
                );

                console.log('✅ Added new member to study group:', {
                  groupId: group.id,
                  userId: invitedUserId,
                  email: email
                });
              }
            } else {
              console.log('ℹ️ Invited user not found in system:', email);
            }
          } catch (error) {
            console.warn('⚠️ Failed to add invited user:', email, error.message);
          }
        }
      }

      await client.query('COMMIT');

      // Fetch the final group data from database to get updated meet information
      const finalGroupResult = await client.query(
        'SELECT * FROM study_groups WHERE id = $1',
        [group.id]
      );
      const finalGroup = finalGroupResult.rows[0];

      console.log('🔍 Database values comparison (regular group):', {
        scheduledTime: scheduledTime,
        nextOccurrence: nextOccurrence,
        dbScheduledTime: finalGroup.scheduled_time,
        dbNextOccurrence: finalGroup.next_occurrence,
        isRecurring: finalGroup.is_recurring
      });

      console.log('✅ Study group created successfully:', {
        groupId: finalGroup.id,
        creatorId: creatorId,
        title: finalGroup.title,
        theme: finalGroup.theme,
        hasMeetLink: !!finalGroup.meet_link,
        isRecurring: finalGroup.is_recurring,
        nextOccurrence: finalGroup.next_occurrence,
        attendeeCount: attendeeEmails.length,
        timestamp: new Date().toISOString()
      });

      // Use the timezoneHeader already declared above
      const displayScheduledTime = scheduledTime ? 
        new Date(scheduledTime).toLocaleString("en-US", {timeZone: timezoneHeader}) : null;
      const displayNextOccurrence = finalGroup.next_occurrence ? 
        new Date(finalGroup.next_occurrence).toLocaleString("en-US", {timeZone: timezoneHeader}) : null;

      res.json({
        success: true,
        message: 'Study group created successfully',
        data: {
          id: finalGroup.id,
          title: finalGroup.title,
          description: description,
          theme: theme,
          meetLink: finalGroup.meet_link,
          meetId: finalGroup.meet_id,
          maxParticipants: maxParticipants,
          scheduledTime: scheduledTime,
          scheduledTimeLocal: displayScheduledTime,
          scheduled_time_local: displayScheduledTime, // snake_case for frontend
          durationMinutes: durationMinutes,
          isRecurring: finalGroup.is_recurring,
          recurrencePattern: finalGroup.recurrence_pattern,
          recurrenceInterval: finalGroup.recurrence_interval,
          recurrenceDaysOfWeek: finalGroup.recurrence_days_of_week,
          recurrenceEndDate: finalGroup.recurrence_end_date,
          nextOccurrence: finalGroup.next_occurrence,
          nextOccurrenceLocal: displayNextOccurrence,
          next_occurrence_local: displayNextOccurrence, // snake_case for frontend
          requiresApproval: finalGroup.requires_approval,
          attendeeEmails: attendeeEmails,
          createdAt: finalGroup.created_at,
          timeZone: timezoneHeader,
          timezone: timezoneHeader, // snake_case for frontend
          useLiveKit: finalGroup.use_livekit,
          videoProvider: finalGroup.video_provider,
          livekitRoomName: finalGroup.livekit_room_name
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Create study group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create study group',
      message: error.message
    });
  }
});

// Create Recurring Study Group API (Simplified interface)
router.post('/create-recurring', authenticateToken, async (req, res) => {
  console.log('🔄 Create Recurring Study Group Request:', {
    userId: req.user.id,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  try {
    const { 
      title, 
      description, 
      maxParticipants = 10, 
      startTime, // First meeting time
      durationMinutes = 60,
      attendeeEmails = [],
      useLiveKit = false, // Whether to use LiveKit instead of Google Meet
      videoProvider = 'google_meet', // 'google_meet' or 'livekit'
      frequency = 'weekly', // 'daily', 'weekly', 'monthly'
      interval = 1, // every 1 day/week/month
      daysOfWeek = [], // [1,3,5] for Monday, Wednesday, Friday (0=Sunday, 1=Monday, etc.)
      endDate = null, // Optional end date
      timeZone = null // Will be auto-detected if not provided
    } = req.body;
    
    const creatorId = req.user.id;

    // Validate required fields
    if (!title || !startTime) {
      return res.status(400).json({
        success: false,
        error: 'Title and start time are required'
      });
    }

    // Validate startTime format
    if (startTime === '') {
      return res.status(400).json({
        success: false,
        error: 'Start time cannot be empty'
      });
    }

    // Validate frequency
    if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
      return res.status(400).json({
        success: false,
        error: 'Frequency must be daily, weekly, or monthly'
      });
    }

    // For weekly frequency, require days of week
    if (frequency === 'weekly' && (!daysOfWeek || daysOfWeek.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Weekly frequency requires specifying days of the week (0=Sunday, 1=Monday, etc.)'
      });
    }

    // Validate days of week (0-6)
    if (daysOfWeek.length > 0) {
      for (const day of daysOfWeek) {
        if (day < 0 || day > 6) {
          return res.status(400).json({
            success: false,
            error: 'Days of week must be 0-6 (0=Sunday, 1=Monday, etc.)'
          });
        }
      }
    }

    // Validate endDate if provided
    if (endDate) {
      const endDateObj = new Date(endDate);
      if (isNaN(endDateObj.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid end date format. Please use YYYY-MM-DD format.'
        });
      }
      
      if (endDateObj <= new Date()) {
        return res.status(400).json({
          success: false,
          error: 'End date must be in the future.'
        });
      }
    }

    // Auto-detect timezone if not provided
    let detectedTimeZone = timeZone;
    if (!detectedTimeZone) {
      // Try to detect timezone from request headers
      const timezoneHeader = req.headers['x-timezone'] || req.headers['timezone'];
      if (timezoneHeader) {
        detectedTimeZone = timezoneHeader;
        console.log('🌍 Timezone detected from headers:', detectedTimeZone);
      } else {
        // Fallback to UTC
        detectedTimeZone = 'UTC';
        console.log('🌍 No timezone provided, using UTC as fallback');
      }
    }

    // Validate and normalize startTime
    let normalizedStartTime = startTime;
    if (typeof startTime === 'string') {
      const startDate = new Date(startTime);
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid start time format. Please use ISO 8601 format (e.g., 2025-08-27T22:00:00.000Z)'
        });
      }
      
      // Normalize to ensure consistent timezone handling
      normalizedStartTime = startDate.toISOString();
      
      // Calculate local time for display purposes
      const localTime = new Date(startDate.toLocaleString("en-US", {timeZone: detectedTimeZone}));
      
      console.log('📅 Date validation:', {
        originalStartTime: startTime,
        normalizedStartTime: normalizedStartTime,
        parsedDate: startDate.toString(),
        localTimeInTimezone: localTime.toISOString(),
        dayOfWeek: startDate.getDay(),
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][startDate.getDay()],
        detectedTimeZone: detectedTimeZone,
        userAgent: req.headers['user-agent'],
        timezoneOffset: startDate.getTimezoneOffset(),
        utcHours: startDate.getUTCHours(),
        localHours: localTime.getHours()
      });
    }

    // Check if user has Google Calendar access
    const userResult = await pool.query(
      'SELECT google_meet_access, google_access_token FROM users WHERE id = $1',
      [creatorId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userResult.rows[0];

    if (!user.google_access_token) {
      return res.status(403).json({
        success: false,
        error: 'Google Calendar access not granted. Please authenticate with Google first.'
      });
    }

    // Generate random theme
    const theme = generateRandomTheme();

    // Start database transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Calculate next occurrence
      const nextOccurrence = calculateNextOccurrence(
        new Date(normalizedStartTime),
        frequency,
        interval,
        daysOfWeek
      );

      // Get timezone from request header or default to UTC
      // We only store the timezone string, NOT converted times
      const timezoneHeader = req.headers['x-timezone'] || 'UTC';

      console.log('🕐 Time storage info (recurring group):', {
        normalizedStartTime, // Already in UTC (ISO string)
        nextOccurrence, // Already in UTC
        endDate, // Already in UTC (if provided)
        timezone: timezoneHeader, // Store for reference only
        note: 'Storing UTC times in DB, timezone for reference only'
      });

      // Generate LiveKit room name if using LiveKit
      let livekitRoomName = null;
      if (useLiveKit || videoProvider === 'livekit') {
        livekitRoomName = `study_group_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        console.log('🎥 Generated LiveKit room name (recurring):', { livekitRoomName });
      }

      // Create study group - store ONLY UTC times, timezone separately
      const groupResult = await client.query(
        `INSERT INTO study_groups (
          creator_id, title, description, theme, max_participants, 
          scheduled_time, duration_minutes, is_recurring, recurrence_pattern,
          recurrence_interval, recurrence_days_of_week, recurrence_end_date, 
          next_occurrence, timezone,
          use_livekit, video_provider, livekit_room_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) 
        RETURNING id, title, theme, created_at, is_recurring, next_occurrence, use_livekit, video_provider, livekit_room_name`,
        [
          creatorId, title, description, theme, maxParticipants, 
          normalizedStartTime, durationMinutes,
          true, frequency, interval, daysOfWeek, 
          endDate, nextOccurrence, 
          timezoneHeader,
          useLiveKit || videoProvider === 'livekit', videoProvider, livekitRoomName
        ]
      );

      const group = groupResult.rows[0];

      // Create Google Calendar event with recurrence (MANDATORY for recurring meetings)
      let meetData = null;
      try {
        const startDateTime = new Date(normalizedStartTime);
        const endDateTime = new Date(startDateTime);
        endDateTime.setMinutes(endDateTime.getMinutes() + durationMinutes);

        const attendees = attendeeEmails.map(email => ({ email }));
        
        // Fix endDate handling - convert to Date object if it's a string
        let processedEndDate = null;
        if (endDate) {
          processedEndDate = typeof endDate === 'string' ? new Date(endDate) : endDate;
        }
        
        const eventData = {
          title,
          description: description || `Recurring Study Group: ${title}`,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          attendees,
          timeZone: detectedTimeZone,
          recurrence: [generateRecurrenceRule(frequency, interval, daysOfWeek, processedEndDate)]
        };

        console.log('📅 Creating Google Calendar event for recurring meeting:', {
          title: eventData.title,
          startTime: eventData.startTime,
          endTime: eventData.endTime,
          frequency: frequency,
          interval: interval,
          daysOfWeek: daysOfWeek,
          endDate: processedEndDate,
          timeZone: detectedTimeZone
        });

        meetData = await createGoogleCalendarEvent(creatorId, eventData);

        console.log('📝 Storing Google Calendar event data (recurring):', {
          groupId: group.id,
          eventId: meetData.eventId,
          meetId: meetData.meetId,
          meetLink: meetData.meetLink
        });

        // Update group with meet information
        await client.query(
          `UPDATE study_groups 
           SET meet_link = $1, meet_id = $2 
           WHERE id = $3`,
          [meetData.meetLink, meetData.eventId, group.id]
        );

        group.meet_link = meetData.meetLink;
        group.meet_id = meetData.eventId;

        // Create recurring meeting instances
        await createRecurringMeetingInstances(
          client,
          group.id,
          startDateTime,
          durationMinutes,
          frequency,
          interval,
          daysOfWeek,
          processedEndDate
        );

        console.log('✅ Google Calendar event and recurring meeting instances created successfully');

      } catch (meetError) {
        console.error('❌ Google Calendar event creation failed:', meetError.message);
        // ROLLBACK the entire transaction - recurring meetings require Google Calendar integration
        await client.query('ROLLBACK');
        client.release();
        
        return res.status(500).json({
          success: false,
          error: 'Failed to create recurring study group',
          message: `Google Calendar integration failed: ${meetError.message}`,
          details: 'Recurring meetings require Google Calendar integration to work properly. Please ensure your Google account has proper permissions.'
        });
      }

      // Add creator as member with admin role
      await client.query(
        `INSERT INTO study_group_members (group_id, user_id, role) 
         VALUES ($1, $2, 'admin')`,
        [group.id, creatorId]
      );

      // Add invited users as members
      if (attendeeEmails.length > 0) {
        for (const email of attendeeEmails) {
          try {
            const invitedUserResult = await client.query(
              'SELECT id FROM users WHERE email = $1',
              [email]
            );

            if (invitedUserResult.rows.length > 0) {
              const invitedUserId = invitedUserResult.rows[0].id;
              
              // Check if user is already a member (including inactive members)
              const existingMemberResult = await client.query(
                'SELECT id, is_active FROM study_group_members WHERE group_id = $1 AND user_id = $2',
                [group.id, invitedUserId]
              );

              if (existingMemberResult.rows.length > 0) {
                const existingMember = existingMemberResult.rows[0];
                
                if (existingMember.is_active) {
                  console.log('ℹ️ User already an active member:', email);
                } else {
                  // Reactivate the member
                  await client.query(
                    'UPDATE study_group_members SET is_active = true, joined_at = CURRENT_TIMESTAMP WHERE group_id = $1 AND user_id = $2',
                    [group.id, invitedUserId]
                  );
                  
                  console.log('✅ Reactivated existing member in recurring study group:', {
                    groupId: group.id,
                    userId: invitedUserId,
                    email: email
                  });
                }
              } else {
                // Add as new member
                await client.query(
                  `INSERT INTO study_group_members (group_id, user_id, role) 
                   VALUES ($1, $2, 'member')`,
                  [group.id, invitedUserId]
                );

                console.log('✅ Added new member to recurring study group:', {
                  groupId: group.id,
                  userId: invitedUserId,
                  email: email
                });
              }
            } else {
              console.log('ℹ️ Invited user not found in system:', email);
            }
          } catch (error) {
            console.warn('⚠️ Failed to add invited user:', email, error.message);
          }
        }
      }

      await client.query('COMMIT');

      // Fetch the final group data from database to get updated meet information
      const finalGroupResult = await client.query(
        'SELECT * FROM study_groups WHERE id = $1',
        [group.id]
      );
      const finalGroup = finalGroupResult.rows[0];

      console.log('✅ Recurring study group created successfully:', {
        groupId: finalGroup.id,
        creatorId: creatorId,
        title: finalGroup.title,
        frequency: frequency,
        interval: interval,
        daysOfWeek: daysOfWeek,
        nextOccurrence: finalGroup.next_occurrence,
        attendeeCount: attendeeEmails.length,
        hasMeetLink: !!finalGroup.meet_link,
        timestamp: new Date().toISOString()
      });

      // Convert times to user's timezone for display
      const displayStartTime = new Date(normalizedStartTime).toLocaleString("en-US", {timeZone: detectedTimeZone});
      const displayNextOccurrence = finalGroup.next_occurrence ? 
        new Date(finalGroup.next_occurrence).toLocaleString("en-US", {timeZone: detectedTimeZone}) : null;

      res.json({
        success: true,
        message: 'Recurring study group created successfully',
        data: {
          id: finalGroup.id,
          title: finalGroup.title,
          description: description,
          theme: finalGroup.theme,
          meetLink: finalGroup.meet_link,
          meetId: finalGroup.meet_id,
          maxParticipants: maxParticipants,
          startTime: normalizedStartTime,
          startTimeLocal: displayStartTime,
          scheduled_time_local: displayStartTime, // snake_case for frontend
          originalStartTime: startTime,
          durationMinutes: durationMinutes,
          frequency: frequency,
          interval: interval,
          daysOfWeek: daysOfWeek,
          endDate: endDate,
          timeZone: detectedTimeZone,
          timezone: detectedTimeZone, // snake_case for frontend
          nextOccurrence: finalGroup.next_occurrence,
          nextOccurrenceLocal: displayNextOccurrence,
          next_occurrence_local: displayNextOccurrence, // snake_case for frontend
          attendeeEmails: attendeeEmails,
          createdAt: finalGroup.created_at
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Create recurring study group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create recurring study group',
      message: error.message
    });
  }
});

// Get Public Study Groups API (browse all available groups)
router.get('/public', authenticateToken, async (req, res) => {
  console.log('🌐 Get Public Study Groups Request:', {
    userId: req.user.id,
    query: req.query,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;
    const { 
      limit = 20, 
      offset = 0, 
      search = null,
      theme = null,
      requiresApproval = null, // 'true', 'false', or null for all
      date = null // Filter by specific date (YYYY-MM-DD format)
    } = req.query;

    // Build the base query for public groups
    let baseQuery = `
      SELECT 
        sg.id, sg.title, sg.description, sg.theme, sg.meet_link, sg.meet_id,
        sg.max_participants, sg.scheduled_time, sg.duration_minutes,
        sg.is_recurring, sg.recurrence_pattern, sg.recurrence_interval,
        sg.recurrence_days_of_week, sg.recurrence_end_date, 
        sg.next_occurrence, sg.timezone,
        sg.requires_approval, sg.created_at, sg.updated_at, sg.is_active,
        u.name as creator_name, u.email as creator_email,
        (SELECT COUNT(*) FROM study_group_members sgm_count WHERE sgm_count.group_id = sg.id AND sgm_count.is_active = true) as current_members,
        (SELECT sgm_user.role FROM study_group_members sgm_user WHERE sgm_user.group_id = sg.id AND sgm_user.user_id = $1 AND sgm_user.is_active = true) as user_role,
        (SELECT sgm_user.joined_at FROM study_group_members sgm_user WHERE sgm_user.group_id = sg.id AND sgm_user.user_id = $1 AND sgm_user.is_active = true) as user_joined_at,
        (SELECT sjr_user.status FROM study_group_join_requests sjr_user WHERE sjr_user.group_id = sg.id AND sjr_user.user_id = $1) as user_join_request_status,
        (SELECT sjr_user.requested_at FROM study_group_join_requests sjr_user WHERE sjr_user.group_id = sg.id AND sjr_user.user_id = $1) as user_join_requested_at
      FROM study_groups sg
      LEFT JOIN users u ON sg.creator_id = u.id
      WHERE sg.is_active = true
    `;

    const queryParams = [userId];
    let paramCount = 1;

    // Add search filter
    if (search) {
      paramCount++;
      baseQuery += ` AND (sg.title ILIKE $${paramCount} OR sg.description ILIKE $${paramCount} OR sg.theme ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    // Add theme filter
    if (theme) {
      paramCount++;
      baseQuery += ` AND sg.theme = $${paramCount}`;
      queryParams.push(theme);
    }

    // Add requires approval filter
    if (requiresApproval !== null) {
      paramCount++;
      baseQuery += ` AND sg.requires_approval = $${paramCount}`;
      queryParams.push(requiresApproval === 'true');
    }

    // Add date filter
    if (date) {
      paramCount++;
      // Filter groups scheduled on the specific date
      baseQuery += ` AND DATE(sg.scheduled_time) = $${paramCount}`;
      queryParams.push(date);
    }

    // Add ordering
    baseQuery += `
      ORDER BY sg.created_at DESC
    `;

    // Add pagination
    paramCount++;
    baseQuery += ` LIMIT $${paramCount}`;
    queryParams.push(parseInt(limit));

    paramCount++;
    baseQuery += ` OFFSET $${paramCount}`;
    queryParams.push(parseInt(offset));

    console.log('🔍 Executing public groups query:', {
      query: baseQuery,
      params: queryParams,
      filters: { search, theme, requiresApproval, date, limit, offset }
    });

    const groupsResult = await pool.query(baseQuery, queryParams);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(DISTINCT sg.id) as total
      FROM study_groups sg
      WHERE sg.is_active = true
    `;
    
    const countParams = [];
    let countParamCount = 0;

    if (search) {
      countParamCount++;
      countQuery += ` AND (sg.title ILIKE $${countParamCount} OR sg.description ILIKE $${countParamCount} OR sg.theme ILIKE $${countParamCount})`;
      countParams.push(`%${search}%`);
    }

    if (theme) {
      countParamCount++;
      countQuery += ` AND sg.theme = $${countParamCount}`;
      countParams.push(theme);
    }

    if (requiresApproval !== null) {
      countParamCount++;
      countQuery += ` AND sg.requires_approval = $${countParamCount}`;
      countParams.push(requiresApproval === 'true');
    }

    if (date) {
      countParamCount++;
      countQuery += ` AND DATE(sg.scheduled_time) = $${countParamCount}`;
      countParams.push(date);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].total);

    // Process results to add user status and member details
    const processedGroups = await Promise.all(groupsResult.rows.map(async (group) => {
      // Get detailed member information for each group
      const membersResult = await pool.query(
        `SELECT 
          u.id, u.name, u.email, u.picture,
          sgm.role, sgm.joined_at
         FROM study_group_members sgm
         INNER JOIN users u ON sgm.user_id = u.id
         WHERE sgm.group_id = $1 AND sgm.is_active = true
         ORDER BY sgm.joined_at ASC`,
        [group.id]
      );

      // Helper function to format time in the CREATOR'S timezone
      const formatTimeInCreatorTimezone = (utcTime, creatorTimezone) => {
        if (!utcTime) return null;
        if (!creatorTimezone) creatorTimezone = 'UTC';
        
        return new Date(utcTime).toLocaleString("en-US", {
          timeZone: creatorTimezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      };

      return {
        ...group,
        // Show time in creator's timezone (everyone sees the same time)
        scheduledTimeLocal: formatTimeInCreatorTimezone(group.scheduled_time, group.timezone),
        nextOccurrenceLocal: formatTimeInCreatorTimezone(group.next_occurrence, group.timezone),
        recurrenceEndDateLocal: formatTimeInCreatorTimezone(group.recurrence_end_date, group.timezone),
        createdAtLocal: formatTimeInCreatorTimezone(group.created_at, group.timezone),
        // Include timezone info (creator's timezone)
        timezone: group.timezone || 'UTC',
        members: membersResult.rows,
        userStatus: {
          isMember: !!group.user_role,
          role: group.user_role,
          joinedAt: group.user_joined_at,
          hasJoinRequest: !!group.user_join_request_status,
          joinRequestStatus: group.user_join_request_status,
          joinRequestedAt: group.user_join_requested_at
        }
      };
    }));

    // Log simplified timezone display for first group (for debugging)
    if (processedGroups.length > 0) {
      const firstGroup = processedGroups[0];
      console.log('🕐 SIMPLIFIED TIMEZONE DISPLAY (First Public Group):', {
        groupId: firstGroup.id,
        title: firstGroup.title,
        displayedToEveryone: {
          scheduledTimeLocal: firstGroup.scheduledTimeLocal,
          timezone: firstGroup.timezone
        },
        note: `Everyone sees: ${firstGroup.scheduledTimeLocal} (${firstGroup.timezone})`
      });
    }

    console.log('✅ Public study groups retrieved successfully:', {
      userId: userId,
      groupCount: processedGroups.length,
      totalCount: totalCount,
      filters: { search, theme, requiresApproval, date },
      pagination: { limit, offset },
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        groups: processedGroups,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
        },
        filters: {
          search,
          theme,
          requiresApproval,
          date
        }
      }
    });

  } catch (error) {
    console.error('❌ Get public study groups error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve public study groups',
      message: error.message
    });
  }
});

// Get All Study Groups API (for user - only groups they're member/owner of)
router.get('/', authenticateToken, async (req, res) => {
  console.log('📚 Get All Study Groups Request:', {
    userId: req.user.id,
    query: req.query,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;
    const { 
      limit = 50, 
      offset = 0, 
      status = 'active', // 'active', 'inactive', 'all'
      role = 'all', // 'admin', 'member', 'all'
      search = null 
    } = req.query;

    // Build the base query
    let baseQuery = `
      SELECT 
        sg.id, sg.title, sg.description, sg.theme, sg.meet_link, sg.meet_id,
        sg.max_participants, sg.scheduled_time, sg.duration_minutes,
        sg.is_recurring, sg.recurrence_pattern, sg.recurrence_interval,
        sg.recurrence_days_of_week, sg.recurrence_end_date, 
        sg.next_occurrence, sg.timezone,
        sg.created_at, sg.updated_at, sg.is_active,
        sgm.role as user_role, sgm.joined_at,
        u.name as creator_name, u.email as creator_email,
        COUNT(sgm2.user_id) as current_members
      FROM study_groups sg
      INNER JOIN study_group_members sgm ON sg.id = sgm.group_id
      LEFT JOIN users u ON sg.creator_id = u.id
      LEFT JOIN study_group_members sgm2 ON sg.id = sgm2.group_id AND sgm2.is_active = true
      WHERE sgm.user_id = $1 AND sgm.is_active = true
    `;

    const queryParams = [userId];
    let paramCount = 1;

    // Add status filter
    if (status === 'active') {
      baseQuery += ` AND sg.is_active = true`;
    } else if (status === 'inactive') {
      baseQuery += ` AND sg.is_active = false`;
    }
    // 'all' doesn't add any filter

    // Add role filter
    if (role === 'admin') {
      baseQuery += ` AND sgm.role = 'admin'`;
    } else if (role === 'member') {
      baseQuery += ` AND sgm.role = 'member'`;
    }
    // 'all' doesn't add any filter

    // Add search filter
    if (search) {
      paramCount++;
      baseQuery += ` AND (sg.title ILIKE $${paramCount} OR sg.description ILIKE $${paramCount} OR sg.theme ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    // Add grouping and ordering
    baseQuery += `
      GROUP BY sg.id, sgm.role, sgm.joined_at, u.name, u.email
      ORDER BY sg.created_at DESC
    `;

    // Add pagination
    paramCount++;
    baseQuery += ` LIMIT $${paramCount}`;
    queryParams.push(parseInt(limit));

    paramCount++;
    baseQuery += ` OFFSET $${paramCount}`;
    queryParams.push(parseInt(offset));

    console.log('🔍 Executing query:', {
      query: baseQuery,
      params: queryParams,
      filters: { status, role, search, limit, offset }
    });

    const groupsResult = await pool.query(baseQuery, queryParams);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(DISTINCT sg.id) as total
      FROM study_groups sg
      INNER JOIN study_group_members sgm ON sg.id = sgm.group_id
      WHERE sgm.user_id = $1 AND sgm.is_active = true
    `;
    
    const countParams = [userId];
    let countParamCount = 1;

    if (status === 'active') {
      countQuery += ` AND sg.is_active = true`;
    } else if (status === 'inactive') {
      countQuery += ` AND sg.is_active = false`;
    }

    if (role === 'admin') {
      countQuery += ` AND sgm.role = 'admin'`;
    } else if (role === 'member') {
      countQuery += ` AND sgm.role = 'member'`;
    }

    if (search) {
      countParamCount++;
      countQuery += ` AND (sg.title ILIKE $${countParamCount} OR sg.description ILIKE $${countParamCount} OR sg.theme ILIKE $${countParamCount})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].total);

    // Helper function to format time in the CREATOR'S timezone (not viewer's)
    // This shows time in the timezone where the meeting was created
    const formatTimeInCreatorTimezone = (utcTime, creatorTimezone) => {
      if (!utcTime) return null;
      if (!creatorTimezone) creatorTimezone = 'UTC';
      
      return new Date(utcTime).toLocaleString("en-US", {
        timeZone: creatorTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    };
    
    // Convert times to CREATOR'S timezone for display
    // Everyone sees the same time with timezone label (e.g., "3pm Eastern Time")
    const processedGroups = groupsResult.rows.map(group => ({
      ...group,
      // Show time in creator's timezone (not viewer's)
      scheduledTimeLocal: formatTimeInCreatorTimezone(group.scheduled_time, group.timezone),
      nextOccurrenceLocal: formatTimeInCreatorTimezone(group.next_occurrence, group.timezone),
      recurrenceEndDateLocal: formatTimeInCreatorTimezone(group.recurrence_end_date, group.timezone),
      createdAtLocal: formatTimeInCreatorTimezone(group.created_at, group.timezone),
      // Include timezone info (this is the creator's timezone)
      timezone: group.timezone || 'UTC'
    }));

    // Log timezone display info for first group (for debugging)
    if (processedGroups.length > 0) {
      const firstGroup = processedGroups[0];
      console.log('🕐 SIMPLIFIED TIMEZONE DISPLAY (First Group):', {
        groupId: firstGroup.id,
        title: firstGroup.title,
        storedInDB: {
          scheduled_time_utc: firstGroup.scheduled_time,
          creator_timezone: firstGroup.timezone
        },
        displayedToEveryone: {
          scheduledTimeLocal: firstGroup.scheduledTimeLocal,
          timezone: firstGroup.timezone
        },
        note: `Everyone sees: ${firstGroup.scheduledTimeLocal} (${firstGroup.timezone})`
      });
    }

    console.log('✅ Study groups retrieved successfully:', {
      userId: userId,
      groupCount: groupsResult.rows.length,
      totalCount: totalCount,
      filters: { status, role, search },
      pagination: { limit, offset },
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        groups: processedGroups,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
        },
        filters: {
          status,
          role,
          search
        }
      }
    });

  } catch (error) {
    console.error('❌ Get study groups error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve study groups',
      message: error.message
    });
  }
});

// Get My Study Groups API (simplified version - kept for backward compatibility)
router.get('/my-groups', authenticateToken, async (req, res) => {
  console.log('📚 Get My Study Groups Request:', {
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;

    // Get groups where user is a member
    const groupsResult = await pool.query(
      `SELECT 
        sg.id, sg.title, sg.description, sg.theme, sg.meet_link, 
        sg.max_participants, sg.scheduled_time, sg.duration_minutes,
        sg.created_at, sg.is_active,
        sgm.role,
        COUNT(sgm2.user_id) as current_members
       FROM study_groups sg
       INNER JOIN study_group_members sgm ON sg.id = sgm.group_id
       LEFT JOIN study_group_members sgm2 ON sg.id = sgm2.group_id AND sgm2.is_active = true
       WHERE sgm.user_id = $1 AND sg.is_active = true
       GROUP BY sg.id, sgm.role
       ORDER BY sg.created_at DESC`,
      [userId]
    );

    console.log('✅ Study groups retrieved successfully:', {
      userId: userId,
      groupCount: groupsResult.rows.length,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        groups: groupsResult.rows,
        totalGroups: groupsResult.rows.length
      }
    });

  } catch (error) {
    console.error('❌ Get study groups error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve study groups',
      message: error.message
    });
  }
});

// Get Owned Study Groups API
router.get('/owned', authenticateToken, async (req, res) => {
  console.log('👑 Get Owned Study Groups Request:', {
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;

    // Get groups owned by the user
    const groupsResult = await pool.query(
      `SELECT 
        sg.*, u.name as creator_name, u.email as creator_email,
        COUNT(sgm.user_id) as member_count
       FROM study_groups sg
       INNER JOIN users u ON sg.creator_id = u.id
       LEFT JOIN study_group_members sgm ON sg.id = sgm.group_id AND sgm.is_active = true
       WHERE sg.creator_id = $1 AND sg.is_active = true
       GROUP BY sg.id, u.name, u.email
       ORDER BY sg.created_at DESC`,
      [userId]
    );

    console.log('✅ Owned study groups retrieved successfully:', {
      userId: userId,
      groupCount: groupsResult.rows.length,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        groups: groupsResult.rows
      }
    });

  } catch (error) {
    console.error('❌ Get owned study groups error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve owned study groups',
      message: error.message
    });
  }
});

// Get My Join Requests API (for users to see their own requests)
router.get('/my-join-requests', authenticateToken, async (req, res) => {
  console.log('📋 Get My Join Requests Request:', {
    userId: req.user.id,
    query: req.query,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;
    const { status = 'all', limit = 20, offset = 0 } = req.query;

    // Get user's join requests
    let query = `
      SELECT 
        sjr.id, sjr.group_id, sjr.message, sjr.status, sjr.requested_at, sjr.responded_at,
        sg.title as group_title, sg.description as group_description, sg.theme,
        sg.max_participants, sg.scheduled_time, sg.duration_minutes,
        u.name as group_creator_name, u.email as group_creator_email
      FROM study_group_join_requests sjr
      INNER JOIN study_groups sg ON sjr.group_id = sg.id
      INNER JOIN users u ON sg.creator_id = u.id
      WHERE sjr.user_id = $1
    `;
    
    const queryParams = [userId];
    let paramCount = 1;

    if (status !== 'all') {
      paramCount++;
      query += ` AND sjr.status = $${paramCount}`;
      queryParams.push(status);
    }

    query += ` ORDER BY sjr.requested_at DESC`;

    // Add pagination
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    queryParams.push(parseInt(limit));

    paramCount++;
    query += ` OFFSET $${paramCount}`;
    queryParams.push(parseInt(offset));

    const requestsResult = await pool.query(query, queryParams);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM study_group_join_requests sjr
      WHERE sjr.user_id = $1
    `;
    
    const countParams = [userId];
    let countParamCount = 1;

    if (status !== 'all') {
      countParamCount++;
      countQuery += ` AND sjr.status = $${countParamCount}`;
      countParams.push(status);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].total);

    console.log('✅ My join requests retrieved successfully:', {
      userId: userId,
      requestCount: requestsResult.rows.length,
      totalCount: totalCount,
      status: status,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        requests: requestsResult.rows,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
        },
        filters: {
          status
        }
      }
    });

  } catch (error) {
    console.error('❌ Get my join requests error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve join requests',
      message: error.message
    });
  }
});

// Get Study Group Details API (Public - shows group info to everyone)
router.get('/:groupId', authenticateToken, async (req, res) => {
  console.log('🔍 Get Study Group Details Request:', {
    userId: req.user.id,
    groupId: req.params.groupId,
    timestamp: new Date().toISOString()
  });

  try {
    // Validate that groupId is a valid integer
    const groupIdParam = req.params.groupId;
    if (!groupIdParam || isNaN(parseInt(groupIdParam))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid group ID. Group ID must be a valid number.'
      });
    }

    const groupId = parseInt(groupIdParam);
    const userId = req.user.id;

    // Get group details
    const groupResult = await pool.query(
      `SELECT 
        sg.*, u.name as creator_name, u.email as creator_email
       FROM study_groups sg
       INNER JOIN users u ON sg.creator_id = u.id
       WHERE sg.id = $1 AND sg.is_active = true`,
      [groupId]
    );

    if (groupResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Study group not found or inactive'
      });
    }

    const group = groupResult.rows[0];

    // Check if user is member of this group
    const membershipResult = await pool.query(
      'SELECT role, joined_at FROM study_group_members WHERE group_id = $1 AND user_id = $2 AND is_active = true',
      [groupId, userId]
    );

    const userMembership = membershipResult.rows.length > 0 ? membershipResult.rows[0] : null;

    // Check if user has a pending join request
    const joinRequestResult = await pool.query(
      'SELECT id, status, message, requested_at FROM study_group_join_requests WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );

    const userJoinRequest = joinRequestResult.rows.length > 0 ? joinRequestResult.rows[0] : null;

    // Get group members (only if user is a member or if group allows public viewing)
    let membersResult = { rows: [] };
    if (userMembership) {
      membersResult = await pool.query(
        `SELECT 
          u.id, u.name, u.email, u.picture,
          sgm.role, sgm.joined_at
         FROM study_group_members sgm
         INNER JOIN users u ON sgm.user_id = u.id
         WHERE sgm.group_id = $1 AND sgm.is_active = true
         ORDER BY sgm.joined_at ASC`,
        [groupId]
      );
    }

    // Get member count (always available)
    const memberCountResult = await pool.query(
      'SELECT COUNT(*) as count FROM study_group_members WHERE group_id = $1 AND is_active = true',
      [groupId]
    );

    const memberCount = parseInt(memberCountResult.rows[0].count);

    console.log('✅ Study group details retrieved successfully:', {
      groupId: groupId,
      title: group.title,
      memberCount: memberCount,
      userIsMember: !!userMembership,
      userHasRequest: !!userJoinRequest,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        group: {
          id: group.id,
          title: group.title,
          description: group.description,
          theme: group.theme,
          meetLink: group.meet_link,
          meetId: group.meet_id,
          maxParticipants: group.max_participants,
          scheduledTime: group.scheduled_time,
          durationMinutes: group.duration_minutes,
          isActive: group.is_active,
          requiresApproval: group.requires_approval,
          isRecurring: group.is_recurring,
          recurrencePattern: group.recurrence_pattern,
          recurrenceInterval: group.recurrence_interval,
          recurrenceDaysOfWeek: group.recurrence_days_of_week,
          recurrenceEndDate: group.recurrence_end_date,
          nextOccurrence: group.next_occurrence,
          createdAt: group.created_at,
          creator: {
            id: group.creator_id,
            name: group.creator_name,
            email: group.creator_email
          }
        },
        members: membersResult.rows,
        totalMembers: memberCount,
        userStatus: {
          isMember: !!userMembership,
          role: userMembership?.role || null,
          joinedAt: userMembership?.joined_at || null,
          hasJoinRequest: !!userJoinRequest,
          joinRequestStatus: userJoinRequest?.status || null,
          joinRequestMessage: userJoinRequest?.message || null,
          joinRequestedAt: userJoinRequest?.requested_at || null
        }
      }
    });

  } catch (error) {
    console.error('❌ Get study group details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve study group details',
      message: error.message
    });
  }
});

// Get Study Group Details API (Private - for members only, shows full details)
router.get('/:groupId/member-details', authenticateToken, async (req, res) => {
  console.log('🔍 Get Study Group Member Details Request:', {
    userId: req.user.id,
    groupId: req.params.groupId,
    timestamp: new Date().toISOString()
  });

  try {
    const groupId = parseInt(req.params.groupId);
    const userId = req.user.id;

    // Check if user is member of this group
    const membershipResult = await pool.query(
      'SELECT role FROM study_group_members WHERE group_id = $1 AND user_id = $2 AND is_active = true',
      [groupId, userId]
    );

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You are not a member of this study group.'
      });
    }

    // Get group details
    const groupResult = await pool.query(
      `SELECT 
        sg.*, u.name as creator_name, u.email as creator_email
       FROM study_groups sg
       INNER JOIN users u ON sg.creator_id = u.id
       WHERE sg.id = $1`,
      [groupId]
    );

    if (groupResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Study group not found'
      });
    }

    const group = groupResult.rows[0];

    // Get group members
    const membersResult = await pool.query(
      `SELECT 
        u.id, u.name, u.email, u.picture,
        sgm.role, sgm.joined_at
       FROM study_group_members sgm
       INNER JOIN users u ON sgm.user_id = u.id
       WHERE sgm.group_id = $1 AND sgm.is_active = true
       ORDER BY sgm.joined_at ASC`,
      [groupId]
    );

    console.log('✅ Study group member details retrieved successfully:', {
      groupId: groupId,
      title: group.title,
      memberCount: membersResult.rows.length,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        group: {
          id: group.id,
          title: group.title,
          description: group.description,
          theme: group.theme,
          meetLink: group.meet_link,
          meetId: group.meet_id,
          maxParticipants: group.max_participants,
          scheduledTime: group.scheduled_time,
          durationMinutes: group.duration_minutes,
          isActive: group.is_active,
          requiresApproval: group.requires_approval,
          isRecurring: group.is_recurring,
          recurrencePattern: group.recurrence_pattern,
          recurrenceInterval: group.recurrence_interval,
          recurrenceDaysOfWeek: group.recurrence_days_of_week,
          recurrenceEndDate: group.recurrence_end_date,
          nextOccurrence: group.next_occurrence,
          createdAt: group.created_at,
          creator: {
            id: group.creator_id,
            name: group.creator_name,
            email: group.creator_email
          }
        },
        members: membersResult.rows,
        totalMembers: membersResult.rows.length
      }
    });

  } catch (error) {
    console.error('❌ Get study group member details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve study group member details',
      message: error.message
    });
  }
});

// Join Study Group API
router.post('/:groupId/join', authenticateToken, async (req, res) => {
  console.log('➕ Join Study Group Request:', {
    userId: req.user.id,
    groupId: req.params.groupId,
    timestamp: new Date().toISOString()
  });

  try {
    const groupId = parseInt(req.params.groupId);
    const userId = req.user.id;

    // Check if group exists and is active
    const groupResult = await pool.query(
      'SELECT id, title, max_participants, requires_approval FROM study_groups WHERE id = $1 AND is_active = true',
      [groupId]
    );

    if (groupResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Study group not found or inactive'
      });
    }

    const group = groupResult.rows[0];

    // Check if user is already a member
    const existingMemberResult = await pool.query(
      'SELECT id, is_active FROM study_group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );

    if (existingMemberResult.rows.length > 0) {
      const existingMember = existingMemberResult.rows[0];
      if (existingMember.is_active) {
        return res.status(400).json({
          success: false,
          error: 'You are already a member of this study group'
        });
      }
    }

    // Check if group requires approval
    if (group.requires_approval) {
      return res.status(400).json({
        success: false,
        error: 'This study group requires approval to join',
        message: 'Please use the request-join endpoint to send a join request',
        requiresApproval: true,
        groupTitle: group.title
      });
    }

    // Check if group is full
    const memberCountResult = await pool.query(
      'SELECT COUNT(*) as count FROM study_group_members WHERE group_id = $1 AND is_active = true',
      [groupId]
    );

    const currentMembers = parseInt(memberCountResult.rows[0].count);
    if (currentMembers >= group.max_participants) {
      return res.status(400).json({
        success: false,
        error: 'Study group is full'
      });
    }

    // Add user to group
    await pool.query(
      `INSERT INTO study_group_members (group_id, user_id, role) 
       VALUES ($1, $2, 'member')
       ON CONFLICT (group_id, user_id) 
       DO UPDATE SET is_active = true, joined_at = CURRENT_TIMESTAMP`,
      [groupId, userId]
    );

    console.log('✅ User joined study group successfully:', {
      groupId: groupId,
      userId: userId,
      groupTitle: group.title,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Successfully joined study group',
      data: {
        groupId: groupId,
        groupTitle: group.title
      }
    });

  } catch (error) {
    console.error('❌ Join study group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to join study group',
      message: error.message
    });
  }
});

// Leave Study Group API
router.post('/:groupId/leave', authenticateToken, async (req, res) => {
  console.log('➖ Leave Study Group Request:', {
    userId: req.user.id,
    groupId: req.params.groupId,
    timestamp: new Date().toISOString()
  });

  try {
    const groupId = parseInt(req.params.groupId);
    const userId = req.user.id;

    // Check if user is a member
    const membershipResult = await pool.query(
      'SELECT role FROM study_group_members WHERE group_id = $1 AND user_id = $2 AND is_active = true',
      [groupId, userId]
    );

    if (membershipResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'You are not a member of this study group'
      });
    }

    const membership = membershipResult.rows[0];

    // Check if user is the creator (admin)
    if (membership.role === 'admin') {
      return res.status(400).json({
        success: false,
        error: 'Group creator cannot leave. Transfer ownership or delete the group instead.'
      });
    }

    // Remove user from group
    await pool.query(
      'UPDATE study_group_members SET is_active = false WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );

    console.log('✅ User left study group successfully:', {
      groupId: groupId,
      userId: userId,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Successfully left study group'
    });

  } catch (error) {
    console.error('❌ Leave study group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to leave study group',
      message: error.message
    });
  }
});

// Delete Study Group API (creator only)
router.delete('/:groupId', authenticateToken, async (req, res) => {
  console.log('🗑️ Delete Study Group Request:', {
    userId: req.user.id,
    groupId: req.params.groupId,
    timestamp: new Date().toISOString()
  });

  try {
    const groupId = parseInt(req.params.groupId);
    const userId = req.user.id;

    // Check if user is the creator and get group details
    const groupResult = await pool.query(
      'SELECT id, meet_id, title FROM study_groups WHERE id = $1 AND creator_id = $2',
      [groupId, userId]
    );

    if (groupResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only the group creator can delete the group.'
      });
    }

    const group = groupResult.rows[0];

    console.log('🔍 Group details for deletion:', {
      groupId: group.id,
      title: group.title,
      storedMeetId: group.meet_id
    });

    // Start database transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Delete from Google Calendar if meet_id exists (MANDATORY)
      if (group.meet_id) {
        console.log('🗑️ Deleting Google Calendar event...');
        
        // Check if user has Google Calendar access
        const userResult = await client.query(
          'SELECT google_access_token FROM users WHERE id = $1',
          [userId]
        );

        if (userResult.rows.length === 0 || !userResult.rows[0].google_access_token) {
          await client.query('ROLLBACK');
          client.release();
          
          return res.status(403).json({
            success: false,
            error: 'Google Calendar access required',
            message: 'Cannot delete study group without Google Calendar access. Please re-authenticate with Google.'
          });
        }

        try {
          await deleteGoogleCalendarEvent(userId, group.meet_id);
          console.log('✅ Google Calendar event deleted successfully');
        } catch (calendarError) {
          console.error('❌ Failed to delete Google Calendar event:', calendarError.message);
          
          // ROLLBACK the entire transaction if calendar deletion fails
          await client.query('ROLLBACK');
          client.release();
          
          return res.status(500).json({
            success: false,
            error: 'Failed to delete Google Calendar event',
            message: `Cannot delete study group: ${calendarError.message}. Please ensure the event exists and you have proper permissions.`,
            details: 'Study group deletion requires successful Google Calendar event deletion to maintain data consistency.'
          });
        }
      }

      // Soft delete the group
      await client.query(
        'UPDATE study_groups SET is_active = false, updated_at = NOW() WHERE id = $1',
        [groupId]
      );

      // Deactivate all members
      await client.query(
        'UPDATE study_group_members SET is_active = false WHERE group_id = $1',
        [groupId]
      );

      // Delete recurring meeting instances if it's a recurring group
      await client.query(
        'DELETE FROM recurring_meetings WHERE group_id = $1',
        [groupId]
      );

      await client.query('COMMIT');

      console.log('✅ Study group deleted successfully:', {
        groupId: groupId,
        creatorId: userId,
        title: group.title,
        hadMeetId: !!group.meet_id,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Study group deleted successfully',
        data: {
          groupId: groupId,
          title: group.title,
          deletedFromCalendar: !!group.meet_id
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Delete study group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete study group',
      message: error.message
    });
  }
});

// Update Study Group API
router.put('/:groupId', authenticateToken, async (req, res) => {
  console.log('🔄 Update Study Group Request:', {
    userId: req.user.id,
    groupId: req.params.groupId,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  try {
    const groupId = parseInt(req.params.groupId);
    const userId = req.user.id;
    
    let {
      title,
      description,
      maxParticipants,
      scheduledTime,
      durationMinutes,
      newAttendeeEmails = [], // New attendees to add
      removeAttendeeEmails = [], // Attendees to remove
      isRecurring,
      recurrencePattern,
      recurrenceInterval,
      recurrenceDaysOfWeek,
      recurrenceEndDate
    } = req.body;

    // Check if user is the creator or admin of this group
    const membershipResult = await pool.query(
      'SELECT role FROM study_group_members WHERE group_id = $1 AND user_id = $2 AND is_active = true',
      [groupId, userId]
    );

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You are not a member of this study group.'
      });
    }

    const userRole = membershipResult.rows[0].role;
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only group admins can update study groups.'
      });
    }

    // Get current group details
    const groupResult = await pool.query(
      'SELECT * FROM study_groups WHERE id = $1 AND is_active = true',
      [groupId]
    );

    if (groupResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Study group not found'
      });
    }

    const currentGroup = groupResult.rows[0];

    // Start database transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Build update query dynamically based on provided fields
      const updateFields = [];
      const updateValues = [];
      let paramCount = 1;

      if (title !== undefined) {
        updateFields.push(`title = $${paramCount++}`);
        updateValues.push(title);
      }

      if (description !== undefined) {
        updateFields.push(`description = $${paramCount++}`);
        updateValues.push(description);
      }

      if (maxParticipants !== undefined) {
        // Validate max participants
        if (maxParticipants < 1) {
          await client.query('ROLLBACK');
          client.release();
          return res.status(400).json({
            success: false,
            error: 'Max participants must be at least 1'
          });
        }

        // Check if new max is less than current members
        const currentMemberCount = await client.query(
          'SELECT COUNT(*) as count FROM study_group_members WHERE group_id = $1 AND is_active = true',
          [groupId]
        );
        
        const memberCount = parseInt(currentMemberCount.rows[0].count);
        if (maxParticipants < memberCount) {
          await client.query('ROLLBACK');
          client.release();
          return res.status(400).json({
            success: false,
            error: `Cannot set max participants to ${maxParticipants}. Group currently has ${memberCount} members.`
          });
        }

        updateFields.push(`max_participants = $${paramCount++}`);
        updateValues.push(maxParticipants);
      }

      if (scheduledTime !== undefined) {
        // Validate scheduledTime
        if (scheduledTime === '') {
          scheduledTime = null;
        } else if (scheduledTime !== null) {
          const date = new Date(scheduledTime);
          if (isNaN(date.getTime())) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(400).json({
              success: false,
              error: 'Invalid scheduled time format. Please use ISO 8601 format (e.g., 2025-09-03T20:00:00.000Z)'
            });
          }
        }
        
        updateFields.push(`scheduled_time = $${paramCount++}`);
        updateValues.push(scheduledTime);
      }

      if (durationMinutes !== undefined) {
        updateFields.push(`duration_minutes = $${paramCount++}`);
        updateValues.push(durationMinutes);
      }

      if (isRecurring !== undefined) {
        updateFields.push(`is_recurring = $${paramCount++}`);
        updateValues.push(isRecurring);
      }

      if (recurrencePattern !== undefined) {
        updateFields.push(`recurrence_pattern = $${paramCount++}`);
        updateValues.push(recurrencePattern);
      }

      if (recurrenceInterval !== undefined) {
        updateFields.push(`recurrence_interval = $${paramCount++}`);
        updateValues.push(recurrenceInterval);
      }

      if (recurrenceDaysOfWeek !== undefined) {
        updateFields.push(`recurrence_days_of_week = $${paramCount++}`);
        updateValues.push(recurrenceDaysOfWeek);
      }

      if (recurrenceEndDate !== undefined) {
        updateFields.push(`recurrence_end_date = $${paramCount++}`);
        updateValues.push(recurrenceEndDate);
      }

      // Always update the updated_at timestamp
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      if (updateFields.length > 1) { // More than just updated_at
        updateValues.push(groupId);
        const updateQuery = `UPDATE study_groups SET ${updateFields.join(', ')} WHERE id = $${paramCount}`;
        
        console.log('🔄 Updating study group:', {
          groupId,
          updateFields,
          updateValues: updateValues.slice(0, -1) // Exclude groupId from logging
        });

        await client.query(updateQuery, updateValues);
      }

      // Handle new attendees
      if (newAttendeeEmails.length > 0) {
        console.log('➕ Adding new attendees:', newAttendeeEmails);
        
        for (const email of newAttendeeEmails) {
          try {
            // Check if user exists in the system
            const invitedUserResult = await client.query(
              'SELECT id FROM users WHERE email = $1',
              [email]
            );

            if (invitedUserResult.rows.length > 0) {
              const invitedUserId = invitedUserResult.rows[0].id;
              
              // Check if user is already a member (including inactive members)
              const existingMemberResult = await client.query(
                'SELECT id, is_active FROM study_group_members WHERE group_id = $1 AND user_id = $2',
                [groupId, invitedUserId]
              );

              if (existingMemberResult.rows.length === 0) {
                // Check if group is full
                const memberCountResult = await client.query(
                  'SELECT COUNT(*) as count FROM study_group_members WHERE group_id = $1 AND is_active = true',
                  [groupId]
                );
                
                const currentMembers = parseInt(memberCountResult.rows[0].count);
                const maxMembers = maxParticipants || currentGroup.max_participants;
                
                if (currentMembers >= maxMembers) {
                  console.warn(`⚠️ Cannot add ${email}: group is full (${currentMembers}/${maxMembers})`);
                  continue;
                }

                // Add as new member
                await client.query(
                  `INSERT INTO study_group_members (group_id, user_id, role) 
                   VALUES ($1, $2, 'member')`,
                  [groupId, invitedUserId]
                );

                console.log('✅ Added new attendee to study group:', {
                  groupId: groupId,
                  userId: invitedUserId,
                  email: email
                });
              } else {
                const existingMember = existingMemberResult.rows[0];
                
                if (existingMember.is_active) {
                  console.log('ℹ️ User already an active member:', email);
                } else {
                  // Check if group is full before reactivating
                  const memberCountResult = await client.query(
                    'SELECT COUNT(*) as count FROM study_group_members WHERE group_id = $1 AND is_active = true',
                    [groupId]
                  );
                  
                  const currentMembers = parseInt(memberCountResult.rows[0].count);
                  const maxMembers = maxParticipants || currentGroup.max_participants;
                  
                  if (currentMembers >= maxMembers) {
                    console.warn(`⚠️ Cannot reactivate ${email}: group is full (${currentMembers}/${maxMembers})`);
                    continue;
                  }

                  // Reactivate the member
                  await client.query(
                    'UPDATE study_group_members SET is_active = true, joined_at = CURRENT_TIMESTAMP WHERE group_id = $1 AND user_id = $2',
                    [groupId, invitedUserId]
                  );
                  
                  console.log('✅ Reactivated existing member:', {
                    groupId: groupId,
                    userId: invitedUserId,
                    email: email
                  });
                }
              }
            } else {
              console.log('ℹ️ Invited user not found in system:', email);
            }
          } catch (error) {
            console.warn('⚠️ Failed to add attendee:', email, error.message);
          }
        }
      }

      // Handle removing attendees
      if (removeAttendeeEmails.length > 0) {
        console.log('➖ Removing attendees:', removeAttendeeEmails);
        
        for (const email of removeAttendeeEmails) {
          try {
            // Find user by email
            const userResult = await client.query(
              'SELECT id FROM users WHERE email = $1',
              [email]
            );

            if (userResult.rows.length > 0) {
              const userIdToRemove = userResult.rows[0].id;
              
              // Check if user is a member and not the creator
              const memberResult = await client.query(
                'SELECT role FROM study_group_members WHERE group_id = $1 AND user_id = $2 AND is_active = true',
                [groupId, userIdToRemove]
              );

              if (memberResult.rows.length > 0) {
                const memberRole = memberResult.rows[0].role;
                
                if (memberRole === 'admin') {
                  console.warn(`⚠️ Cannot remove admin user: ${email}`);
                  continue;
                }

                // Remove member
                await client.query(
                  'UPDATE study_group_members SET is_active = false WHERE group_id = $1 AND user_id = $2',
                  [groupId, userIdToRemove]
                );

                console.log('✅ Removed attendee from study group:', {
                  groupId: groupId,
                  userId: userIdToRemove,
                  email: email
                });
              }
            }
          } catch (error) {
            console.warn('⚠️ Failed to remove attendee:', email, error.message);
          }
        }
      }

      // Update Google Calendar event if scheduled time or other calendar-related fields changed
      if (scheduledTime !== undefined || durationMinutes !== undefined || 
          isRecurring !== undefined || recurrencePattern !== undefined ||
          title !== undefined || description !== undefined) {
        
        // Check if user has Google Calendar access
        const userResult = await client.query(
          'SELECT google_access_token FROM users WHERE id = $1',
          [userId]
        );

        if (userResult.rows.length > 0 && userResult.rows[0].google_access_token) {
          try {
            console.log('📅 Updating Google Calendar event...');
            
            // Get updated group data
            const updatedGroupResult = await client.query(
              'SELECT * FROM study_groups WHERE id = $1',
              [groupId]
            );
            
            const updatedGroup = updatedGroupResult.rows[0];
            
            if (updatedGroup.meet_id && updatedGroup.scheduled_time) {
              // Prepare event data for Google Calendar update
              const startTime = new Date(updatedGroup.scheduled_time);
              const endTime = new Date(startTime);
              endTime.setMinutes(endTime.getMinutes() + updatedGroup.duration_minutes);

              // Get current attendees
              const attendeesResult = await client.query(
                `SELECT u.email 
                 FROM study_group_members sgm
                 INNER JOIN users u ON sgm.user_id = u.id
                 WHERE sgm.group_id = $1 AND sgm.is_active = true AND sgm.role = 'member'`,
                [groupId]
              );

              const attendees = attendeesResult.rows.map(row => ({ email: row.email }));
              
              const eventData = {
                title: updatedGroup.title,
                description: updatedGroup.description || `Study group: ${updatedGroup.title}`,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                attendees,
                timeZone: 'UTC'
              };

              // Add recurrence if it's a recurring meeting
              if (updatedGroup.is_recurring && updatedGroup.recurrence_pattern) {
                eventData.recurrence = [generateRecurrenceRule(
                  updatedGroup.recurrence_pattern,
                  updatedGroup.recurrence_interval,
                  updatedGroup.recurrence_days_of_week,
                  updatedGroup.recurrence_end_date
                )];
              }

              // Update Google Calendar event
              const calendarResult = await updateGoogleCalendarEvent(userId, updatedGroup.meet_id, eventData);

              // Update group with new meet information if it changed
              if (calendarResult.meetLink !== updatedGroup.meet_link) {
                await client.query(
                  `UPDATE study_groups 
                   SET meet_link = $1, meet_id = $2 
                   WHERE id = $3`,
                  [calendarResult.meetLink, calendarResult.eventId, groupId]
                );

                console.log('✅ Updated meet link in database:', {
                  groupId: groupId,
                  newMeetLink: calendarResult.meetLink,
                  newEventId: calendarResult.eventId
                });
              }

              console.log('✅ Google Calendar event updated successfully');
            }
          } catch (calendarError) {
            console.warn('⚠️ Failed to update Google Calendar event:', calendarError.message);
            // Don't fail the entire update if calendar update fails
          }
        }
      }

      await client.query('COMMIT');

      // Get updated group data for response
      const finalGroupResult = await client.query(
        `SELECT 
          sg.*, 
          COUNT(sgm.user_id) as current_members
         FROM study_groups sg
         LEFT JOIN study_group_members sgm ON sg.id = sgm.group_id AND sgm.is_active = true
         WHERE sg.id = $1
         GROUP BY sg.id`,
        [groupId]
      );

      const updatedGroup = finalGroupResult.rows[0];

      console.log('✅ Study group updated successfully:', {
        groupId: groupId,
        updatedBy: userId,
        changes: Object.keys(req.body),
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Study group updated successfully',
        data: {
          id: updatedGroup.id,
          title: updatedGroup.title,
          description: updatedGroup.description,
          theme: updatedGroup.theme,
          meetLink: updatedGroup.meet_link,
          meetId: updatedGroup.meet_id,
          maxParticipants: updatedGroup.max_participants,
          currentMembers: parseInt(updatedGroup.current_members),
          scheduledTime: updatedGroup.scheduled_time,
          durationMinutes: updatedGroup.duration_minutes,
          isRecurring: updatedGroup.is_recurring,
          recurrencePattern: updatedGroup.recurrence_pattern,
          recurrenceInterval: updatedGroup.recurrence_interval,
          recurrenceDaysOfWeek: updatedGroup.recurrence_days_of_week,
          recurrenceEndDate: updatedGroup.recurrence_end_date,
          nextOccurrence: updatedGroup.next_occurrence,
          updatedAt: updatedGroup.updated_at
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Update study group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update study group',
      message: error.message
    });
  }
});

// Get Upcoming Recurring Meetings API
router.get('/upcoming-recurring', authenticateToken, async (req, res) => {
  console.log('📅 Get Upcoming Recurring Meetings Request:', {
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;

    // Get upcoming recurring meetings where user is a member
    const meetingsResult = await pool.query(
      `SELECT 
        sg.id as group_id,
        sg.title,
        sg.description,
        sg.theme,
        sg.meet_link,
        sg.duration_minutes,
        sg.is_recurring,
        sg.recurrence_pattern,
        sg.recurrence_interval,
        sg.recurrence_days_of_week,
        sg.next_occurrence,
        rm.id as meeting_id,
        rm.meeting_date,
        rm.google_event_id,
        sgm.role
       FROM study_groups sg
       INNER JOIN study_group_members sgm ON sg.id = sgm.group_id
       LEFT JOIN recurring_meetings rm ON sg.id = rm.group_id
       WHERE sgm.user_id = $1 
         AND sg.is_active = true 
         AND sg.is_recurring = true
         AND rm.meeting_date >= NOW()
       ORDER BY rm.meeting_date ASC
       LIMIT $2`,
      [userId, parseInt(limit)]
    );

    console.log('✅ Upcoming recurring meetings retrieved successfully:', {
      userId: userId,
      meetingCount: meetingsResult.rows.length,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        meetings: meetingsResult.rows,
        totalMeetings: meetingsResult.rows.length
      }
    });

  } catch (error) {
    console.error('❌ Get upcoming recurring meetings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve upcoming recurring meetings',
      message: error.message
    });
  }
});

// Request to Join Study Group API
router.post('/:groupId/request-join', authenticateToken, async (req, res) => {
  console.log('📝 Request to Join Study Group:', {
    userId: req.user.id,
    groupId: req.params.groupId,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  try {
    const groupId = parseInt(req.params.groupId);
    const userId = req.user.id;
    const { message = '' } = req.body;

    // Check if group exists and is active
    const groupResult = await pool.query(
      'SELECT id, title, creator_id, max_participants FROM study_groups WHERE id = $1 AND is_active = true',
      [groupId]
    );

    if (groupResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Study group not found or inactive'
      });
    }

    const group = groupResult.rows[0];

    // Check if user is already a member
    const existingMemberResult = await pool.query(
      'SELECT id, is_active FROM study_group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );

    if (existingMemberResult.rows.length > 0) {
      const existingMember = existingMemberResult.rows[0];
      if (existingMember.is_active) {
        return res.status(400).json({
          success: false,
          error: 'You are already a member of this study group'
        });
      }
    }

    // Check if user is the creator
    if (group.creator_id === userId) {
      return res.status(400).json({
        success: false,
        error: 'You cannot request to join your own study group'
      });
    }

    // Check if there's already a pending request
    const existingRequestResult = await pool.query(
      'SELECT id, status FROM study_group_join_requests WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );

    if (existingRequestResult.rows.length > 0) {
      const existingRequest = existingRequestResult.rows[0];
      if (existingRequest.status === 'pending') {
        return res.status(400).json({
          success: false,
          error: 'You already have a pending request to join this study group'
        });
      } else if (existingRequest.status === 'accepted') {
        return res.status(400).json({
          success: false,
          error: 'Your request to join this study group has already been accepted'
        });
      } else if (existingRequest.status === 'rejected') {
        // Allow creating a new request if the previous one was rejected
        console.log('🔄 Previous request was rejected, creating new request');
      }
    }

    // Check if group is full
    const memberCountResult = await pool.query(
      'SELECT COUNT(*) as count FROM study_group_members WHERE group_id = $1 AND is_active = true',
      [groupId]
    );

    const currentMembers = parseInt(memberCountResult.rows[0].count);
    if (currentMembers >= group.max_participants) {
      return res.status(400).json({
        success: false,
        error: 'Study group is full'
      });
    }

    // Create join request
    const requestResult = await pool.query(
      `INSERT INTO study_group_join_requests (group_id, user_id, message, status) 
       VALUES ($1, $2, $3, 'pending') 
       RETURNING id, requested_at`,
      [groupId, userId, message]
    );

    const request = requestResult.rows[0];

    console.log('✅ Join request created successfully:', {
      requestId: request.id,
      groupId: groupId,
      userId: userId,
      groupTitle: group.title,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Join request sent successfully',
      data: {
        requestId: request.id,
        groupId: groupId,
        groupTitle: group.title,
        message: message,
        status: 'pending',
        requestedAt: request.requested_at
      }
    });

  } catch (error) {
    console.error('❌ Request to join study group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send join request',
      message: error.message
    });
  }
});

// Get Pending Join Requests API (for group owners/admins)
router.get('/:groupId/join-requests', authenticateToken, async (req, res) => {
  console.log('📋 Get Join Requests Request:', {
    userId: req.user.id,
    groupId: req.params.groupId,
    timestamp: new Date().toISOString()
  });

  try {
    const groupId = parseInt(req.params.groupId);
    const userId = req.user.id;
    const { status = 'pending', limit = 20, offset = 0 } = req.query;

    // Check if user is the group creator or admin
    const membershipResult = await pool.query(
      'SELECT role FROM study_group_members WHERE group_id = $1 AND user_id = $2 AND is_active = true',
      [groupId, userId]
    );

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You are not a member of this study group.'
      });
    }

    const userRole = membershipResult.rows[0].role;
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only group admins can view join requests.'
      });
    }

    // Get join requests
    let query = `
      SELECT 
        sjr.id, sjr.user_id, sjr.message, sjr.status, sjr.requested_at, sjr.responded_at,
        u.name, u.email, u.picture
      FROM study_group_join_requests sjr
      INNER JOIN users u ON sjr.user_id = u.id
      WHERE sjr.group_id = $1
    `;
    
    const queryParams = [groupId];
    let paramCount = 1;

    if (status !== 'all') {
      paramCount++;
      query += ` AND sjr.status = $${paramCount}`;
      queryParams.push(status);
    }

    query += ` ORDER BY sjr.requested_at DESC`;

    // Add pagination
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    queryParams.push(parseInt(limit));

    paramCount++;
    query += ` OFFSET $${paramCount}`;
    queryParams.push(parseInt(offset));

    const requestsResult = await pool.query(query, queryParams);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM study_group_join_requests sjr
      WHERE sjr.group_id = $1
    `;
    
    const countParams = [groupId];
    let countParamCount = 1;

    if (status !== 'all') {
      countParamCount++;
      countQuery += ` AND sjr.status = $${countParamCount}`;
      countParams.push(status);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].total);

    console.log('✅ Join requests retrieved successfully:', {
      groupId: groupId,
      requestCount: requestsResult.rows.length,
      totalCount: totalCount,
      status: status,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        requests: requestsResult.rows,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
        },
        filters: {
          status
        }
      }
    });

  } catch (error) {
    console.error('❌ Get join requests error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve join requests',
      message: error.message
    });
  }
});

// Respond to Join Request API (accept/reject)
router.post('/:groupId/join-requests/:requestId/respond', authenticateToken, async (req, res) => {
  console.log('✅ Respond to Join Request:', {
    userId: req.user.id,
    groupId: req.params.groupId,
    requestId: req.params.requestId,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  try {
    const groupId = parseInt(req.params.groupId);
    const requestId = parseInt(req.params.requestId);
    const userId = req.user.id;
    const { action } = req.body; // 'accept' or 'reject'

    if (!action || !['accept', 'approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Must be "accept", "approve", or "reject"'
      });
    }

    // Normalize action
    const normalizedAction = action === 'approve' ? 'accept' : action;

    // Check if user is the group creator or admin
    const membershipResult = await pool.query(
      'SELECT role FROM study_group_members WHERE group_id = $1 AND user_id = $2 AND is_active = true',
      [groupId, userId]
    );

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You are not a member of this study group.'
      });
    }

    const userRole = membershipResult.rows[0].role;
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only group admins can respond to join requests.'
      });
    }

    // Get the join request
    const requestResult = await pool.query(
      `SELECT sjr.*, u.name as requester_name, u.email as requester_email
       FROM study_group_join_requests sjr
       INNER JOIN users u ON sjr.user_id = u.id
       WHERE sjr.id = $1 AND sjr.group_id = $2`,
      [requestId, groupId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Join request not found'
      });
    }

    const request = requestResult.rows[0];

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `This request has already been ${request.status}`
      });
    }

    // Start database transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      if (normalizedAction === 'accept') {
        // Check if group is still not full
        const memberCountResult = await client.query(
          'SELECT COUNT(*) as count FROM study_group_members WHERE group_id = $1 AND is_active = true',
          [groupId]
        );

        const currentMembers = parseInt(memberCountResult.rows[0].count);
        const groupResult = await client.query(
          'SELECT max_participants FROM study_groups WHERE id = $1',
          [groupId]
        );
        const maxParticipants = groupResult.rows[0].max_participants;

        if (currentMembers >= maxParticipants) {
          await client.query('ROLLBACK');
          client.release();
          return res.status(400).json({
            success: false,
            error: 'Cannot accept request: Study group is now full'
          });
        }

        // Add user to group
        await client.query(
          `INSERT INTO study_group_members (group_id, user_id, role) 
           VALUES ($1, $2, 'member')
           ON CONFLICT (group_id, user_id) 
           DO UPDATE SET is_active = true, joined_at = CURRENT_TIMESTAMP`,
          [groupId, request.user_id]
        );

        console.log('✅ User added to study group:', {
          groupId: groupId,
          userId: request.user_id,
          requesterName: request.requester_name
        });
      }

      // Update request status
      await client.query(
        `UPDATE study_group_join_requests 
         SET status = $1, responded_at = CURRENT_TIMESTAMP, responded_by = $2 
         WHERE id = $3`,
        [normalizedAction, userId, requestId]
      );

      await client.query('COMMIT');

      console.log('✅ Join request responded successfully:', {
        requestId: requestId,
        groupId: groupId,
        action: normalizedAction,
        requesterName: request.requester_name,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: `Join request ${normalizedAction}ed successfully`,
        data: {
          requestId: requestId,
          action: normalizedAction,
          requesterName: request.requester_name,
          requesterEmail: request.requester_email,
          respondedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Respond to join request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to respond to join request',
      message: error.message
    });
  }
});


// Get Groups by Date Range API
router.get('/by-date-range', authenticateToken, async (req, res) => {
  console.log('📅 Get Groups by Date Range Request:', {
    userId: req.user.id,
    query: req.query,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;
    const { 
      range = 'today', // 'today', 'tomorrow', 'this-week', 'next-week', 'this-month'
      limit = 20, 
      offset = 0 
    } = req.query;

    let dateCondition = '';
    let queryParams = [userId];
    let paramCount = 1;

    // Build date condition based on range
    switch (range) {
      case 'today':
        dateCondition = `AND DATE(sg.scheduled_time) = CURRENT_DATE`;
        break;
      case 'tomorrow':
        dateCondition = `AND DATE(sg.scheduled_time) = CURRENT_DATE + INTERVAL '1 day'`;
        break;
      case 'this-week':
        dateCondition = `AND DATE(sg.scheduled_time) >= DATE_TRUNC('week', CURRENT_DATE) 
                        AND DATE(sg.scheduled_time) < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '1 week'`;
        break;
      case 'next-week':
        dateCondition = `AND DATE(sg.scheduled_time) >= DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '1 week'
                        AND DATE(sg.scheduled_time) < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '2 weeks'`;
        break;
      case 'this-month':
        dateCondition = `AND DATE(sg.scheduled_time) >= DATE_TRUNC('month', CURRENT_DATE) 
                        AND DATE(sg.scheduled_time) < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'`;
        break;
      default:
        dateCondition = `AND DATE(sg.scheduled_time) = CURRENT_DATE`;
    }

    // Build the query
    let baseQuery = `
      SELECT 
        sg.id, sg.title, sg.description, sg.theme, sg.meet_link, sg.meet_id,
        sg.max_participants, sg.scheduled_time, sg.duration_minutes,
        sg.is_recurring, sg.recurrence_pattern, sg.recurrence_interval,
        sg.recurrence_days_of_week, sg.recurrence_end_date, sg.next_occurrence,
        sg.requires_approval, sg.created_at, sg.updated_at, sg.is_active,
        u.name as creator_name, u.email as creator_email,
        COUNT(sgm.user_id) as current_members,
        CASE 
          WHEN sgm.user_id = $1 AND sgm.is_active = true THEN sgm.role
          ELSE NULL
        END as user_role,
        CASE 
          WHEN sgm.user_id = $1 AND sgm.is_active = true THEN sgm.joined_at
          ELSE NULL
        END as user_joined_at,
        CASE 
          WHEN sjr.user_id = $1 THEN sjr.status
          ELSE NULL
        END as user_join_request_status,
        CASE 
          WHEN sjr.user_id = $1 THEN sjr.requested_at
          ELSE NULL
        END as user_join_requested_at
      FROM study_groups sg
      LEFT JOIN users u ON sg.creator_id = u.id
      LEFT JOIN study_group_members sgm ON sg.id = sgm.group_id AND sgm.is_active = true
      LEFT JOIN study_group_members sgm2 ON sg.id = sgm2.group_id AND sgm2.is_active = true
      LEFT JOIN study_group_join_requests sjr ON sg.id = sjr.group_id AND sjr.user_id = $1
      WHERE sg.is_active = true AND sg.scheduled_time IS NOT NULL ${dateCondition}
      GROUP BY sg.id, sgm.user_id, sgm.role, sgm.joined_at, sjr.status, sjr.requested_at, u.name, u.email
      ORDER BY sg.scheduled_time ASC
    `;

    // Add pagination
    paramCount++;
    baseQuery += ` LIMIT $${paramCount}`;
    queryParams.push(parseInt(limit));

    paramCount++;
    baseQuery += ` OFFSET $${paramCount}`;
    queryParams.push(parseInt(offset));

    const groupsResult = await pool.query(baseQuery, queryParams);

    // Get total count
    let countQuery = `
      SELECT COUNT(DISTINCT sg.id) as total
      FROM study_groups sg
      WHERE sg.is_active = true AND sg.scheduled_time IS NOT NULL ${dateCondition}
    `;

    const countResult = await pool.query(countQuery, []);
    const totalCount = parseInt(countResult.rows[0].total);

    // Process results with member details
    const processedGroups = await Promise.all(groupsResult.rows.map(async (group) => {
      // Get detailed member information for each group
      const membersResult = await pool.query(
        `SELECT 
          u.id, u.name, u.email, u.picture,
          sgm.role, sgm.joined_at
         FROM study_group_members sgm
         INNER JOIN users u ON sgm.user_id = u.id
         WHERE sgm.group_id = $1 AND sgm.is_active = true
         ORDER BY sgm.joined_at ASC`,
        [group.id]
      );

      return {
        ...group,
        members: membersResult.rows,
        userStatus: {
          isMember: !!group.user_role,
          role: group.user_role,
          joinedAt: group.user_joined_at,
          hasJoinRequest: !!group.user_join_request_status,
          joinRequestStatus: group.user_join_request_status,
          joinRequestedAt: group.user_join_requested_at
        }
      };
    }));

    console.log('✅ Groups by date range retrieved successfully:', {
      userId: userId,
      range: range,
      groupCount: processedGroups.length,
      totalCount: totalCount,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        groups: processedGroups,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
        },
        filters: {
          range
        }
      }
    });

  } catch (error) {
    console.error('❌ Get groups by date range error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve groups by date range',
      message: error.message
    });
  }
});

// Get My Groups with Request Counts API (for group admins)
router.get('/my-groups-with-requests', authenticateToken, async (req, res) => {
  console.log('📊 Get My Groups with Request Counts Request:', {
    userId: req.user.id,
    query: req.query,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    // Get groups where user is admin with request counts
    const groupsResult = await pool.query(
      `SELECT 
        sg.id, sg.title, sg.description, sg.theme, sg.meet_link, sg.meet_id,
        sg.max_participants, sg.scheduled_time, sg.duration_minutes,
        sg.is_recurring, sg.recurrence_pattern, sg.recurrence_interval,
        sg.recurrence_days_of_week, sg.recurrence_end_date, sg.next_occurrence,
        sg.requires_approval, sg.created_at, sg.updated_at, sg.is_active,
        u.name as creator_name, u.email as creator_email,
        sgm.role as user_role, sgm.joined_at,
        (SELECT COUNT(*) FROM study_group_members sgm_count WHERE sgm_count.group_id = sg.id AND sgm_count.is_active = true) as current_members,
        (SELECT COUNT(*) FROM study_group_join_requests sjr_pending WHERE sjr_pending.group_id = sg.id AND sjr_pending.status = 'pending') as pending_requests,
        (SELECT COUNT(*) FROM study_group_join_requests sjr_all WHERE sjr_all.group_id = sg.id) as total_requests
      FROM study_groups sg
      INNER JOIN study_group_members sgm ON sg.id = sgm.group_id
      LEFT JOIN users u ON sg.creator_id = u.id
      WHERE sgm.user_id = $1 AND sgm.is_active = true AND sgm.role = 'admin'
      ORDER BY sg.created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit), parseInt(offset)]
    );

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total
       FROM study_groups sg
       INNER JOIN study_group_members sgm ON sg.id = sgm.group_id
       WHERE sgm.user_id = $1 AND sgm.is_active = true AND sgm.role = 'admin'`,
      [userId]
    );

    const totalCount = parseInt(countResult.rows[0].total);

    console.log('✅ My groups with request counts retrieved successfully:', {
      userId: userId,
      groupCount: groupsResult.rows.length,
      totalCount: totalCount,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        groups: groupsResult.rows,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
        }
      }
    });

  } catch (error) {
    console.error('❌ Get my groups with request counts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve groups with request counts',
      message: error.message
    });
  }
});

// Get Available Themes API
router.get('/themes', authenticateToken, async (req, res) => {
  console.log('🎨 Get Available Themes Request:', {
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });

  try {
    // Get unique themes from active groups
    const themesResult = await pool.query(
      `SELECT DISTINCT theme, COUNT(*) as group_count
       FROM study_groups 
       WHERE is_active = true AND theme IS NOT NULL
       GROUP BY theme
       ORDER BY group_count DESC, theme ASC`
    );

    const themes = themesResult.rows.map(row => ({
      name: row.theme,
      count: parseInt(row.group_count)
    }));

    console.log('✅ Available themes retrieved successfully:', {
      themeCount: themes.length,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        themes: themes,
        totalThemes: themes.length
      }
    });

  } catch (error) {
    console.error('❌ Get themes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve themes',
      message: error.message
    });
  }
});

module.exports = router;
