const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Dynamic URLs based on environment
const getBackendUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.BACKEND_URL || 'https://your-production-domain.com';
  }
  // For development, use BACKEND_URL if set (like ngrok), otherwise fallback to localhost
  return process.env.BACKEND_URL || 'http://localhost:3000';
};

const getFrontendUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.FRONTEND_URL || 'https://your-frontend-domain.com';
  }
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL;
  }
  return 'http://localhost:3000';
};

const getCallbackUrl = () => {
  const backendUrl = getBackendUrl();
  const callbackUrl = `${backendUrl}/api/auth/google/callback`;
  console.log('🔧 OAuth Configuration Debug:', {
    NODE_ENV: process.env.NODE_ENV,
    BACKEND_URL: process.env.BACKEND_URL,
    FRONTEND_URL: process.env.FRONTEND_URL,
    backendUrl: backendUrl,
    callbackUrl: callbackUrl
  });
  return callbackUrl;
};

// Create separate OAuth clients for web and mobile
const createOAuthClient = (callbackUrl) => {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl
  );
};

// Web OAuth client (uses backend callback URL)
const webOAuthClient = createOAuthClient(getCallbackUrl());

// Mobile OAuth client (uses a custom redirect URI for mobile)
const mobileOAuthClient = createOAuthClient(`${getBackendUrl()}/api/auth/google/mobile-callback`);

