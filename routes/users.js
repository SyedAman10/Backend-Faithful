const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Helper function to check if user profile is complete
const isProfileComplete = (user) => {
  const requiredFields = [
    'denomination',
    'bible_version', 
    'age_group',
    'referral_source',
    'bible_answers',
    'bible_specific'
  ];
  
  return requiredFields.every(field => {
    const value = user[field];
    return value && value.trim() !== '' && value !== 'Not specified';
  });
};

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  console.log('👤 Get User Profile Request:', {
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });

  try {
    const result = await pool.query(
      `SELECT id, email, name, picture, google_picture, custom_picture, 
              google_meet_access, denomination, bible_version, age_group, 
              referral_source, bible_answers, bible_specific, voice_id, voice_name, 
              profile_completed, created_at, updated_at 
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    const user = result.rows[0];
    
    // Determine which picture to use (custom takes priority, then Google)
    const profilePicture = user.custom_picture || user.google_picture || user.picture;

    console.log('✅ User profile retrieved successfully:', {
      userId: req.user.id,
      hasCustomPicture: !!user.custom_picture,
      hasGooglePicture: !!user.google_picture,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      user: {
        ...user,
        picture: profilePicture,
        hasCustomPicture: !!user.custom_picture,
        hasGooglePicture: !!user.google_picture
      }
    });
  } catch (error) {
    console.error('❌ Get profile error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch user profile',
      message: error.message 
    });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  console.log('👤 Update User Profile Request:', {
    userId: req.user.id,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  try {
    const { 
      name, 
      picture, 
      customPicture, // NEW: Custom uploaded picture (base64 or URL)
      denomination, 
      bibleVersion, 
      ageGroup, 
      referralSource, 
      bibleAnswers, 
      bibleSpecific 
    } = req.body;

    // Validate name length if provided
    if (name && name.length > 255) {
      return res.status(400).json({ 
        success: false,
        error: 'Name must be 255 characters or less' 
      });
    }

    // Validate picture URL if provided
    if (picture && picture.trim().length > 0) {
      try {
        new URL(picture);
      } catch (error) {
        return res.status(400).json({ 
          success: false,
          error: 'Picture must be a valid URL' 
        });
      }
    }
    
    // Validate custom picture (base64 or URL)
    if (customPicture && customPicture.trim().length > 0) {
      // Check if it's base64 or URL
      if (!customPicture.startsWith('data:image/') && !customPicture.startsWith('http')) {
        return res.status(400).json({
          success: false,
          error: 'Custom picture must be a valid base64 image or URL'
        });
      }
      
      // Limit base64 image size to 5MB
      if (customPicture.startsWith('data:image/')) {
        const base64Length = customPicture.length - (customPicture.indexOf(',') + 1);
        const sizeInBytes = (base64Length * 3) / 4;
        const sizeInMB = sizeInBytes / (1024 * 1024);
        
        if (sizeInMB > 5) {
          return res.status(400).json({
            success: false,
            error: 'Image size must be less than 5MB'
          });
        }
        
        console.log('📸 Custom picture upload:', {
          userId: req.user.id,
          isBase64: true,
          sizeInMB: sizeInMB.toFixed(2),
          timestamp: new Date().toISOString()
        });
      }
    }

    // Validate denomination length
    if (denomination && denomination.length > 100) {
      return res.status(400).json({ 
        success: false,
        error: 'Denomination must be 100 characters or less' 
      });
    }

    // Validate bible version length
    if (bibleVersion && bibleVersion.length > 50) {
      return res.status(400).json({ 
        success: false,
        error: 'Bible version must be 50 characters or less' 
      });
    }

    // Validate age group length only (allow any value including "Not specified")
    if (ageGroup && ageGroup.length > 20) {
      return res.status(400).json({ 
        success: false,
        error: 'Age group must be 20 characters or less' 
      });
    }

    // Validate referral source length
    if (referralSource && referralSource.length > 100) {
      return res.status(400).json({ 
        success: false,
        error: 'Referral source must be 100 characters or less' 
      });
    }

    // Build dynamic UPDATE query based on provided fields
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramCount}`);
      updateValues.push(name ? name.trim() : null);
      paramCount++;
    }

    if (picture !== undefined) {
      updateFields.push(`picture = $${paramCount}`);
      updateValues.push(picture ? picture.trim() : null);
      paramCount++;
    }
    
    if (customPicture !== undefined) {
      updateFields.push(`custom_picture = $${paramCount}`);
      updateValues.push(customPicture ? customPicture : null);
      paramCount++;
      
      console.log('🖼️ Updating custom picture:', {
        userId: req.user.id,
        hasCustomPicture: !!customPicture,
        isBase64: customPicture?.startsWith('data:image/'),
        timestamp: new Date().toISOString()
      });
    }

    if (denomination !== undefined) {
      updateFields.push(`denomination = $${paramCount}`);
      updateValues.push(denomination ? denomination.trim() : null);
      paramCount++;
    }

    if (bibleVersion !== undefined) {
      updateFields.push(`bible_version = $${paramCount}`);
      updateValues.push(bibleVersion ? bibleVersion.trim() : null);
      paramCount++;
    }

    if (ageGroup !== undefined) {
      updateFields.push(`age_group = $${paramCount}`);
      updateValues.push(ageGroup || null);
      paramCount++;
    }

    if (referralSource !== undefined) {
      updateFields.push(`referral_source = $${paramCount}`);
      updateValues.push(referralSource ? referralSource.trim() : null);
      paramCount++;
    }

    if (bibleAnswers !== undefined) {
      updateFields.push(`bible_answers = $${paramCount}`);
      updateValues.push(bibleAnswers ? bibleAnswers.trim() : null);
      paramCount++;
    }

    if (bibleSpecific !== undefined) {
      updateFields.push(`bible_specific = $${paramCount}`);
      updateValues.push(bibleSpecific ? bibleSpecific.trim() : null);
      paramCount++;
    }

    // Always update the updated_at timestamp
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updateFields.length === 1) { // Only updated_at
      return res.status(400).json({ 
        success: false,
        error: 'At least one field must be provided for update' 
      });
    }

    updateValues.push(req.user.id);

    const result = await pool.query(
      `UPDATE users 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramCount} 
       RETURNING id, email, name, picture, google_meet_access, denomination, 
                 bible_version, age_group, referral_source, bible_answers, 
                 bible_specific, profile_completed, created_at, updated_at`,
      updateValues
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    // Check if profile is now complete and update status if needed
    const user = result.rows[0];
    const isComplete = isProfileComplete(user);
    
    if (isComplete && !user.profile_completed) {
      await pool.query(
        'UPDATE users SET profile_completed = true WHERE id = $1',
        [req.user.id]
      );
      user.profile_completed = true;
    }

    console.log('✅ User profile updated successfully:', {
      userId: req.user.id,
      name: user.name,
      profileCompleted: user.profile_completed,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: user
    });
  } catch (error) {
    console.error('❌ Update profile error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update profile',
      message: error.message 
    });
  }
});

