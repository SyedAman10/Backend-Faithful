// // const express = require('express');
// // const cors = require('cors');
// // const helmet = require('helmet');
// // const rateLimit = require('express-rate-limit');
// // const morgan = require('morgan');
// // require('dotenv').config();

// // const authRoutes = require('./routes/auth');
// // const userRoutes = require('./routes/users');
// // const usageRoutes = require('./routes/usage');
// // const studyGroupRoutes = require('./routes/study-groups');
// // const bibleRoutes = require('./routes/bible');
// // const prayerRoutes = require('./routes/prayer');
// // const { initializeDatabase } = require('./config/database');

// // const app = express();
// // const PORT = process.env.PORT || 3000;

// // // Trust proxy for rate limiting behind ngrok
// // app.set('trust proxy', 1);

// // // Security middleware
// // app.use(helmet());

// // // Rate limiting
// // const limiter = rateLimit({
// //   windowMs: 15 * 60 * 1000, // 15 minutes
// //   max: 100, // limit each IP to 100 requests per windowMs
// //   message: 'Too many requests from this IP, please try again later.'
// // });
// // app.use(limiter);

// // // Logging
// // app.use(morgan('combined'));

// // // CORS configuration for Expo and ngrok
// // const corsOptions = {
// //   origin: process.env.ALLOWED_ORIGINS?.split(',') || [
// //     'http://localhost:19000',
// //     'http://localhost:19001',
// //     'http://localhost:19002',
// //     'https://1befd1562ae3.ngrok-free.app'
// //   ],
// //   credentials: true,
// //   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
// //   allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
// // };
// // app.use(cors(corsOptions));

// // // Body parser middleware
// // app.use(express.json({ limit: '10mb' }));
// // app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// // // Initialize database
// // initializeDatabase();

// // // Routes
// // app.use('/api/auth', authRoutes);
// // app.use('/api/users', userRoutes);
// // app.use('/api/usage', usageRoutes);
// // app.use('/api/study-groups', studyGroupRoutes);
// // app.use('/api/bible', bibleRoutes);
// // app.use('/api/prayer', prayerRoutes);

// // // Health check endpoint
// // app.get('/api/health', (req, res) => {
// //   res.json({ 
// //     status: 'OK', 
// //     timestamp: new Date().toISOString(),
// //     environment: process.env.NODE_ENV,
// //     backendUrl: process.env.BACKEND_URL || 'http://localhost:3000',
// //     apis: [
// //       'Authentication: /api/auth',
// //       'Users: /api/users', 
// //       'Usage Tracking: /api/usage',
// //       'Study Groups: /api/study-groups',
// //       'Bible API: /api/bible',
// //       'Prayer Requests: /api/prayer'
// //     ]
// //   });
// // });

// // // Error handling middleware
// // app.use((err, req, res, next) => {
// //   console.error(err.stack);
// //   res.status(500).json({ 
// //     error: 'Something went wrong!',
// //     message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
// //   });
// // });

// // // 404 handler
// // app.use('*', (req, res) => {
// //   res.status(404).json({ error: 'Route not found' });
// // });

// // app.listen(PORT, () => {
// //   console.log(`🚀 Server running on port ${PORT}`);
// //   console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
// //   console.log(`🔗 Backend URL: ${process.env.BACKEND_URL || 'http://localhost:3000'}`);
// //   console.log(`📊 Usage tracking API: /api/usage`);
// //   console.log(`📚 Study Groups API: /api/study-groups`);
// //   console.log(`📖 Bible API: /api/bible`);
// //   console.log(`🙏 Prayer Requests API: /api/prayer`);
// // });

// // module.exports = app;
// const fs = require('fs');
// const https = require('https');
// const express = require('express');
// const cors = require('cors');
// const helmet = require('helmet');
// const rateLimit = require('express-rate-limit');
// const morgan = require('morgan');
// require('dotenv').config();

// const authRoutes = require('./routes/auth');
// const userRoutes = require('./routes/users');
// const usageRoutes = require('./routes/usage');
// const studyGroupRoutes = require('./routes/study-groups');
// const bibleRoutes = require('./routes/bible');
// const prayerRoutes = require('./routes/prayer');
// const { initializeDatabase } = require('./config/database');

// const app = express();
// const PORT = process.env.PORT || 443; // default HTTPS port

// // Trust proxy for rate limiting behind ngrok
// app.set('trust proxy', 1);

