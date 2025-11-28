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
      `SELECT id, email, name, picture, google_meet_access, denomination, bible_version, age_group, 
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

    console.log('✅ User profile retrieved successfully:', {
      userId: req.user.id,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      user: result.rows[0]
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
      voiceName
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
                 profile_completed, updated_at`,
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

// Delete user account
router.delete('/account', authenticateToken, async (req, res) => {
  console.log('🗑️ Delete User Account Request:', {
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });

  try {
    // Delete user and all related data (cascade will handle related tables)
    await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);

    console.log('✅ User account deleted successfully:', {
      userId: req.user.id,
      timestamp: new Date().toISOString()
    });

    res.json({ 
      success: true, 
      message: 'Account deleted successfully' 
    });
  } catch (error) {
    console.error('❌ Delete account error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete account',
      message: error.message 
    });
  }
});

module.exports = router;
