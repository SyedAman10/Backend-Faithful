const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all prayer requests (public feed)
router.get('/requests', authenticateToken, async (req, res) => {
  console.log('🙏 Get Prayer Requests Request:', {
    userId: req.user.id,
    query: req.query,
    timestamp: new Date().toISOString()
  });

  try {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      status = 'Active',
      sort = 'newest',
      search 
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = ['pr.is_public = true'];
    let queryParams = [];
    let paramCount = 1;

    // Add category filter
    if (category && category !== 'all') {
      whereConditions.push(`pr.category = $${paramCount}`);
      queryParams.push(category);
      paramCount++;
    }

    // Add status filter
    if (status && status !== 'all') {
      whereConditions.push(`pr.status = $${paramCount}`);
      queryParams.push(status);
      paramCount++;
    }

    // Add search filter
    if (search) {
      whereConditions.push(`(pr.title ILIKE $${paramCount} OR pr.description ILIKE $${paramCount})`);
      queryParams.push(`%${search}%`);
      paramCount++;
    }

    // Add sorting
    let orderBy = 'pr.created_at DESC';
    if (sort === 'oldest') {
      orderBy = 'pr.created_at ASC';
    } else if (sort === 'prayers') {
      orderBy = 'pr.prayer_count DESC, pr.created_at DESC';
    } else if (sort === 'urgent') {
      orderBy = 'pr.is_urgent DESC, pr.created_at DESC';
    }

    // Add pagination params
    queryParams.push(parseInt(limit), parseInt(offset));
    const limitParam = paramCount;
    const offsetParam = paramCount + 1;

    const result = await pool.query(
      `SELECT 
         pr.*,
         u.id as author_id,
         u.name as author_name,
         u.email as author_email,
         u.picture as author_picture,
         u.denomination as author_denomination,
         u.bible_version as author_bible_version,
         u.age_group as author_age_group,
         CASE 
           WHEN pr.is_anonymous = true THEN 'Anonymous'
           ELSE u.name 
         END as display_name,
         CASE 
           WHEN pr.is_anonymous = true THEN NULL
           ELSE u.picture 
         END as display_picture,
         CASE 
           WHEN pr.is_anonymous = true THEN NULL
           ELSE u.denomination 
         END as display_denomination,
         CASE 
           WHEN pr.is_anonymous = true THEN NULL
           ELSE u.age_group 
         END as display_age_group
       FROM prayer_requests pr
       INNER JOIN users u ON pr.user_id = u.id
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      queryParams
    );

    // Get total count for pagination
    const countResult = await pool.query(
      `SELECT COUNT(*) as total
       FROM prayer_requests pr
       WHERE ${whereConditions.join(' AND ')}`,
      queryParams.slice(0, -2) // Remove limit and offset
    );

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    console.log('✅ Prayer requests retrieved successfully:', {
      userId: req.user.id,
      count: result.rows.length,
      total: total,
      page: page,
      totalPages: totalPages,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        requests: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('❌ Get prayer requests error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve prayer requests',
      message: error.message
    });
  }
});

// Get single prayer request with responses
router.get('/requests/:id', authenticateToken, async (req, res) => {
  console.log('🙏 Get Single Prayer Request:', {
    userId: req.user.id,
    requestId: req.params.id,
    timestamp: new Date().toISOString()
  });

  try {
    const requestId = parseInt(req.params.id);

    if (isNaN(requestId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid prayer request ID'
      });
    }

    // Get prayer request
    const requestResult = await pool.query(
      `SELECT 
         pr.*,
         u.id as author_id,
         u.name as author_name,
         u.email as author_email,
         u.picture as author_picture,
         u.denomination as author_denomination,
         u.bible_version as author_bible_version,
         u.age_group as author_age_group,
         CASE 
           WHEN pr.is_anonymous = true THEN 'Anonymous'
           ELSE u.name 
         END as display_name,
         CASE 
           WHEN pr.is_anonymous = true THEN NULL
           ELSE u.picture 
         END as display_picture,
         CASE 
           WHEN pr.is_anonymous = true THEN NULL
           ELSE u.denomination 
         END as display_denomination,
         CASE 
           WHEN pr.is_anonymous = true THEN NULL
           ELSE u.age_group 
         END as display_age_group
       FROM prayer_requests pr
       INNER JOIN users u ON pr.user_id = u.id
       WHERE pr.id = $1 AND pr.is_public = true`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Prayer request not found'
      });
    }

    // Get all responses (including nested replies)
    const responsesResult = await pool.query(
      `SELECT 
         pr.*,
         u.id as responder_id,
         u.name as responder_name,
         u.email as responder_email,
         u.picture as responder_picture,
         u.denomination as responder_denomination,
         u.bible_version as responder_bible_version,
         u.age_group as responder_age_group,
         CASE 
           WHEN pr.is_anonymous = true THEN 'Anonymous'
           ELSE u.name 
         END as display_name,
         CASE 
           WHEN pr.is_anonymous = true THEN NULL
           ELSE u.picture 
         END as display_picture,
         CASE 
           WHEN pr.is_anonymous = true THEN NULL
           ELSE u.denomination 
         END as display_denomination,
         CASE 
           WHEN pr.is_anonymous = true THEN NULL
           ELSE u.age_group 
         END as display_age_group
       FROM prayer_responses pr
       INNER JOIN users u ON pr.user_id = u.id
       WHERE pr.prayer_request_id = $1
       ORDER BY 
         CASE WHEN pr.parent_response_id IS NULL THEN pr.created_at END ASC,
         pr.parent_response_id ASC,
         pr.created_at ASC`,
      [requestId]
    );

    // Organize responses into nested structure
    const responses = responsesResult.rows;
    const responseMap = new Map();
    const topLevelResponses = [];

    // First pass: create map of all responses
    responses.forEach(response => {
      response.replies = [];
      responseMap.set(response.id, response);
    });

    // Second pass: organize into nested structure
    responses.forEach(response => {
      if (response.parent_response_id) {
        // This is a reply to another response
        const parentResponse = responseMap.get(response.parent_response_id);
        if (parentResponse) {
          parentResponse.replies.push(response);
        }
      } else {
        // This is a top-level response
        topLevelResponses.push(response);
      }
    });

    console.log('✅ Prayer request retrieved successfully:', {
      userId: req.user.id,
      requestId: requestId,
      totalResponses: responsesResult.rows.length,
      topLevelResponses: topLevelResponses.length,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        request: requestResult.rows[0],
        responses: topLevelResponses
      }
    });

  } catch (error) {
    console.error('❌ Get prayer request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve prayer request',
      message: error.message
    });
  }
});

// Create prayer request
router.post('/requests', authenticateToken, async (req, res) => {
  console.log('🙏 Create Prayer Request:', {
    userId: req.user.id,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  try {
    const {
      title,
      description,
      category = 'General',
      isAnonymous = false,
      isUrgent = false,
      isPublic = true
    } = req.body;

    // Validate required fields
    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Title is required'
      });
    }

    if (!description || description.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Description is required'
      });
    }

    // Validate title length
    if (title.length > 255) {
      return res.status(400).json({
        success: false,
        error: 'Title must be 255 characters or less'
      });
    }

    // Validate category
    const validCategories = [
      'General', 'Health', 'Family', 'Work', 'Relationships', 
      'Spiritual Growth', 'Financial', 'Emotional', 'Other'
    ];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category. Must be one of: ' + validCategories.join(', ')
      });
    }

    const result = await pool.query(
      `INSERT INTO prayer_requests 
       (user_id, title, description, category, is_anonymous, is_urgent, is_public, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [req.user.id, title.trim(), description.trim(), category, isAnonymous, isUrgent, isPublic]
    );

    console.log('✅ Prayer request created successfully:', {
      userId: req.user.id,
      requestId: result.rows[0].id,
      title: result.rows[0].title,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      message: 'Prayer request created successfully',
      data: {
        request: result.rows[0]
      }
    });

  } catch (error) {
    console.error('❌ Create prayer request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create prayer request',
      message: error.message
    });
  }
});

