# Backend-Faithful

Backend API for the Faithful app - A Bible study and community platform.

## Features

- User Authentication (Email/Password and Google OAuth)
- **Google Calendar Integration** (Separate from sign-up)
- Bible API with multiple translations
- Daily Prayer Requests
- Study Groups Management
- Video Conferencing (LiveKit)
- User Engagement Tracking
- Usage Analytics

## Quick Start

### Installation

```bash
npm install
```

### Environment Setup

Copy `env-template.txt` to `.env` and configure your environment variables:

```bash
cp env-template.txt .env
```

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT token generation
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `BACKEND_URL` - Your backend URL (e.g., http://localhost:3000)
- `FRONTEND_URL` - Your frontend URL
- `EXPO_RETURN_URL` - Deep link for mobile app

### Database Setup

Run migrations:

```bash
# Main database setup
node scripts/run-engagement-migration.js

# Google Calendar connection setup
node scripts/run-calendar-migration.js
```

### Start the Server

```bash
node server.js
```

The server will run on port 3000 by default.

## API Documentation

### Authentication

- **Email/Password Authentication**: `POST /api/auth/signup`, `POST /api/auth/login`
- **Google OAuth Sign-Up**: `GET /api/auth/google/url`, `GET /api/auth/google/callback`

### Google Calendar Authentication (NEW)

**Separate endpoints for connecting Google Calendar** - distinct from sign-up flow:

- `GET /api/auth/google-calendar/url` - Get OAuth URL (requires auth)
- `GET /api/auth/google-calendar/callback` - Web callback
- `GET /api/auth/google-calendar/mobile-callback` - Mobile callback
- `POST /api/auth/google-calendar/connect` - Connect via POST (requires auth)
- `GET /api/auth/google-calendar/status` - Check connection status (requires auth)
- `POST /api/auth/google-calendar/disconnect` - Disconnect calendar (requires auth)

**Key Features:**
- Completely separate from sign-up authentication
- Captures user's actual Gmail address
- Grants both Calendar and Gmail read access
- Can be used by users who signed up with email/password
- Requires existing authentication (JWT token)

📚 **See [GOOGLE_CALENDAR_AUTH.md](./GOOGLE_CALENDAR_AUTH.md) for detailed documentation**

### Other APIs

- **Bible API**: See [BIBLE_API_LOGGING.md](./BIBLE_API_LOGGING.md)
- **Prayer Requests**: See [DAILY_PRAYER_API_GUIDE.md](./DAILY_PRAYER_API_GUIDE.md)
- **Study Groups**: See [STUDY_GROUPS_API.md](./STUDY_GROUPS_API.md)
- **User Engagement**: See [USER_ENGAGEMENT_API.md](./USER_ENGAGEMENT_API.md)
- **LiveKit Integration**: See [LIVEKIT_INTEGRATION.md](./LIVEKIT_INTEGRATION.md)

## Testing

### Test Google Calendar Authentication

```bash
# Set your JWT token
export TEST_JWT_TOKEN=your_jwt_token_here

# Run test
node test-google-calendar-auth.js
```

### Test Other Features

```bash
node test-auth.js
node test-daily-prayer.js
node test-recurring-meetings.js
```

## Database Schema

Main tables:
- `users` - User accounts and authentication
- `prayer_requests` - Daily prayer submissions
- `study_groups` - Bible study groups
- `user_engagement` - User activity tracking
- `join_requests` - Study group membership requests

### Google Calendar Columns in Users Table

- `google_calendar_connected` - Boolean flag for explicit calendar connection
- `google_email` - Gmail address from OAuth
- `google_access_token` - Google API access token
- `google_refresh_token` - Google API refresh token
- `google_meet_access` - Boolean flag for Google Meet permissions

## Project Structure

```
Backend-Faithful/
├── config/           # Database configuration
├── middleware/       # Express middleware (auth, etc.)
├── routes/           # API route handlers
│   ├── auth.js       # Authentication (includes calendar auth)
│   ├── bible.js      # Bible API
│   ├── prayer.js     # Prayer requests
│   ├── study-groups.js
│   └── ...
├── scripts/          # Database migrations and utilities
├── utils/            # Helper functions
├── server.js         # Main server file
└── *.md             # Documentation files
```

## Security

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting
- CORS configuration
- Helmet.js security headers
- OAuth 2.0 for Google integration

## Environment Variables

See `env-template.txt` for all required environment variables.

## Support

For detailed API documentation, see the individual markdown files:
- [GOOGLE_CALENDAR_AUTH.md](./GOOGLE_CALENDAR_AUTH.md) - **New calendar authentication**
- [ENGAGEMENT_SETUP_GUIDE.md](./ENGAGEMENT_SETUP_GUIDE.md)
- [STUDY_GROUPS_API.md](./STUDY_GROUPS_API.md)
- [BIBLE_API_LOGGING.md](./BIBLE_API_LOGGING.md)

## License

© 2024 Backend-Faithful. All rights reserved.