// Update user email
router.put('/email', authenticateToken, async (req, res) => {
  console.log('📧 Update User Email Request:', {
    userId: req.user.id,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  try {
    const { email } = req.body;

    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({ 
        success: false,
        error: 'Valid email address is required' 
      });
    }

    // Check if email already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email, req.user.id]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Email address is already in use' 
      });
    }

    const result = await pool.query(
      'UPDATE users SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, name, picture, denomination, bible_version, age_group, referral_source, bible_answers, bible_specific',
      [email, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    console.log('✅ User email updated successfully:', {
      userId: req.user.id,
      email: email,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Email updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Update email error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update email',
      message: error.message 
    });
  }
});

// Update user preferences (denomination, bible version, age group, etc.)
router.put('/preferences', authenticateToken, async (req, res) => {
  console.log('⚙️ Update User Preferences Request:', {
    userId: req.user.id,
    email: req.user.email,
    body: req.body,
    hasVoiceId: !!req.body.voiceId,
    hasVoiceName: !!req.body.voiceName,
    hasBibleVersion: !!req.body.bibleVersion,
    hasDenomination: !!req.body.denomination,
    timestamp: new Date().toISOString()
  });

  try {
    const { 
      denomination, 
      bibleVersion, 
      ageGroup, 
      referralSource, 
      bibleAnswers, 
      bibleSpecific,
      voiceId,
      voiceName,
      pushToken,
      notificationSettings
    } = req.body;

    // Validate denomination length
    if (denomination && denomination.length > 100) {
      return res.status(400).json({ 
        success: false,
        error: 'Denomination must be 100 characters or less' 
      });
    }

    // Validate bible version length
    if (bibleVersion && bibleVersion.length > 50) {
      return res.status(400).json({ 
        success: false,
        error: 'Bible version must be 50 characters or less' 
      });
    }

    // Validate age group length only (allow any value including "Not specified")
    if (ageGroup && ageGroup.length > 20) {
      return res.status(400).json({ 
        success: false,
        error: 'Age group must be 20 characters or less' 
      });
    }

    // Validate referral source length
    if (referralSource && referralSource.length > 100) {
      return res.status(400).json({ 
        success: false,
        error: 'Referral source must be 100 characters or less' 
      });
    }

    // Validate voice ID length
    if (voiceId && voiceId.length > 200) {
      return res.status(400).json({ 
        success: false,
        error: 'Voice ID must be 200 characters or less' 
      });
    }

    // Validate voice name length
    if (voiceName && voiceName.length > 100) {
      return res.status(400).json({ 
        success: false,
        error: 'Voice name must be 100 characters or less' 
      });
    }

    // Validate push token format (must be Expo push token)
    if (pushToken !== undefined && pushToken !== null && pushToken.trim().length > 0) {
      if (!pushToken.startsWith('ExponentPushToken[')) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid push token format. Must be an Expo push token.' 
        });
      }
      
      if (pushToken.length > 255) {
        return res.status(400).json({ 
          success: false,
          error: 'Push token must be 255 characters or less' 
        });
      }
    }

    // Validate notification settings structure
    if (notificationSettings !== undefined) {
      if (typeof notificationSettings !== 'object') {
        return res.status(400).json({ 
          success: false,
          error: 'Notification settings must be an object' 
        });
      }
      
      // Validate boolean fields if provided
      const validKeys = ['pushEnabled', 'journeyReminders', 'prayerUpdates'];
      const providedKeys = Object.keys(notificationSettings);
      
      for (const key of providedKeys) {
        if (!validKeys.includes(key)) {
          return res.status(400).json({ 
            success: false,
            error: `Invalid notification setting: ${key}. Valid keys are: ${validKeys.join(', ')}` 
          });
        }
        
        if (typeof notificationSettings[key] !== 'boolean') {
          return res.status(400).json({ 
            success: false,
            error: `Notification setting '${key}' must be a boolean value` 
          });
        }
      }
    }

    // Build dynamic UPDATE query based on provided fields
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (denomination !== undefined) {
      updateFields.push(`denomination = $${paramCount}`);
      updateValues.push(denomination ? denomination.trim() : null);
      paramCount++;
    }

    if (bibleVersion !== undefined) {
      updateFields.push(`bible_version = $${paramCount}`);
      updateValues.push(bibleVersion ? bibleVersion.trim() : null);
      paramCount++;
    }

    if (ageGroup !== undefined) {
      updateFields.push(`age_group = $${paramCount}`);
      updateValues.push(ageGroup || null);
      paramCount++;
    }

    if (referralSource !== undefined) {
      updateFields.push(`referral_source = $${paramCount}`);
      updateValues.push(referralSource ? referralSource.trim() : null);
      paramCount++;
    }

    if (bibleAnswers !== undefined) {
      updateFields.push(`bible_answers = $${paramCount}`);
      updateValues.push(bibleAnswers ? bibleAnswers.trim() : null);
      paramCount++;
    }

    if (bibleSpecific !== undefined) {
      updateFields.push(`bible_specific = $${paramCount}`);
      updateValues.push(bibleSpecific ? bibleSpecific.trim() : null);
      paramCount++;
    }

    if (voiceId !== undefined) {
      updateFields.push(`voice_id = $${paramCount}`);
      updateValues.push(voiceId ? voiceId.trim() : null);
      console.log('🎤 Voice ID update:', {
        userId: req.user.id,
        email: req.user.email,
        newVoiceId: voiceId ? voiceId.trim() : null,
        timestamp: new Date().toISOString()
      });
      paramCount++;
    }

    if (voiceName !== undefined) {
      updateFields.push(`voice_name = $${paramCount}`);
      updateValues.push(voiceName ? voiceName.trim() : null);
      console.log('🎤 Voice Name update:', {
        userId: req.user.id,
        email: req.user.email,
        newVoiceName: voiceName ? voiceName.trim() : null,
        timestamp: new Date().toISOString()
      });
      paramCount++;
    }

    if (pushToken !== undefined) {
      updateFields.push(`push_token = $${paramCount}`);
      updateValues.push(pushToken && pushToken.trim().length > 0 ? pushToken.trim() : null);
      console.log('📱 Push Token update:', {
        userId: req.user.id,
        email: req.user.email,
        hasPushToken: !!(pushToken && pushToken.trim().length > 0),
        tokenPreview: pushToken ? pushToken.substring(0, 30) + '...' : null,
        timestamp: new Date().toISOString()
      });
      paramCount++;
    }

    if (notificationSettings !== undefined) {
      updateFields.push(`notification_settings = $${paramCount}`);
      updateValues.push(notificationSettings ? JSON.stringify(notificationSettings) : null);
      console.log('🔔 Notification Settings update:', {
        userId: req.user.id,
        email: req.user.email,
        settings: notificationSettings,
        timestamp: new Date().toISOString()
      });
      paramCount++;
    }

    // Always update the updated_at timestamp
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updateFields.length === 1) { // Only updated_at
      return res.status(400).json({ 
        success: false,
        error: 'At least one field must be provided for update' 
      });
    }

    updateValues.push(req.user.id);

    const result = await pool.query(
      `UPDATE users 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramCount} 
       RETURNING id, email, name, denomination, bible_version, age_group, 
                 referral_source, bible_answers, bible_specific, voice_id, voice_name, 
                 push_token, notification_settings, profile_completed, updated_at`,
      updateValues
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    // Check if profile is now complete and update status if needed
    const user = result.rows[0];
    const isComplete = isProfileComplete(user);
    
    if (isComplete && !user.profile_completed) {
      await pool.query(
        'UPDATE users SET profile_completed = true WHERE id = $1',
        [req.user.id]
      );
      user.profile_completed = true;
    }

    console.log('✅ User preferences updated successfully:', {
      userId: req.user.id,
      updatedFields: updateFields,
      voiceId: user.voice_id,
      voiceName: user.voice_name,
      bibleVersion: user.bible_version,
      denomination: user.denomination,
      ageGroup: user.age_group,
      hasPushToken: !!user.push_token,
      notificationSettings: user.notification_settings,
      profileCompleted: user.profile_completed,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      user: user
    });
  } catch (error) {
    console.error('❌ Update preferences error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update preferences',
      message: error.message 
    });
  }
});