// // Security middleware
// app.use(helmet());

// // Rate limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100,
//   message: 'Too many requests from this IP, please try again later.'
// });
// app.use(limiter);

// // Logging
// app.use(morgan('combined'));

// // CORS configuration for Expo and ngrok
// const corsOptions = {
//   origin: process.env.ALLOWED_ORIGINS?.split(',') || [
//     'http://localhost:19000',
//     'http://localhost:19001',
//     'http://localhost:19002',
//     'https://1befd1562ae3.ngrok-free.app'
//   ],
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
// };
// app.use(cors(corsOptions));

// // Body parser middleware
// app.use(express.json({ limit: '10mb' }));
// app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// // Initialize database
// initializeDatabase();

// // Routes
// app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/usage', usageRoutes);
// app.use('/api/study-groups', studyGroupRoutes);
// app.use('/api/bible', bibleRoutes);
// app.use('/api/prayer', prayerRoutes);

// // Health check endpoint
// app.get('/api/health', (req, res) => {
//   res.json({
//     status: 'OK',
//     timestamp: new Date().toISOString(),
//     environment: process.env.NODE_ENV,
//     backendUrl: process.env.BACKEND_URL || `https://localhost:${PORT}`,
//     apis: [
//       'Authentication: /api/auth',
//       'Users: /api/users',
//       'Usage Tracking: /api/usage',
//       'Study Groups: /api/study-groups',
//       'Bible API: /api/bible',
//       'Prayer Requests: /api/prayer'
//     ]
//   });
// });

// // Error handling middleware
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(500).json({
//     error: 'Something went wrong!',
//     message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
//   });
// });

// // 404 handler
// app.use('*', (req, res) => {
//   res.status(404).json({ error: 'Route not found' });
// });

// // --- 🔐 SSL CONFIGURATION ---
// // Make sure you have `ssl/server.key` and `ssl/server.cert`
// const sslOptions = {
//   key: fs.readFileSync(process.env.SSL_KEY || 'ssl/server.key'),
//   cert: fs.readFileSync(process.env.SSL_CERT || 'ssl/server.cert')
// };

// // Create HTTPS server
// https.createServer(sslOptions, app).listen(PORT, '0.0.0.0', () => {
//   console.log(`🚀 HTTPS Server running on port ${PORT}`);
//   console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
//   console.log(`🔗 Backend URL: https://localhost:${PORT}`);
//   console.log(`📊 Usage tracking API: /api/usage`);
//   console.log(`📚 Study Groups API: /api/study-groups`);
//   console.log(`📖 Bible API: /api/bible`);
//   console.log(`🙏 Prayer Requests API: /api/prayer`);
// });

// module.exports = app;
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const usageRoutes = require('./routes/usage');
const studyGroupRoutes = require('./routes/study-groups');
const bibleRoutes = require('./routes/bible');
const prayerRoutes = require('./routes/prayer');
const livekitRoutes = require('./routes/livekit');
const userProfileRoutes = require('./routes/user-profile');
const { initializeDatabase } = require('./config/database');
const { startEngagementCronJobs } = require('./utils/engagementCronJobs');
const { startJourneyReminderCron } = require('./utils/journeyReminderCron');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for rate limiting behind nginx
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Logging
app.use(morgan('combined'));

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:19000',
    'http://localhost:19001',
    'http://localhost:19002'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize database
initializeDatabase();

// Start engagement tracking cron jobs
startEngagementCronJobs();

// Start journey reminder cron jobs for push notifications
console.log('🔔 Initializing journey reminder notifications...');
startJourneyReminderCron();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/study-groups', studyGroupRoutes);
app.use('/api/bible', bibleRoutes);
app.use('/api/prayer', prayerRoutes);
app.use('/api/livekit', livekitRoutes);
app.use('/api/users', userProfileRoutes); // User engagement tracking

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    backendUrl: process.env.BACKEND_URL || `http://localhost:${PORT}`,
    apis: [
      'Authentication: /api/auth',
      'Users: /api/users',
      'Usage Tracking: /api/usage',
      'Study Groups: /api/study-groups',
      'Bible API: /api/bible',
      'Prayer Requests: /api/prayer',
      'LiveKit Video: /api/livekit',
      'User Engagement: /api/users/profile/usage, /api/users/profile/streak',
      'Leaderboard: /api/users/streak/leaderboard'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start HTTP server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Backend URL: http://localhost:${PORT}`);
});

module.exports = app;