// Common function to handle user authentication and token generation
const handleUserAuth = async (userInfo, tokens) => {
  console.log('🔍 UserInfo received:', userInfo);
  
  // Extract Google ID - try different possible fields
  const googleId = userInfo.sub || userInfo.id || userInfo.google_id;
  
  if (!googleId) {
    throw new Error('Google ID not found in user info. Available fields: ' + Object.keys(userInfo).join(', '));
  }
  
  const email = userInfo.email;
  const name = userInfo.name;
  const picture = userInfo.picture;
  
  console.log('✅ Extracted user data:', { 
    googleId: googleId.substring(0, 10) + '...', 
    email, 
    name, 
    hasPicture: !!picture 
  });
  
  console.log('🔍 Checking if user exists in database...');
  const dbStartTime = Date.now();
  
  // Check if user exists
  let result = await pool.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
  let user;
  
  const dbQueryTime = Date.now() - dbStartTime;
  console.log('📊 Database Query Result:', {
    userFound: result.rows.length > 0,
    queryTime: `${dbQueryTime}ms`,
    timestamp: new Date().toISOString()
  });

  if (result.rows.length === 0) {
    // Create new user
    console.log('🆕 Creating new user in database...');
    const insertStartTime = Date.now();
    
    const insertResult = await pool.query(
      `INSERT INTO users (google_id, email, name, picture, google_access_token, google_refresh_token) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [googleId, email, name, picture, tokens.access_token, tokens.refresh_token]
    );
    
    const insertTime = Date.now() - insertStartTime;
    user = insertResult.rows[0];
    
    console.log('✅ New user created:', {
      userId: user.id,
      email: user.email,
      insertTime: `${insertTime}ms`,
      timestamp: new Date().toISOString()
    });
  } else {
    // Update existing user
    console.log('🔄 Updating existing user in database...');
    const updateStartTime = Date.now();
    
    const updateResult = await pool.query(
      `UPDATE users 
       SET name = $1, picture = $2, google_access_token = $3, google_refresh_token = $4, updated_at = CURRENT_TIMESTAMP 
       WHERE google_id = $5 
       RETURNING *`,
      [name, picture, tokens.access_token, tokens.refresh_token, googleId]
    );
    
    const updateTime = Date.now() - updateStartTime;
    user = updateResult.rows[0];
    
    console.log('✅ Existing user updated:', {
      userId: user.id,
      email: user.email,
      updateTime: `${updateTime}ms`,
      timestamp: new Date().toISOString()
    });
  }

  console.log('🔐 Generating JWT token...');
  const jwtStartTime = Date.now();
  
  // Generate JWT token
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
  
  const jwtTime = Date.now() - jwtStartTime;
  console.log('✅ JWT token generated:', {
    tokenLength: token.length,
    jwtTime: `${jwtTime}ms`,
    timestamp: new Date().toISOString()
  });

  const authResult = {
    token,
    userData: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      googleMeetAccess: user.google_meet_access
    }
  };
  
  console.log('🎯 handleUserAuth completed successfully:', {
    userId: authResult.userData.id,
    email: authResult.userData.email,
    hasToken: !!authResult.token,
    totalTime: `${Date.now() - dbStartTime}ms`,
    timestamp: new Date().toISOString()
  });

  return authResult;
};

// Get Google OAuth URL
router.get('/google/url', (req, res) => {
  const { platform } = req.query;
  
  console.log('🚀 OAuth URL Request:', {
    platform: platform || 'web',
    userAgent: req.headers['user-agent'],
    accept: req.headers['accept'],
    timestamp: new Date().toISOString()
  });
  
  // Use different OAuth client based on platform
  const oauthClient = platform === 'mobile' ? mobileOAuthClient : webOAuthClient;
  
  console.log('🔧 OAuth Client Selected:', {
    platform: platform || 'web',
    clientType: platform === 'mobile' ? 'mobileOAuthClient' : 'webOAuthClient',
    redirectUri: platform === 'mobile' ? 
      `${getBackendUrl()}/api/auth/google/mobile-callback` : 
      getCallbackUrl()
  });

  const url = oauthClient.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ],
    prompt: 'consent'
  });
  
  console.log('🔗 Generated OAuth URL:', {
    platform: platform || 'web',
    url: url,
    urlLength: url.length,
    containsRedirectUri: url.includes('redirect_uri'),
    timestamp: new Date().toISOString()
  });
  
  res.json({ url });
});

// Web OAuth callback
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    console.log('Web auth callback received:', { code });
    
    const { tokens } = await webOAuthClient.getToken(code);
    webOAuthClient.setCredentials(tokens);
    console.log('🔑 Tokens received:', { access_token: tokens.access_token ? 'present' : 'missing', refresh_token: tokens.refresh_token ? 'present' : 'missing' });

    const oauth2 = google.oauth2({ auth: webOAuthClient, version: 'v2' });
    const { data: userInfo } = await oauth2.userinfo.get();
    console.log('👤 Raw userInfo from Google:', userInfo);
    
    const user = await handleUserAuth(userInfo, tokens);

    console.log('✅ Web Auth Successful:', {
      email: user.userData.email
    });

    const frontendUrl = getFrontendUrl();
    
    const redirectUrl = new URL(frontendUrl + '/dashboard');
    redirectUrl.searchParams.set('token', user.token);
    redirectUrl.searchParams.set('name', user.userData.name);
    redirectUrl.searchParams.set('email', user.userData.email);
    redirectUrl.searchParams.set('picture', user.userData.picture);

    console.log('🔄 Redirect Debug:', {
      frontendUrl: frontendUrl,
      fullRedirectUrl: redirectUrl.toString()
    });

    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('Web auth error:', error);
    const frontendUrl = getFrontendUrl();
    const redirectUrl = new URL(frontendUrl);
    redirectUrl.searchParams.set('error', 'Authentication failed');
    res.redirect(redirectUrl.toString());
  }
});

// Mobile OAuth callback
router.get('/google/mobile-callback', async (req, res) => {
  console.log('📱 Mobile Callback Received:', {
    method: req.method,
    url: req.url,
    query: req.query,
    headers: {
      'user-agent': req.headers['user-agent'],
      'accept': req.headers['accept'],
      'referer': req.headers['referer']
    },
    timestamp: new Date().toISOString()
  });

  try {
    const { code, error: googleError, state } = req.query;
    
    console.log('🔍 Callback Parameters:', {
      code: code ? `${code.substring(0, 10)}...` : 'missing',
      codeLength: code ? code.length : 0,
      googleError: googleError || 'none',
      state: state || 'none',
      hasCode: !!code
    });

    // Check for Google OAuth errors
    if (googleError) {
      console.log('❌ Google OAuth Error:', {
        error: googleError,
        timestamp: new Date().toISOString()
      });
      const EXPO_RETURN_URL = process.env.EXPO_RETURN_URL || 'exp://127.0.0.1:8081/--/auth/callback';
      return res.redirect(`${EXPO_RETURN_URL}?error=GoogleOAuthError&message=${encodeURIComponent(googleError)}`);
    }
    
    console.log('Mobile callback received:', { code });
    
    // Use environment variable for Expo return URL, fallback to localhost:8081
    const EXPO_RETURN_URL = process.env.EXPO_RETURN_URL || 'exp://127.0.0.1:8081/--/auth/callback';
    
    console.log('🔗 Using Expo return URL:', EXPO_RETURN_URL);

    if (!code) {
      console.log('❌ No code received, redirecting with error');
      return res.redirect(`${EXPO_RETURN_URL}?error=NoCode`);
    }

    if (code.length < 10) {
      console.log('❌ Invalid code received, redirecting with error');
      return res.redirect(`${EXPO_RETURN_URL}?error=InvalidCode`);
    }

    // Exchange code for tokens and generate JWT
    console.log('🔄 Starting token exchange with Google...');
    const startTime = Date.now();
    
    const { tokens } = await mobileOAuthClient.getToken(code);
    const tokenTime = Date.now() - startTime;
    
    console.log('🔑 Google Tokens Received:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      accessTokenLength: tokens.access_token ? tokens.access_token.length : 0,
      refreshTokenLength: tokens.refresh_token ? tokens.refresh_token.length : 0,
      tokenExchangeTime: `${tokenTime}ms`,
      timestamp: new Date().toISOString()
    });

    mobileOAuthClient.setCredentials(tokens);
    console.log('✅ OAuth client credentials set');

    console.log('👤 Fetching user info from Google...');
    const userInfoStartTime = Date.now();
    
    const oauth2 = google.oauth2({ auth: mobileOAuthClient, version: 'v2' });
    const { data: userInfo } = await oauth2.userinfo.get();
    
    const userInfoTime = Date.now() - userInfoStartTime;
    console.log('👤 User Info Received:', {
      email: userInfo.email,
      name: userInfo.name,
      hasPicture: !!userInfo.picture,
      pictureUrl: userInfo.picture ? `${userInfo.picture.substring(0, 50)}...` : 'none',
      userInfoFetchTime: `${userInfoTime}ms`,
      timestamp: new Date().toISOString()
    });
    
    console.log('💾 Processing user authentication...');
    const userAuthStartTime = Date.now();
    
    const user = await handleUserAuth(userInfo, tokens);
    
    const userAuthTime = Date.now() - userAuthStartTime;
    console.log('✅ User Authentication Complete:', {
      userId: user.userData.id,
      email: user.userData.email,
      name: user.userData.name,
      hasPicture: !!user.userData.picture,
      tokenLength: user.token.length,
      userAuthTime: `${userAuthTime}ms`,
      totalTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    });

    // Check if the request wants JSON response
    const wantsJson = req.headers['accept'] && req.headers['accept'].includes('application/json');
    
    console.log('📋 Response Type Check:', {
      wantsJson: wantsJson,
      acceptHeader: req.headers['accept'],
      willReturnJson: wantsJson
    });
    
    if (wantsJson) {
      console.log('📱 Mobile app requested JSON response');
      const jsonResponse = {
        success: true,
        token: user.token,
        user: user.userData,
        message: 'Authentication successful'
      };
      console.log('📤 Sending JSON Response with JWT token');
      return res.json(jsonResponse);
    }

    // Redirect to Expo return URL with JWT token and user data
    console.log('✅ Authentication successful, redirecting to Expo with JWT token');
    const redirectUrl = new URL(EXPO_RETURN_URL);
    redirectUrl.searchParams.set('token', user.token);
    redirectUrl.searchParams.set('name', user.userData.name);
    redirectUrl.searchParams.set('email', user.userData.email);
    redirectUrl.searchParams.set('picture', user.userData.picture || '');
    redirectUrl.searchParams.set('userId', user.userData.id);
    
    console.log('🔄 Full redirect URL with token:', redirectUrl.toString());
    console.log('🔄 Redirect URL Length:', redirectUrl.toString().length);
    
    return res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('❌ Mobile callback error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    const EXPO_RETURN_URL = process.env.EXPO_RETURN_URL || 'exp://127.0.0.1:8081/--/auth/callback';
    console.log('❌ Error occurred, redirecting to Expo with error');
    
    const wantsJson = req.headers['accept'] && req.headers['accept'].includes('application/json');
    
    if (wantsJson) {
      const errorResponse = {
        success: false,
        error: 'AuthFailed',
        message: error.message,
        redirectUrl: `${EXPO_RETURN_URL}?error=AuthFailed&message=${encodeURIComponent(error.message)}`
      };
      console.log('📤 Sending Error JSON Response:', errorResponse);
      return res.json(errorResponse);
    }
    
    const errorRedirectUrl = `${EXPO_RETURN_URL}?error=AuthFailed&message=${encodeURIComponent(error.message)}`;
    console.log('🔄 Error Redirect URL:', errorRedirectUrl);
    return res.redirect(errorRedirectUrl);
  }
});

// Mobile authentication with authorization code
router.post('/google/mobile', async (req, res) => {
  console.log('📱 Mobile Authentication Request:', {
    method: req.method,
    url: req.url,
    body: req.body,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']
    },
    timestamp: new Date().toISOString()
  });

  try {
    const { code } = req.body;
    
    console.log('🔍 Request Body Analysis:', {
      hasCode: !!code,
      codeLength: code ? code.length : 0,
      codePreview: code ? `${code.substring(0, 10)}...` : 'missing',
      bodyKeys: Object.keys(req.body)
    });
    
    if (!code) {
      console.log('❌ Missing authorization code');
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required'
      });
    }

    console.log('🔄 Starting token exchange with Google...');
    const startTime = Date.now();
    
    const { tokens } = await mobileOAuthClient.getToken(code);
    const tokenTime = Date.now() - startTime;
    
    console.log('🔑 Google Tokens Received:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      accessTokenLength: tokens.access_token ? tokens.access_token.length : 0,
      refreshTokenLength: tokens.refresh_token ? tokens.refresh_token.length : 0,
      tokenExchangeTime: `${tokenTime}ms`,
      timestamp: new Date().toISOString()
    });

    mobileOAuthClient.setCredentials(tokens);
    console.log('✅ OAuth client credentials set');

    console.log('👤 Fetching user info from Google...');
    const userInfoStartTime = Date.now();
    
    const oauth2 = google.oauth2({ auth: mobileOAuthClient, version: 'v2' });
    const { data: userInfo } = await oauth2.userinfo.get();
    
    const userInfoTime = Date.now() - userInfoStartTime;
    console.log('👤 User Info Received:', {
      email: userInfo.email,
      name: userInfo.name,
      hasPicture: !!userInfo.picture,
      pictureUrl: userInfo.picture ? `${userInfo.picture.substring(0, 50)}...` : 'none',
      userInfoFetchTime: `${userInfoTime}ms`,
      timestamp: new Date().toISOString()
    });
    
    console.log('💾 Processing user authentication...');
    const userAuthStartTime = Date.now();
    
    const user = await handleUserAuth(userInfo, tokens);
    
    const userAuthTime = Date.now() - userAuthStartTime;
    console.log('✅ User Authentication Complete:', {
      userId: user.userData.id,
      email: user.userData.email,
      name: user.userData.name,
      hasPicture: !!user.userData.picture,
      tokenLength: user.token.length,
      userAuthTime: `${userAuthTime}ms`,
      totalTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    });

    const response = {
      success: true,
      token: user.token,
      user: user.userData
    };
    
    console.log('📤 Sending Success Response:', {
      success: response.success,
      hasToken: !!response.token,
      tokenLength: response.token.length,
      userEmail: response.user.email,
      timestamp: new Date().toISOString()
    });

    res.json(response);
  } catch (error) {
    console.error('❌ Mobile auth error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
      message: error.message
    });
  }
});

// Legacy Google OAuth login/signup (kept for backward compatibility)
router.post('/google', async (req, res) => {
  try {
    const { idToken, accessToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'Google ID token is required' });
    }

    // Verify the Google ID token
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Check if user exists
    let result = await pool.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
    let user;

    if (result.rows.length === 0) {
      // Create new user
      const insertResult = await pool.query(
        `INSERT INTO users (google_id, email, name, picture, google_access_token) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [googleId, email, name, picture, accessToken]
      );
      user = insertResult.rows[0];
      console.log('New user created:', email);
    } else {
      // Update existing user
      const updateResult = await pool.query(
        `UPDATE users 
         SET name = $1, picture = $2, google_access_token = $3, updated_at = CURRENT_TIMESTAMP 
         WHERE google_id = $4 
         RETURNING *`,
        [name, picture, accessToken, googleId]
      );
      user = updateResult.rows[0];
      console.log('Existing user updated:', email);
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        googleMeetAccess: user.google_meet_access
      }
    });

  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ 
      error: 'Authentication failed',
      message: error.message 
    });
  }
});