// Update Google Meet access
router.put('/google-meet-access', authenticateToken, async (req, res) => {
  console.log('🔗 Update Google Meet Access Request:', {
    userId: req.user.id,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  try {
    const { googleMeetAccess } = req.body;

    if (typeof googleMeetAccess !== 'boolean') {
      return res.status(400).json({ 
        success: false,
        error: 'Google Meet access must be a boolean value' 
      });
    }

    const result = await pool.query(
      'UPDATE users SET google_meet_access = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, name, google_meet_access, denomination, bible_version, age_group, referral_source, bible_answers, bible_specific',
      [googleMeetAccess, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    console.log('✅ Google Meet access updated successfully:', {
      userId: req.user.id,
      googleMeetAccess: googleMeetAccess,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Google Meet access updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Update Google Meet access error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update Google Meet access',
      message: error.message 
    });
  }
});

// Check profile completion status
router.get('/profile-completion', authenticateToken, async (req, res) => {
  console.log('📋 Check Profile Completion Request:', {
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;

    // Get user profile info
    const userResult = await pool.query(
      'SELECT denomination, bible_version, age_group, referral_source, bible_answers, bible_specific, profile_completed FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    const user = userResult.rows[0];
    const isComplete = isProfileComplete(user);
    
    // Update profile_completed status if it's out of sync
    if (isComplete !== user.profile_completed) {
      await pool.query(
        'UPDATE users SET profile_completed = $1 WHERE id = $2',
        [isComplete, userId]
      );
    }

    // Get missing fields
    const requiredFields = [
      'denomination',
      'bible_version', 
      'age_group',
      'referral_source',
      'bible_answers',
      'bible_specific'
    ];
    
    const missingFields = requiredFields.filter(field => {
      const value = user[field];
      return !value || value.trim() === '' || value === 'Not specified';
    });

    console.log('✅ Profile completion status retrieved:', {
      userId: userId,
      isComplete: isComplete,
      missingFields: missingFields,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        isComplete: isComplete,
        profileCompleted: isComplete,
        missingFields: missingFields,
        requiredFields: requiredFields,
        user: {
          denomination: user.denomination,
          bibleVersion: user.bible_version,
          ageGroup: user.age_group,
          referralSource: user.referral_source,
          bibleAnswers: user.bible_answers,
          bibleSpecific: user.bible_specific
        }
      }
    });
  } catch (error) {
    console.error('❌ Check profile completion error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to check profile completion',
      message: error.message 
    });
  }
});

// Get user statistics
router.get('/stats', authenticateToken, async (req, res) => {
  console.log('📊 Get User Stats Request:', {
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;

    // Get user profile info
    const userResult = await pool.query(
      'SELECT id, email, name, picture, google_meet_access, denomination, bible_version, age_group, referral_source, bible_answers, bible_specific, profile_completed, created_at, updated_at FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    // Get daily activity stats
    const activityResult = await pool.query(
      `SELECT 
         COALESCE(SUM(verses_read), 0) as total_verses_read,
         COALESCE(SUM(prayers_said), 0) as total_prayers_said,
         COALESCE(SUM(reflections_completed), 0) as total_reflections_completed,
         COALESCE(SUM(study_hours), 0) as total_study_hours,
         COALESCE(SUM(notes_created), 0) as total_notes_created,
         COUNT(*) as active_days
       FROM user_daily_activities 
       WHERE user_id = $1`,
      [userId]
    );

    // Get prayer notes count
    const notesResult = await pool.query(
      'SELECT COUNT(*) as total_notes FROM user_prayer_notes WHERE user_id = $1',
      [userId]
    );

    // Get study groups count
    const groupsResult = await pool.query(
      'SELECT COUNT(*) as total_groups FROM study_groups WHERE owner_id = $1',
      [userId]
    );

    // Get current streak
    const streakResult = await pool.query(
      `WITH daily_activities AS (
         SELECT activity_date
         FROM user_daily_activities 
         WHERE user_id = $1
         ORDER BY activity_date DESC
       ),
       streaks AS (
         SELECT activity_date,
                ROW_NUMBER() OVER (ORDER BY activity_date DESC) - 
                ROW_NUMBER() OVER (PARTITION BY activity_date - (ROW_NUMBER() OVER (ORDER BY activity_date DESC) * INTERVAL '1 day') ORDER BY activity_date DESC) as streak_group
         FROM daily_activities
       )
       SELECT COUNT(*) as current_streak
       FROM streaks 
       WHERE streak_group = 0`,
      [userId]
    );

    console.log('✅ User stats retrieved successfully:', {
      userId: userId,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        profile: userResult.rows[0],
        activities: {
          totalVersesRead: parseInt(activityResult.rows[0].total_verses_read),
          totalPrayersSaid: parseInt(activityResult.rows[0].total_prayers_said),
          totalReflectionsCompleted: parseInt(activityResult.rows[0].total_reflections_completed),
          totalStudyHours: parseFloat(activityResult.rows[0].total_study_hours),
          totalNotesCreated: parseInt(activityResult.rows[0].total_notes_created),
          activeDays: parseInt(activityResult.rows[0].active_days)
        },
        content: {
          totalPrayerNotes: parseInt(notesResult.rows[0].total_notes),
          totalStudyGroups: parseInt(groupsResult.rows[0].total_groups)
        },
        currentStreak: parseInt(streakResult.rows[0].current_streak) || 0
      }
    });
  } catch (error) {
    console.error('❌ Get user stats error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to retrieve user statistics',
      message: error.message 
    });
  }
});

// Delete user account (GDPR-compliant hard delete)
router.delete('/account', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const userEmail = req.user.email;
  
  console.log('🗑️ Delete User Account Request:', {
    userId,
    email: userEmail,
    timestamp: new Date().toISOString()
  });

  const client = await pool.connect();
  
  try {
    // Start transaction to ensure all-or-nothing deletion
    await client.query('BEGIN');

    // 1. Revoke Google Calendar tokens if they exist
    try {
      const userTokens = await client.query(
        'SELECT google_refresh_token FROM users WHERE id = $1',
        [userId]
      );
      
      if (userTokens.rows.length > 0 && userTokens.rows[0].google_refresh_token) {
        const { OAuth2Client } = require('google-auth-library');
        const oauth2Client = new OAuth2Client(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        
        try {
          await oauth2Client.revokeToken(userTokens.rows[0].google_refresh_token);
          console.log('✅ Google Calendar tokens revoked');
        } catch (revokeError) {
          console.warn('⚠️ Could not revoke Google tokens (may be already revoked):', revokeError.message);
          // Continue with deletion even if token revocation fails
        }
      }
    } catch (tokenError) {
      console.warn('⚠️ Error during token revocation:', tokenError.message);
      // Continue with deletion
    }

    // 2. Delete Prayer Data
    // Delete prayer responses (includes nested replies via CASCADE)
    const prayerResponsesResult = await client.query(
      'DELETE FROM prayer_responses WHERE user_id = $1',
      [userId]
    );
    console.log(`🗑️ Deleted ${prayerResponsesResult.rowCount} prayer responses`);

    // Delete prayer requests
    const prayerRequestsResult = await client.query(
      'DELETE FROM prayer_requests WHERE user_id = $1',
      [userId]
    );
    console.log(`🗑️ Deleted ${prayerRequestsResult.rowCount} prayer requests`);

    // 3. Delete Study Groups Data
    // Delete study groups created by user (CASCADE will handle members and join requests)
    const studyGroupsResult = await client.query(
      'DELETE FROM study_groups WHERE creator_id = $1',
      [userId]
    );
    console.log(`🗑️ Deleted ${studyGroupsResult.rowCount} study groups`);

    // Remove user from study groups they joined
    const membershipResult = await client.query(
      'DELETE FROM study_group_members WHERE user_id = $1',
      [userId]
    );
    console.log(`🗑️ Removed from ${membershipResult.rowCount} study groups`);

    // Delete study group join requests
    const joinRequestsResult = await client.query(
      'DELETE FROM study_group_join_requests WHERE user_id = $1',
      [userId]
    );
    console.log(`🗑️ Deleted ${joinRequestsResult.rowCount} join requests`);

    // 4. Delete Activity & Engagement Data
    // Delete XP data
    const xpResult = await client.query(
      'DELETE FROM user_xp WHERE user_id = $1',
      [userId]
    );
    console.log(`🗑️ Deleted XP data: ${xpResult.rowCount} records`);

    // Delete daily goals
    const goalsResult = await client.query(
      'DELETE FROM user_daily_goals WHERE user_id = $1',
      [userId]
    );
    console.log(`🗑️ Deleted ${goalsResult.rowCount} daily goals records`);

    // Delete activities log
    const activitiesLogResult = await client.query(
      'DELETE FROM user_activities_log WHERE user_id = $1',
      [userId]
    );
    console.log(`🗑️ Deleted ${activitiesLogResult.rowCount} activity log entries`);

    // Delete daily activities
    const dailyActivitiesResult = await client.query(
      'DELETE FROM user_daily_activities WHERE user_id = $1',
      [userId]
    );
    console.log(`🗑️ Deleted ${dailyActivitiesResult.rowCount} daily activity records`);

    // Delete usage stats
    const usageStatsResult = await client.query(
      'DELETE FROM user_usage_stats WHERE user_id = $1',
      [userId]
    );
    console.log(`🗑️ Deleted usage stats: ${usageStatsResult.rowCount} records`);

    // Delete streaks
    const streaksResult = await client.query(
      'DELETE FROM user_streaks WHERE user_id = $1',
      [userId]
    );
    console.log(`🗑️ Deleted streaks: ${streaksResult.rowCount} records`);

    // Delete streak milestones
    const milestonesResult = await client.query(
      'DELETE FROM streak_milestones WHERE user_id = $1',
      [userId]
    );
    console.log(`🗑️ Deleted ${milestonesResult.rowCount} milestone records`);

    // Delete user sessions
    const sessionsResult = await client.query(
      'DELETE FROM user_sessions WHERE user_id = $1',
      [userId]
    );
    console.log(`🗑️ Deleted ${sessionsResult.rowCount} user sessions`);

    // 5. Delete Bible Study History
    // Delete prayer history
    const prayerHistoryResult = await client.query(
      'DELETE FROM user_prayer_history WHERE user_id = $1',
      [userId]
    );
    console.log(`🗑️ Deleted ${prayerHistoryResult.rowCount} prayer history records`);

    // Delete reflection history
    const reflectionHistoryResult = await client.query(
      'DELETE FROM user_reflection_history WHERE user_id = $1',
      [userId]
    );
    console.log(`🗑️ Deleted ${reflectionHistoryResult.rowCount} reflection history records`);

    // Delete verse history
    const verseHistoryResult = await client.query(
      'DELETE FROM user_verse_history WHERE user_id = $1',
      [userId]
    );
    console.log(`🗑️ Deleted ${verseHistoryResult.rowCount} verse history records`);

    // Delete weekly study plans
    const studyPlansResult = await client.query(
      'DELETE FROM user_weekly_study_plans WHERE user_id = $1',
      [userId]
    );
    console.log(`🗑️ Deleted ${studyPlansResult.rowCount} study plans`);

    // 6. Delete Prayer Notes
    const notesResult = await client.query(
      'DELETE FROM user_prayer_notes WHERE user_id = $1',
      [userId]
    );
    console.log(`🗑️ Deleted ${notesResult.rowCount} prayer notes`);

    // 7. Delete User Account (main record)
    // This will cascade delete any remaining related data with CASCADE constraints
    const userResult = await client.query(
      'DELETE FROM users WHERE id = $1 RETURNING email',
      [userId]
    );

    if (userResult.rowCount === 0) {
      throw new Error('User not found');
    }

    console.log(`🗑️ Deleted user account: ${userResult.rows[0].email}`);

    // Commit transaction
    await client.query('COMMIT');

    console.log('✅ User account deleted successfully:', {
      userId,
      email: userEmail,
      timestamp: new Date().toISOString()
    });

    res.json({ 
      success: true, 
      message: 'Account deleted successfully' 
    });
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    
    console.error('❌ Delete account error:', {
      userId,
      email: userEmail,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({ 
      success: false,
      message: 'Failed to delete account'
    });
  } finally {
    client.release();
  }
});

// POST /api/users/profile/picture - Upload or update profile picture
router.post('/profile/picture', authenticateToken, async (req, res) => {
  console.log('📸 Upload Profile Picture Request:', {
    userId: req.user.id,
    email: req.user.email,
    timestamp: new Date().toISOString()
  });

  try {
    const { picture, useGooglePicture } = req.body;

    // If user wants to revert to Google picture
    if (useGooglePicture === true) {
      console.log('🔄 Reverting to Google picture:', {
        userId: req.user.id
      });

      await pool.query(
        `UPDATE users 
         SET custom_picture = NULL, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [req.user.id]
      );

      // Get the Google picture
      const result = await pool.query(
        'SELECT google_picture, picture FROM users WHERE id = $1',
        [req.user.id]
      );

      const googlePicture = result.rows[0]?.google_picture || result.rows[0]?.picture;

      console.log('✅ Reverted to Google picture successfully');

      return res.json({
        success: true,
        message: 'Reverted to Google profile picture',
        picture: googlePicture
      });
    }

    // Validate that picture is provided
    if (!picture || picture.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Picture data is required'
      });
    }

    // Validate picture format (base64 or URL)
    if (!picture.startsWith('data:image/') && !picture.startsWith('http')) {
      return res.status(400).json({
        success: false,
        error: 'Picture must be a valid base64 image or URL'
      });
    }

    // Validate base64 image size (max 5MB)
    if (picture.startsWith('data:image/')) {
      const base64Length = picture.length - (picture.indexOf(',') + 1);
      const sizeInBytes = (base64Length * 3) / 4;
      const sizeInMB = sizeInBytes / (1024 * 1024);

      if (sizeInMB > 5) {
        return res.status(400).json({
          success: false,
          error: 'Image size must be less than 5MB',
          actualSize: `${sizeInMB.toFixed(2)}MB`
        });
      }

      console.log('📊 Image size:', {
        userId: req.user.id,
        sizeInMB: sizeInMB.toFixed(2),
        format: picture.substring(11, picture.indexOf(';'))
      });
    }

    // Update custom picture in database
    const result = await pool.query(
      `UPDATE users 
       SET custom_picture = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING id, email, name, custom_picture, google_picture, picture`,
      [picture, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = result.rows[0];

    console.log('✅ Profile picture uploaded successfully:', {
      userId: user.id,
      hasCustomPicture: !!user.custom_picture,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Profile picture updated successfully',
      picture: user.custom_picture,
      hasCustomPicture: true,
      hasGooglePicture: !!user.google_picture
    });

  } catch (error) {
    console.error('❌ Upload profile picture error:', {
      userId: req.user.id,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      error: 'Failed to upload profile picture',
      message: error.message
    });
  }
});

// DELETE /api/users/profile/picture - Remove custom profile picture
router.delete('/profile/picture', authenticateToken, async (req, res) => {
  console.log('🗑️ Delete Custom Profile Picture Request:', {
    userId: req.user.id,
    email: req.user.email,
    timestamp: new Date().toISOString()
  });

  try {
    const result = await pool.query(
      `UPDATE users 
       SET custom_picture = NULL, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING id, google_picture, picture`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = result.rows[0];
    const fallbackPicture = user.google_picture || user.picture;

    console.log('✅ Custom profile picture deleted:', {
      userId: user.id,
      hasGooglePicture: !!user.google_picture,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Custom profile picture removed',
      picture: fallbackPicture,
      hasCustomPicture: false,
      hasGooglePicture: !!user.google_picture
    });

  } catch (error) {
    console.error('❌ Delete profile picture error:', {
      userId: req.user.id,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      error: 'Failed to delete profile picture',
      message: error.message 
    });
  }
});

module.exports = router;
