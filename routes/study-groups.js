const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { createGoogleCalendarEvent } = require('../utils/googleAuth');
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
const createRecurringMeetingInstances = async (client, groupId, startTime, durationMinutes, pattern, interval, daysOfWeek, maxInstances = 52) => {
  console.log('🔄 Creating recurring meeting instances:', {
    groupId,
    startTime: startTime.toISOString(),
    pattern,
    interval,
    daysOfWeek,
    maxInstances
  });
  
  const instances = [];
  let currentDate = new Date(startTime);
  let count = 0;
  
  while (count < maxInstances) {
    const instanceEndTime = new Date(currentDate);
    instanceEndTime.setMinutes(instanceEndTime.getMinutes() + durationMinutes);
    
    console.log(`📅 Creating instance ${count + 1}:`, {
      date: currentDate.toISOString(),
      dayOfWeek: currentDate.getDay(),
      dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDate.getDay()],
      localDate: currentDate.toString()
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
  
  console.log(`✅ Created ${instances.length} recurring meeting instances`);
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
    const { 
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
      recurrenceEndDate = null // Optional end date for recurring meetings
    } = req.body;
    
    const creatorId = req.user.id;

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Study group title is required'
      });
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
      }

      // Create study group
      const groupResult = await client.query(
        `INSERT INTO study_groups (
          creator_id, title, description, theme, max_participants, 
          scheduled_time, duration_minutes, is_recurring, recurrence_pattern,
          recurrence_interval, recurrence_days_of_week, recurrence_end_date, next_occurrence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
        RETURNING id, title, theme, created_at, is_recurring, next_occurrence`,
        [
          creatorId, title, description, theme, maxParticipants, scheduledTime, durationMinutes,
          isRecurring, recurrencePattern, recurrenceInterval, recurrenceDaysOfWeek, recurrenceEndDate, nextOccurrence
        ]
      );

      const group = groupResult.rows[0];

      // Create Google Calendar event if scheduled time is provided
      let meetData = null;
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

          // Update group with meet information
          await client.query(
            `UPDATE study_groups 
             SET meet_link = $1, meet_id = $2 
             WHERE id = $3`,
            [meetData.meetLink, meetData.meetId, group.id]
          );

          group.meet_link = meetData.meetLink;
          group.meet_id = meetData.meetId;

          // Create recurring meeting instances if it's a recurring meeting
          if (isRecurring) {
            await createRecurringMeetingInstances(
              client,
              group.id,
              startTime,
              durationMinutes,
              recurrencePattern,
              recurrenceInterval,
              recurrenceDaysOfWeek
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
              
              // Add as member
              await client.query(
                `INSERT INTO study_group_members (group_id, user_id, role) 
                 VALUES ($1, $2, 'member')`,
                [group.id, invitedUserId]
              );

              console.log('✅ Added invited user to study group:', {
                groupId: group.id,
                userId: invitedUserId,
                email: email
              });
            } else {
              console.log('ℹ️ Invited user not found in system:', email);
            }
          } catch (error) {
            console.warn('⚠️ Failed to add invited user:', email, error.message);
          }
        }
      }

      await client.query('COMMIT');

      console.log('✅ Study group created successfully:', {
        groupId: group.id,
        creatorId: creatorId,
        title: group.title,
        theme: group.theme,
        hasMeetLink: !!group.meet_link,
        isRecurring: group.is_recurring,
        nextOccurrence: group.next_occurrence,
        attendeeCount: attendeeEmails.length,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Study group created successfully',
        data: {
          id: group.id,
          title: group.title,
          description: description,
          theme: theme,
          meetLink: group.meet_link,
          meetId: group.meet_id,
          maxParticipants: maxParticipants,
          scheduledTime: scheduledTime,
          durationMinutes: durationMinutes,
          isRecurring: group.is_recurring,
          recurrencePattern: group.recurrence_pattern,
          recurrenceInterval: group.recurrence_interval,
          recurrenceDaysOfWeek: group.recurrence_days_of_week,
          recurrenceEndDate: group.recurrence_end_date,
          nextOccurrence: group.next_occurrence,
          attendeeEmails: attendeeEmails,
          createdAt: group.created_at
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
      frequency = 'weekly', // 'daily', 'weekly', 'monthly'
      interval = 1, // every 1 day/week/month
      daysOfWeek = [], // [1,3,5] for Monday, Wednesday, Friday (0=Sunday, 1=Monday, etc.)
      endDate = null, // Optional end date
      timeZone = 'UTC'
    } = req.body;
    
    const creatorId = req.user.id;

    // Validate required fields
    if (!title || !startTime) {
      return res.status(400).json({
        success: false,
        error: 'Title and start time are required'
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

    // Validate and normalize startTime
    let normalizedStartTime = startTime;
    if (typeof startTime === 'string') {
      // If startTime doesn't end with 'Z', treat it as local time in the specified timezone
      if (!startTime.endsWith('Z') && timeZone !== 'UTC') {
        console.log('⚠️ Start time does not end with Z, treating as local time in timezone:', timeZone);
      }
      
      const startDate = new Date(startTime);
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid start time format. Please use ISO 8601 format (e.g., 2025-08-27T22:00:00.000Z)'
        });
      }
      
      // Normalize to ensure consistent timezone handling
      normalizedStartTime = startDate.toISOString();
      
      console.log('📅 Date validation:', {
        originalStartTime: startTime,
        normalizedStartTime: normalizedStartTime,
        parsedDate: startDate.toString(),
        dayOfWeek: startDate.getDay(),
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][startDate.getDay()],
        timeZone: timeZone
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

      // Create study group
      const groupResult = await client.query(
        `INSERT INTO study_groups (
          creator_id, title, description, theme, max_participants, 
          scheduled_time, duration_minutes, is_recurring, recurrence_pattern,
          recurrence_interval, recurrence_days_of_week, recurrence_end_date, next_occurrence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
        RETURNING id, title, theme, created_at, is_recurring, next_occurrence`,
        [
          creatorId, title, description, theme, maxParticipants, normalizedStartTime, durationMinutes,
          true, frequency, interval, daysOfWeek, endDate, nextOccurrence
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
          timeZone,
          recurrence: [generateRecurrenceRule(frequency, interval, daysOfWeek, processedEndDate)]
        };

        console.log('📅 Creating Google Calendar event for recurring meeting:', {
          title: eventData.title,
          startTime: eventData.startTime,
          endTime: eventData.endTime,
          frequency: frequency,
          interval: interval,
          daysOfWeek: daysOfWeek,
          endDate: processedEndDate
        });

        meetData = await createGoogleCalendarEvent(creatorId, eventData);

        // Update group with meet information
        await client.query(
          `UPDATE study_groups 
           SET meet_link = $1, meet_id = $2 
           WHERE id = $3`,
          [meetData.meetLink, meetData.meetId, group.id]
        );

        group.meet_link = meetData.meetLink;
        group.meet_id = meetData.meetId;

        // Create recurring meeting instances
        await createRecurringMeetingInstances(
          client,
          group.id,
          startDateTime,
          durationMinutes,
          frequency,
          interval,
          daysOfWeek
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
              
              await client.query(
                `INSERT INTO study_group_members (group_id, user_id, role) 
                 VALUES ($1, $2, 'member')`,
                [group.id, invitedUserId]
              );

              console.log('✅ Added invited user to recurring study group:', {
                groupId: group.id,
                userId: invitedUserId,
                email: email
              });
            }
          } catch (error) {
            console.warn('⚠️ Failed to add invited user:', email, error.message);
          }
        }
      }

      await client.query('COMMIT');

      console.log('✅ Recurring study group created successfully:', {
        groupId: group.id,
        creatorId: creatorId,
        title: group.title,
        frequency: frequency,
        interval: interval,
        daysOfWeek: daysOfWeek,
        nextOccurrence: group.next_occurrence,
        attendeeCount: attendeeEmails.length,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Recurring study group created successfully',
        data: {
          id: group.id,
          title: group.title,
          description: description,
          theme: theme,
          meetLink: group.meet_link,
          meetId: group.meet_id,
          maxParticipants: maxParticipants,
          startTime: normalizedStartTime,
          originalStartTime: startTime,
          durationMinutes: durationMinutes,
          frequency: frequency,
          interval: interval,
          daysOfWeek: daysOfWeek,
          endDate: endDate,
          nextOccurrence: group.next_occurrence,
          attendeeEmails: attendeeEmails,
          createdAt: group.created_at
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

// Get Study Groups API (for user)
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

// Get Study Group Details API
router.get('/:groupId', authenticateToken, async (req, res) => {
  console.log('🔍 Get Study Group Details Request:', {
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

    console.log('✅ Study group details retrieved successfully:', {
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
    console.error('❌ Get study group details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve study group details',
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
      'SELECT id, max_participants FROM study_groups WHERE id = $1 AND is_active = true',
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
      'SELECT id FROM study_group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );

    if (existingMemberResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'You are already a member of this study group'
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
       VALUES ($1, $2, 'member')`,
      [groupId, userId]
    );

    console.log('✅ User joined study group successfully:', {
      groupId: groupId,
      userId: userId,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Successfully joined study group'
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

    // Check if user is the creator
    const groupResult = await pool.query(
      'SELECT id FROM study_groups WHERE id = $1 AND creator_id = $2',
      [groupId, userId]
    );

    if (groupResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only the group creator can delete the group.'
      });
    }

    // Soft delete the group
    await pool.query(
      'UPDATE study_groups SET is_active = false, updated_at = NOW() WHERE id = $1',
      [groupId]
    );

    // Deactivate all members
    await pool.query(
      'UPDATE study_group_members SET is_active = false WHERE group_id = $1',
      [groupId]
    );

    console.log('✅ Study group deleted successfully:', {
      groupId: groupId,
      creatorId: userId,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Study group deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete study group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete study group',
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

module.exports = router;