// Request Google Meet API access
router.post('/google-meet-access', authenticateToken, async (req, res) => {
  try {
    const { accessToken, refreshToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    // Update user with Google Meet access tokens
    await pool.query(
      `UPDATE users 
       SET google_access_token = $1, google_refresh_token = $2, google_meet_access = TRUE, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3`,
      [accessToken, refreshToken, req.user.id]
    );

    res.json({
      success: true,
      message: 'Google Meet access granted successfully'
    });

  } catch (error) {
    console.error('Google Meet access error:', error);
    res.status(500).json({ 
      error: 'Failed to grant Google Meet access',
      message: error.message 
    });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // In a more complete implementation, you might want to blacklist the token
    // For now, we'll just clear the Google tokens from the database
    await pool.query(
      'UPDATE users SET google_access_token = NULL, google_refresh_token = NULL WHERE id = $1',
      [req.user.id]
    );

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Email signup endpoint
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Name, email, and password are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
        message: 'Please provide a valid email address'
      });
    }

    // Validate password strength (minimum 6 characters)
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Weak password',
        message: 'Password must be at least 6 characters long'
      });
    }

    // Validate name (not empty, reasonable length)
    if (name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid name',
        message: 'Name must be between 2 and 100 characters'
      });
    }

    console.log('🔍 Email signup attempt:', {
      email: email,
      name: name,
      passwordLength: password.length,
      timestamp: new Date().toISOString()
    });

    // Check if user already exists
    const existingUser = await pool.query('SELECT id, email FROM users WHERE email = $1', [email.toLowerCase()]);
    
    if (existingUser.rows.length > 0) {
      console.log('❌ User already exists:', email);
      return res.status(409).json({
        success: false,
        error: 'User already exists',
        message: 'An account with this email already exists'
      });
    }

    console.log('🔐 Hashing password...');
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    console.log('✅ Password hashed successfully');

    // Create new user
    console.log('💾 Creating new user in database...');
    const insertResult = await pool.query(
      `INSERT INTO users (email, name, password_hash, created_at, updated_at) 
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
       RETURNING id, email, name, created_at`,
      [email.toLowerCase(), name.trim(), passwordHash]
    );

    const user = insertResult.rows[0];
    console.log('✅ New user created:', {
      userId: user.id,
      email: user.email,
      name: user.name,
      timestamp: new Date().toISOString()
    });

    // Generate JWT token
    console.log('🔐 Generating JWT token...');
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    console.log('✅ JWT token generated successfully');

    const response = {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: null, // No picture for email signup
        googleMeetAccess: false // No Google Meet access for email signup
      },
      message: 'Account created successfully'
    };

    console.log('🎯 Email signup completed successfully:', {
      userId: response.user.id,
      email: response.user.email,
      hasToken: !!response.token,
      timestamp: new Date().toISOString()
    });

    res.status(201).json(response);

  } catch (error) {
    console.error('❌ Email signup error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      error: 'Signup failed',
      message: 'An error occurred while creating your account. Please try again.'
    });
  }
});