// Update prayer request
router.put('/requests/:id', authenticateToken, async (req, res) => {
  console.log('🙏 Update Prayer Request:', {
    userId: req.user.id,
    requestId: req.params.id,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  try {
    const requestId = parseInt(req.params.id);

    if (isNaN(requestId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid prayer request ID'
      });
    }

    const {
      title,
      description,
      category,
      isAnonymous,
      isUrgent,
      isPublic,
      status
    } = req.body;

    // Check if request exists and user owns it
    const existingRequest = await pool.query(
      'SELECT * FROM prayer_requests WHERE id = $1 AND user_id = $2',
      [requestId, req.user.id]
    );

    if (existingRequest.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Prayer request not found or you do not have permission to update it'
      });
    }

    // Build dynamic UPDATE query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (title !== undefined) {
      if (!title || title.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Title cannot be empty'
        });
      }
      if (title.length > 255) {
        return res.status(400).json({
          success: false,
          error: 'Title must be 255 characters or less'
        });
      }
      updateFields.push(`title = $${paramCount}`);
      updateValues.push(title.trim());
      paramCount++;
    }

    if (description !== undefined) {
      if (!description || description.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Description cannot be empty'
        });
      }
      updateFields.push(`description = $${paramCount}`);
      updateValues.push(description.trim());
      paramCount++;
    }

    if (category !== undefined) {
      const validCategories = [
        'General', 'Health', 'Family', 'Work', 'Relationships', 
        'Spiritual Growth', 'Financial', 'Emotional', 'Other'
      ];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid category. Must be one of: ' + validCategories.join(', ')
        });
      }
      updateFields.push(`category = $${paramCount}`);
      updateValues.push(category);
      paramCount++;
    }

    if (isAnonymous !== undefined) {
      updateFields.push(`is_anonymous = $${paramCount}`);
      updateValues.push(isAnonymous);
      paramCount++;
    }

    if (isUrgent !== undefined) {
      updateFields.push(`is_urgent = $${paramCount}`);
      updateValues.push(isUrgent);
      paramCount++;
    }

    if (isPublic !== undefined) {
      updateFields.push(`is_public = $${paramCount}`);
      updateValues.push(isPublic);
      paramCount++;
    }

    if (status !== undefined) {
      const validStatuses = ['Active', 'Answered', 'Closed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
        });
      }
      updateFields.push(`status = $${paramCount}`);
      updateValues.push(status);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one field must be provided for update'
      });
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(requestId);

    const result = await pool.query(
      `UPDATE prayer_requests 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      updateValues
    );

    console.log('✅ Prayer request updated successfully:', {
      userId: req.user.id,
      requestId: requestId,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Prayer request updated successfully',
      data: {
        request: result.rows[0]
      }
    });

  } catch (error) {
    console.error('❌ Update prayer request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update prayer request',
      message: error.message
    });
  }
});

// Delete prayer request
router.delete('/requests/:id', authenticateToken, async (req, res) => {
  console.log('🙏 Delete Prayer Request:', {
    userId: req.user.id,
    requestId: req.params.id,
    timestamp: new Date().toISOString()
  });

  try {
    const requestId = parseInt(req.params.id);

    if (isNaN(requestId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid prayer request ID'
      });
    }

    // Check if request exists and user owns it
    const existingRequest = await pool.query(
      'SELECT * FROM prayer_requests WHERE id = $1 AND user_id = $2',
      [requestId, req.user.id]
    );

    if (existingRequest.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Prayer request not found or you do not have permission to delete it'
      });
    }

    // Delete the request (responses will be deleted by CASCADE)
    await pool.query('DELETE FROM prayer_requests WHERE id = $1', [requestId]);

    console.log('✅ Prayer request deleted successfully:', {
      userId: req.user.id,
      requestId: requestId,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Prayer request deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete prayer request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete prayer request',
      message: error.message
    });
  }
});

// Add prayer response (pray for someone)
router.post('/requests/:id/respond', authenticateToken, async (req, res) => {
  console.log('🙏 Add Prayer Response:', {
    userId: req.user.id,
    requestId: req.params.id,
    body: req.body,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });

  try {
    const requestId = parseInt(req.params.id);

    if (isNaN(requestId)) {
      console.log('❌ Invalid request ID:', req.params.id);
      return res.status(400).json({
        success: false,
        error: 'Invalid prayer request ID'
      });
    }

    // Validate request body exists
    if (!req.body || typeof req.body !== 'object') {
      console.log('❌ Invalid request body:', req.body);
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        message: 'Request body must be a valid JSON object'
      });
    }

    const {
      responseType = 'prayer',
      message,
      isAnonymous = false
    } = req.body;

    console.log('🔍 Request body analysis:', {
      responseType: responseType,
      responseTypeType: typeof responseType,
      message: message,
      messageType: typeof message,
      isAnonymous: isAnonymous,
      isAnonymousType: typeof isAnonymous,
      rawBody: JSON.stringify(req.body)
    });

    // Validate response type (case-insensitive)
    const validTypes = ['prayer', 'encouragement', 'testimony', 'other'];
    const normalizedResponseType = responseType ? responseType.toLowerCase().trim() : 'prayer';
    
    console.log('🔍 Response type validation:', {
      originalResponseType: responseType,
      normalizedResponseType: normalizedResponseType,
      validTypes: validTypes,
      isValid: validTypes.includes(normalizedResponseType)
    });

    if (!validTypes.includes(normalizedResponseType)) {
      console.log('❌ Invalid response type:', {
        received: responseType,
        normalized: normalizedResponseType,
        validTypes: validTypes
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid response type',
        message: `Response type must be one of: ${validTypes.join(', ')}. Received: ${responseType}`,
        validTypes: validTypes
      });
    }

    // Validate message if provided
    if (message !== undefined && message !== null) {
      if (typeof message !== 'string') {
        console.log('❌ Invalid message type:', typeof message);
        return res.status(400).json({
          success: false,
          error: 'Invalid message type',
          message: 'Message must be a string'
        });
      }
      
      if (message.length > 1000) {
        console.log('❌ Message too long:', message.length);
        return res.status(400).json({
          success: false,
          error: 'Message too long',
          message: 'Message must be 1000 characters or less'
        });
      }
    }

    // Validate isAnonymous
    if (isAnonymous !== undefined && typeof isAnonymous !== 'boolean') {
      console.log('❌ Invalid isAnonymous type:', typeof isAnonymous);
      return res.status(400).json({
        success: false,
        error: 'Invalid isAnonymous type',
        message: 'isAnonymous must be a boolean value'
      });
    }

    // Check if prayer request exists and is public
    const prayerRequest = await pool.query(
      'SELECT * FROM prayer_requests WHERE id = $1 AND is_public = true',
      [requestId]
    );

    console.log('🔍 Prayer request check:', {
      requestId: requestId,
      found: prayerRequest.rows.length > 0,
      prayerRequest: prayerRequest.rows[0] || null
    });

    if (prayerRequest.rows.length === 0) {
      console.log('❌ Prayer request not found or not public');
      return res.status(404).json({
        success: false,
        error: 'Prayer request not found or not public'
      });
    }

    // Check if user already responded to this request (optional - for analytics)
    const existingResponse = await pool.query(
      'SELECT COUNT(*) as response_count FROM prayer_responses WHERE prayer_request_id = $1 AND user_id = $2',
      [requestId, req.user.id]
    );

    const userResponseCount = parseInt(existingResponse.rows[0].response_count);

    console.log('🔍 Existing response check:', {
      requestId: requestId,
      userId: req.user.id,
      userResponseCount: userResponseCount,
      note: 'Users can now send multiple responses'
    });

    // Create response
    console.log('🔍 Creating prayer response with data:', {
      requestId: requestId,
      userId: req.user.id,
      responseType: normalizedResponseType,
      message: message ? message.trim() : null,
      isAnonymous: isAnonymous
    });

    const result = await pool.query(
      `INSERT INTO prayer_responses 
       (prayer_request_id, user_id, parent_response_id, response_type, message, is_anonymous, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [requestId, req.user.id, null, normalizedResponseType, message ? message.trim() : null, isAnonymous]
    );

    console.log('✅ Prayer response created:', {
      responseId: result.rows[0].id,
      responseData: result.rows[0]
    });

    // Update prayer count
    await pool.query(
      'UPDATE prayer_requests SET response_count = response_count + 1 WHERE id = $1',
      [requestId]
    );

    console.log('✅ Prayer count updated for request:', requestId);

    console.log('✅ Prayer response added successfully:', {
      userId: req.user.id,
      requestId: requestId,
      responseId: result.rows[0].id,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      message: 'Prayer response added successfully',
      data: {
        response: result.rows[0]
      }
    });

  } catch (error) {
    console.error('❌ Add prayer response error:', {
      error: error.message,
      stack: error.stack,
      requestId: req.params.id,
      userId: req.user.id,
      body: req.body,
      timestamp: new Date().toISOString()
    });
    
    // Handle specific database errors
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        success: false,
        error: 'Duplicate response detected',
        message: 'A similar response already exists for this prayer request'
      });
    }
    
    if (error.code === '23503') { // Foreign key constraint violation
      return res.status(404).json({
        success: false,
        error: 'Prayer request not found',
        message: 'The prayer request you are trying to respond to does not exist'
      });
    }
    
    if (error.code === '23514') { // Check constraint violation
      return res.status(400).json({
        success: false,
        error: 'Invalid data provided',
        message: 'The response data does not meet the required constraints'
      });
    }
    
    // Generic error response
    res.status(500).json({
      success: false,
      error: 'Failed to add prayer response',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred'
    });
  }
});

