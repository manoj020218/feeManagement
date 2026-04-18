// src/server.js — FeeFlow Express server (MongoDB + JWT)
process.title = 'feeflow-backend';
require('dotenv').config();
// Load .env.local for local development overrides (not committed to git)
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local'), override: true });
const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const mongoose = require('mongoose');

const authRouter         = require('./routes/auth');
const usersRouter        = require('./routes/users');
const analyticsRouter    = require('./routes/analytics');
const institutionsRouter = require('./routes/institutions');
const announcementsRouter = require('./routes/announcements');
const feedbackRouter     = require('./routes/feedback');
const joinRequestsRouter = require('./routes/joinRequests');

const path = require('path');
const app  = express();
const PORT = process.env.PORT || 3000;

// ── MONGODB CONNECTION ─────────────────────────────────────
// Production:  credentials are split env vars (no special-char encoding issues)
// Development: MONGO_URI_LOCAL set in .env.local → connects via SSH tunnel
let MONGO_URI, mongoOptions;

if (process.env.NODE_ENV === 'production') {
  const host   = process.env.MONGODB_HOST    || '127.0.0.1';
  const port   = process.env.MONGODB_PORT    || '27017';
  const db     = process.env.MONGODB_DB      || 'feeflow';
  const authDb = process.env.MONGODB_AUTH_DB || 'admin';
  MONGO_URI    = `mongodb://${host}:${port}/${db}`;
  mongoOptions = {
    auth:       { username: process.env.MONGODB_USER, password: process.env.MONGODB_PASS },
    authSource: authDb,
    dbName:     db,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  };
} else {
  // Local dev: SSH tunnel makes VPS MongoDB available at 127.0.0.1:27017
  MONGO_URI    = process.env.MONGO_URI_LOCAL || 'mongodb://127.0.0.1:27017/feeflow';
  mongoOptions = {
    auth:       { username: process.env.MONGODB_USER, password: process.env.MONGODB_PASS },
    authSource: process.env.MONGODB_AUTH_DB || 'admin',
    dbName:     'feeflow',
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  };
}

mongoose.connect(MONGO_URI, mongoOptions)
  .then(() => console.log('  ► MongoDB connected →', process.env.MONGODB_DB || 'feeflow'))
  .catch(err => {
    console.error('  ✗ MongoDB connection failed:', err.message);
    console.error('  → If running locally: make sure SSH tunnel is active (npm run dev:local)');
    // Don't exit — server runs, DB reconnects when tunnel comes up
  });

mongoose.connection.on('disconnected', () => console.warn('  ⚡ MongoDB disconnected — retrying…'));
mongoose.connection.on('reconnected',  () => console.log('  ► MongoDB reconnected ✓'));

// ── MIDDLEWARE ────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: [
    'capacitor://localhost',
    'https://localhost',
    'http://localhost',
    'ionic://localhost',
    'http://localhost:3001',
    'https://localhost:3001',
    'https://feeflow.iotsoft.in',
  ],
  credentials: true,
}));

// ── STATIC FILES ──────────────────────────────────────────
// index: false prevents express.static from auto-serving index.html for /
// so our explicit app.get('/') route (landing.html) takes over
app.use(express.static(path.join(__dirname, '../public'), { index: false }));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/landing.html'));
});
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});
app.get('/oauth-callback', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/oauth-callback.html'));
});
// Legal / static pages (clean URLs without .html)
app.get('/about',          (req, res) => res.sendFile(path.join(__dirname, '../public/about.html')));
app.get('/privacy',        (req, res) => res.sendFile(path.join(__dirname, '../public/privacy.html')));
app.get('/terms',          (req, res) => res.sendFile(path.join(__dirname, '../public/terms.html')));
app.get('/contact',        (req, res) => res.sendFile(path.join(__dirname, '../public/contact.html')));
app.get('/delete-account', (req, res) => res.sendFile(path.join(__dirname, '../public/delete-account.html')));

// ── API ROUTES ────────────────────────────────────────────
app.use('/api/auth',          authRouter);
app.use('/api/users',         usersRouter);
app.use('/api/analytics',     analyticsRouter);
app.use('/api/institutions',  institutionsRouter);
app.use('/api/join-requests', joinRequestsRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/feedback',      feedbackRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, version: '7.0.0', time: new Date().toISOString() });
});

// OTA version endpoint — bump APP_VERSION and drop new feeflow.apk in /public/
app.get('/api/version', (req, res) => {
  res.json({
    version:   process.env.APP_VERSION || '1.0.0',
    apkUrl:    '/feeflow.apk',
    changelog: process.env.APP_CHANGELOG || '',
  });
});

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── ERROR HANDLER ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── START ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════╗');
  console.log('  ║   FeeFlow Server  v7.0.0         ║');
  console.log('  ╚══════════════════════════════════╝');
  console.log('');
  console.log(`  ► Local:   http://localhost:${PORT}`);
  console.log(`  ► API:     http://localhost:${PORT}/api`);
  console.log(`  ► Health:  http://localhost:${PORT}/api/health`);
  console.log('');
  console.log(`  Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log('');
});
