const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Dynamic URLs based on environment
const getBackendUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.BACKEND_URL || 'https://your-production-domain.com';
  }
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
  
  console.log('✅ Extracted user data:', { googleId, email, name, picture });
  
  // Check if user exists
  let result = await pool.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
  let user;

  if (result.rows.length === 0) {
    // Create new user
    const insertResult = await pool.query(
      `INSERT INTO users (google_id, email, name, picture, google_access_token, google_refresh_token) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [googleId, email, name, picture, tokens.access_token, tokens.refresh_token]
    );
    user = insertResult.rows[0];
    console.log('✅ New user created:', email);
  } else {
    // Update existing user
    const updateResult = await pool.query(
      `UPDATE users 
       SET name = $1, picture = $2, google_access_token = $3, google_refresh_token = $4, updated_at = CURRENT_TIMESTAMP 
       WHERE google_id = $5 
       RETURNING *`,
      [name, picture, tokens.access_token, tokens.refresh_token, googleId]
    );
    user = updateResult.rows[0];
    console.log('✅ Existing user updated:', email);
  }

  // Generate JWT token
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return {
    token,
    userData: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      googleMeetAccess: user.google_meet_access
    }
  };
};

// Get Google OAuth URL
router.get('/google/url', (req, res) => {
  const { platform } = req.query;
  
  // Use different OAuth client based on platform
  const oauthClient = platform === 'mobile' ? mobileOAuthClient : webOAuthClient;

  const url = oauthClient.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/meetings'
    ],
    prompt: 'consent'
  });
  
  console.log('🔗 Generated OAuth URL:', {
    platform: platform || 'web',
    url: url
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
  try {
    const { code } = req.query;
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

    // Check if the request wants JSON response
    const wantsJson = req.headers['accept'] && req.headers['accept'].includes('application/json');
    
    if (wantsJson) {
      console.log('📱 Mobile app requested JSON response');
      return res.json({
        success: true,
        code: code,
        redirectUrl: `${EXPO_RETURN_URL}?code=${encodeURIComponent(code)}`,
        message: 'Authorization code received successfully'
      });
    }

    // Redirect to Expo return URL with code
    console.log('✅ Code received, redirecting to Expo with code');
    const redirectUrl = `${EXPO_RETURN_URL}?code=${encodeURIComponent(code)}`;
    console.log('🔄 Full redirect URL:', redirectUrl);
    
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error('Mobile callback error:', error);
    const EXPO_RETURN_URL = process.env.EXPO_RETURN_URL || 'exp://127.0.0.1:8081/--/auth/callback';
    console.log('❌ Error occurred, redirecting to Expo with error');
    
    const wantsJson = req.headers['accept'] && req.headers['accept'].includes('application/json');
    
    if (wantsJson) {
      return res.json({
        success: false,
        error: 'AuthFailed',
        message: error.message,
        redirectUrl: `${EXPO_RETURN_URL}?error=AuthFailed&message=${encodeURIComponent(error.message)}`
      });
    }
    
    return res.redirect(`${EXPO_RETURN_URL}?error=AuthFailed&message=${encodeURIComponent(error.message)}`);
  }
});

// Mobile authentication with authorization code
router.post('/google/mobile', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required'
      });
    }
    
    const { tokens } = await mobileOAuthClient.getToken(code);
    mobileOAuthClient.setCredentials(tokens);

    const oauth2 = google.oauth2({ auth: mobileOAuthClient, version: 'v2' });
    const { data: userInfo } = await oauth2.userinfo.get();
    
    const user = await handleUserAuth(userInfo, tokens);

    console.log('✅ Mobile Auth Successful:', {
      email: user.userData.email,
      tokenLength: user.token.length
    });

    res.json({
      success: true,
      token: user.token,
      user: user.userData
    });
  } catch (error) {
    console.error('Mobile auth error:', error);
    res.status(401).json({
      success: false,
      error: 'Authentication failed'
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