// Reply to a prayer response (nested response)
router.post('/responses/:responseId/reply', authenticateToken, async (req, res) => {
  console.log('💬 Reply to Prayer Response:', {
    userId: req.user.id,
    responseId: req.params.responseId,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  try {
    const responseId = parseInt(req.params.responseId);

    if (isNaN(responseId)) {
      console.log('❌ Invalid response ID:', req.params.responseId);
      return res.status(400).json({
        success: false,
        error: 'Invalid response ID'
      });
    }

    // Validate request body exists
    if (!req.body || typeof req.body !== 'object') {
      console.log('❌ Invalid request body:', req.body);
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        message: 'Request body must be a valid JSON object'
      });
    }

    const {
      responseType = 'prayer',
      message,
      isAnonymous = false
    } = req.body;

    console.log('🔍 Reply request body analysis:', {
      responseType: responseType,
      responseTypeType: typeof responseType,
      message: message,
      messageType: typeof message,
      isAnonymous: isAnonymous,
      isAnonymousType: typeof isAnonymous,
      rawBody: JSON.stringify(req.body)
    });

    // Validate response type (case-insensitive)
    const validTypes = ['prayer', 'encouragement', 'testimony', 'other'];
    const normalizedResponseType = responseType ? responseType.toLowerCase().trim() : 'prayer';
    
    console.log('🔍 Response type validation:', {
      originalResponseType: responseType,
      normalizedResponseType: normalizedResponseType,
      validTypes: validTypes,
      isValid: validTypes.includes(normalizedResponseType)
    });

    if (!validTypes.includes(normalizedResponseType)) {
      console.log('❌ Invalid response type:', {
        received: responseType,
        normalized: normalizedResponseType,
        validTypes: validTypes
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid response type',
        message: `Response type must be one of: ${validTypes.join(', ')}. Received: ${responseType}`,
        validTypes: validTypes
      });
    }

    // Validate message if provided
    if (message !== undefined && message !== null) {
      if (typeof message !== 'string') {
        console.log('❌ Invalid message type:', typeof message);
        return res.status(400).json({
          success: false,
          error: 'Invalid message type',
          message: 'Message must be a string'
        });
      }
      
      if (message.length > 1000) {
        console.log('❌ Message too long:', message.length);
        return res.status(400).json({
          success: false,
          error: 'Message too long',
          message: 'Message must be 1000 characters or less'
        });
      }
    }

    // Validate isAnonymous
    if (isAnonymous !== undefined && typeof isAnonymous !== 'boolean') {
      console.log('❌ Invalid isAnonymous type:', typeof isAnonymous);
      return res.status(400).json({
        success: false,
        error: 'Invalid isAnonymous type',
        message: 'isAnonymous must be a boolean value'
      });
    }

    // Check if parent response exists and get prayer request info
    const parentResponseResult = await pool.query(
      `SELECT pr.*, prr.id as prayer_request_id, prr.is_public 
       FROM prayer_responses pr
       INNER JOIN prayer_requests prr ON pr.prayer_request_id = prr.id
       WHERE pr.id = $1`,
      [responseId]
    );

    console.log('🔍 Parent response check:', {
      responseId: responseId,
      found: parentResponseResult.rows.length > 0,
      parentResponse: parentResponseResult.rows[0] || null
    });

    if (parentResponseResult.rows.length === 0) {
      console.log('❌ Parent response not found');
      return res.status(404).json({
        success: false,
        error: 'Parent response not found'
      });
    }

    const parentResponse = parentResponseResult.rows[0];

    // Check if the prayer request is public
    if (!parentResponse.is_public) {
      console.log('❌ Prayer request is not public');
      return res.status(403).json({
        success: false,
        error: 'Cannot reply to responses on private prayer requests'
      });
    }

    // Create reply response
    console.log('🔍 Creating reply response with data:', {
      prayerRequestId: parentResponse.prayer_request_id,
      parentResponseId: responseId,
      userId: req.user.id,
      responseType: normalizedResponseType,
      message: message ? message.trim() : null,
      isAnonymous: isAnonymous
    });

    const result = await pool.query(
      `INSERT INTO prayer_responses 
       (prayer_request_id, user_id, parent_response_id, response_type, message, is_anonymous, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [parentResponse.prayer_request_id, req.user.id, responseId, normalizedResponseType, message ? message.trim() : null, isAnonymous]
    );

    console.log('✅ Reply response created:', {
      replyId: result.rows[0].id,
      replyData: result.rows[0]
    });

    // Update prayer count for the main prayer request
    await pool.query(
      'UPDATE prayer_requests SET response_count = response_count + 1 WHERE id = $1',
      [parentResponse.prayer_request_id]
    );

    console.log('✅ Prayer count updated for request:', parentResponse.prayer_request_id);

    console.log('✅ Reply to prayer response added successfully:', {
      userId: req.user.id,
      parentResponseId: responseId,
      replyId: result.rows[0].id,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      message: 'Reply added successfully',
      data: {
        reply: result.rows[0]
      }
    });

  } catch (error) {
    console.error('❌ Reply to prayer response error:', {
      error: error.message,
      stack: error.stack,
      responseId: req.params.responseId,
      userId: req.user.id,
      body: req.body,
      timestamp: new Date().toISOString()
    });
    
    // Handle specific database errors
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        success: false,
        error: 'Duplicate reply detected',
        message: 'A similar reply already exists for this response'
      });
    }
    
    if (error.code === '23503') { // Foreign key constraint violation
      return res.status(404).json({
        success: false,
        error: 'Parent response not found',
        message: 'The response you are trying to reply to does not exist'
      });
    }
    
    if (error.code === '23514') { // Check constraint violation
      return res.status(400).json({
        success: false,
        error: 'Invalid data provided',
        message: 'The reply data does not meet the required constraints'
      });
    }
    
    // Generic error response
    res.status(500).json({
      success: false,
      error: 'Failed to add reply',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred'
    });
  }
});

// Get user's prayer requests
router.get('/my-requests', authenticateToken, async (req, res) => {
  console.log('🙏 Get My Prayer Requests:', {
    userId: req.user.id,
    query: req.query,
    timestamp: new Date().toISOString()
  });

  try {
    const { 
      page = 1, 
      limit = 20, 
      status = 'all',
      sort = 'newest'
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = ['pr.user_id = $1'];
    let queryParams = [req.user.id];
    let paramCount = 2;

    // Add status filter
    if (status && status !== 'all') {
      whereConditions.push(`pr.status = $${paramCount}`);
      queryParams.push(status);
      paramCount++;
    }

    // Add sorting
    let orderBy = 'pr.created_at DESC';
    if (sort === 'oldest') {
      orderBy = 'pr.created_at ASC';
    } else if (sort === 'prayers') {
      orderBy = 'pr.prayer_count DESC, pr.created_at DESC';
    } else if (sort === 'urgent') {
      orderBy = 'pr.is_urgent DESC, pr.created_at DESC';
    }

    // Add pagination params
    queryParams.push(parseInt(limit), parseInt(offset));
    const limitParam = paramCount;
    const offsetParam = paramCount + 1;

    const result = await pool.query(
      `SELECT 
         pr.*,
         u.id as author_id,
         u.name as author_name,
         u.email as author_email,
         u.picture as author_picture,
         u.denomination as author_denomination,
         u.bible_version as author_bible_version,
         u.age_group as author_age_group
       FROM prayer_requests pr
       INNER JOIN users u ON pr.user_id = u.id
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      queryParams
    );

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total
       FROM prayer_requests pr
       WHERE ${whereConditions.join(' AND ')}`,
      queryParams.slice(0, -2)
    );

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    console.log('✅ My prayer requests retrieved successfully:', {
      userId: req.user.id,
      count: result.rows.length,
      total: total,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        requests: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('❌ Get my prayer requests error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve your prayer requests',
      message: error.message
    });
  }
});

// Get prayer categories
router.get('/categories', authenticateToken, async (req, res) => {
  console.log('🙏 Get Prayer Categories:', {
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });

  try {
    const categories = [
      { value: 'General', label: 'General Prayer' },
      { value: 'Health', label: 'Health & Healing' },
      { value: 'Family', label: 'Family & Relationships' },
      { value: 'Work', label: 'Work & Career' },
      { value: 'Relationships', label: 'Relationships' },
      { value: 'Spiritual Growth', label: 'Spiritual Growth' },
      { value: 'Financial', label: 'Financial' },
      { value: 'Emotional', label: 'Emotional Support' },
      { value: 'Other', label: 'Other' }
    ];

    console.log('✅ Prayer categories retrieved successfully:', {
      userId: req.user.id,
      count: categories.length,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        categories: categories
      }
    });

  } catch (error) {
    console.error('❌ Get prayer categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve prayer categories',
      message: error.message
    });
  }
});

// Get prayer statistics
router.get('/stats', authenticateToken, async (req, res) => {
  console.log('🙏 Get Prayer Statistics:', {
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.user.id;

    // Get user's prayer request stats
    const myRequestsResult = await pool.query(
      `SELECT 
         COUNT(*) as total_requests,
         COUNT(CASE WHEN status = 'Active' THEN 1 END) as active_requests,
         COUNT(CASE WHEN status = 'Answered' THEN 1 END) as answered_requests,
         COUNT(CASE WHEN is_urgent = true THEN 1 END) as urgent_requests,
         COALESCE(SUM(response_count), 0) as total_responses_received
       FROM prayer_requests 
       WHERE user_id = $1`,
      [userId]
    );

    // Get user's prayer response stats
    const myResponsesResult = await pool.query(
      `SELECT 
         COUNT(*) as total_responses_given,
         COUNT(CASE WHEN response_type = 'prayer' THEN 1 END) as prayers_given,
         COUNT(CASE WHEN response_type = 'encouragement' THEN 1 END) as encouragements_given,
         COUNT(CASE WHEN response_type = 'testimony' THEN 1 END) as testimonies_given
       FROM prayer_responses 
       WHERE user_id = $1`,
      [userId]
    );

    // Get global stats
    const globalStatsResult = await pool.query(
      `SELECT 
         COUNT(*) as total_public_requests,
         COUNT(CASE WHEN status = 'Active' THEN 1 END) as active_public_requests,
         COUNT(CASE WHEN is_urgent = true THEN 1 END) as urgent_public_requests,
         COALESCE(SUM(response_count), 0) as total_global_responses
       FROM prayer_requests 
       WHERE is_public = true`
    );

    console.log('✅ Prayer statistics retrieved successfully:', {
      userId: userId,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        myStats: {
          totalRequests: parseInt(myRequestsResult.rows[0].total_requests),
          activeRequests: parseInt(myRequestsResult.rows[0].active_requests),
          answeredRequests: parseInt(myRequestsResult.rows[0].answered_requests),
          urgentRequests: parseInt(myRequestsResult.rows[0].urgent_requests),
          totalResponsesReceived: parseInt(myRequestsResult.rows[0].total_responses_received),
          totalResponsesGiven: parseInt(myResponsesResult.rows[0].total_responses_given),
          prayersGiven: parseInt(myResponsesResult.rows[0].prayers_given),
          encouragementsGiven: parseInt(myResponsesResult.rows[0].encouragements_given),
          testimoniesGiven: parseInt(myResponsesResult.rows[0].testimonies_given)
        },
        globalStats: {
          totalPublicRequests: parseInt(globalStatsResult.rows[0].total_public_requests),
          activePublicRequests: parseInt(globalStatsResult.rows[0].active_public_requests),
          urgentPublicRequests: parseInt(globalStatsResult.rows[0].urgent_public_requests),
          totalGlobalResponses: parseInt(globalStatsResult.rows[0].total_global_responses)
        }
      }
    });

  } catch (error) {
    console.error('❌ Get prayer statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve prayer statistics',
      message: error.message
    });
  }
});

module.exports = router;