// Email login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing credentials',
        message: 'Email and password are required'
      });
    }

    console.log('🔍 Email login attempt:', {
      email: email,
      timestamp: new Date().toISOString()
    });

    // Find user by email
    const result = await pool.query(
      'SELECT id, email, name, password_hash, picture, google_meet_access FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      console.log('❌ User not found:', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    // Check if user has a password (email signup user)
    if (!user.password_hash) {
      console.log('❌ User has no password (Google auth user):', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'This account was created with Google. Please use Google sign-in.'
      });
    }

    // Verify password
    console.log('🔐 Verifying password...');
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      console.log('❌ Invalid password for user:', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'Invalid email or password'
      });
    }

    console.log('✅ Password verified successfully');

    // Generate JWT token
    console.log('🔐 Generating JWT token...');
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    console.log('✅ JWT token generated successfully');

    const response = {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        googleMeetAccess: user.google_meet_access
      },
      message: 'Login successful'
    };

    console.log('🎯 Email login completed successfully:', {
      userId: response.user.id,
      email: response.user.email,
      hasToken: !!response.token,
      timestamp: new Date().toISOString()
    });

    res.json(response);

  } catch (error) {
    console.error('❌ Email login error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      error: 'Login failed',
      message: 'An error occurred while logging in. Please try again.'
    });
  }
});

// Verify token
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      picture: req.user.picture,
      googleMeetAccess: req.user.google_meet_access
    }
  });
});

module.exports = router;
