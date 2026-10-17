const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
require('dotenv').config();

const db = require('./db');
const authRoutes = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const categoriesRoutes = require('./routes/categories');
const transactionsRoutes = require('./routes/transactions');
const vaultRoutes = require('./routes/vault');
const budgetsRoutes = require('./routes/budgets');
const insightsRoutes = require('./routes/insights');
const subscriptionsRoutes = require('./routes/subscriptions');
const menusRoutes = require('./routes/menus');
const shareLinksRoutes = require('./routes/shareLinks');

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// HTTP Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));

// Gzip / Brotli Payload Compression
app.use(compression());

// Trust reverse proxy for HTTPS cookie detection (Render, Railway, Fly, Heroku, etc.)
if (isProduction) {
  app.set('trust proxy', 1);
}

// Dynamic CORS origins resolution
const parseAllowedOrigins = () => {
  const origins = new Set();

  // Support single or comma-separated CLIENT_URL and ALLOWED_ORIGINS env vars
  const rawEnvOrigins = [process.env.CLIENT_URL, process.env.ALLOWED_ORIGINS]
    .filter(Boolean)
    .flatMap((val) => val.split(',').map((u) => u.trim()))
    .filter(Boolean);

  for (const url of rawEnvOrigins) {
    origins.add(url);
    origins.add(url.replace(/\/$/, ''));
  }

  return origins;
};

const configuredOrigins = parseAllowedOrigins();

const isOriginAllowed = (origin) => {
  // Allow non-browser requests (e.g. mobile apps, postman, curl, internal health checks)
  if (!origin) return true;

  const normalized = origin.replace(/\/$/, '');

  // Check explicit environment configured origins
  if (configuredOrigins.has(origin) || configuredOrigins.has(normalized)) {
    return true;
  }

  // In non-production, dynamically allow any localhost or 127.0.0.1 port (e.g. 5173, 5174, 4173, 3000)
  if (!isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) {
    return true;
  }

  return false;
};

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-token', 'X-Requested-With'],
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(cookieParser());

// Persistent PostgreSQL Session Store
app.use(session({
  store: new pgSession({
    pool: db.pool,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'vtrack_session_secret_key_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// Tab-Isolated Session Resolver Middleware
// Allows each browser tab to maintain its own independent user session via x-session-token
app.use(async (req, res, next) => {
  const tokenHeader = req.headers['x-session-token'] ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : null);

  if (tokenHeader) {
    try {
      const sessRes = await db.query(
        'SELECT sid, sess, expire FROM session WHERE sid = $1 AND expire > NOW() LIMIT 1',
        [tokenHeader]
      );
      if (sessRes.rows.length > 0) {
        const sessData = sessRes.rows[0].sess;
        if (sessData && sessData.userId) {
          req.userId = sessData.userId;
          if (req.session) {
            req.session.userId = sessData.userId;
          }
          req.sessionID = tokenHeader;
          req.isTabIsolated = true;
          return next();
        }
      }
    } catch (err) {
      console.error('Error resolving tab session token:', err);
    }
  } else if (req.session && req.session.userId) {
    req.userId = req.session.userId;
  }
  next();
});

// API Routes strictly under /api
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/budgets', budgetsRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/menus', menusRoutes);
app.use('/api/share-links', shareLinksRoutes);

app.get('/api/health', async (req, res) => {
  try {
    const dbPing = await db.query('SELECT 1 as ping');
    const isDbConnected = dbPing.rows.length > 0 && dbPing.rows[0].ping === 1;

    return res.json({
      status: 'ok',
      service: 'VTrack JSON API',
      database: isDbConnected ? 'connected' : 'unreachable',
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Health check database error:', err);
    return res.status(503).json({
      status: 'error',
      service: 'VTrack JSON API',
      database: 'disconnected',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Global 404 handler for unknown API endpoints
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: {
      message: 'The requested API route was not found on VTrack.',
      action: 'check_endpoint'
    }
  });
});

// Global centralized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (res.headersSent) {
    return next(err);
  }
  return res.status(500).json({
    error: {
      message: isProduction ? 'An unexpected server error occurred. Please try again.' : err.message,
      action: 'retry'
    }
  });
});

let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`VTrack API server listening on http://localhost:${PORT}`);
  });

  const handleShutdown = async (signal) => {
    console.log(`Received ${signal}. Shutting down VTrack gracefully...`);
    if (server) {
      server.close(async () => {
        try {
          await db.pool.end();
          console.log('Database pool drained. Process exiting cleanly.');
        } catch (err) {
          console.error('Error closing database pool:', err);
        }
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

module.exports = app;
