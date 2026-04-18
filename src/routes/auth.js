// src/routes/auth.js — JWT-based auth (MongoDB)
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const MAX_SESSIONS = 10; // keep last N sessions per user
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { normalizePhone, validatePhone } = require('../utils/phone');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const router = express.Router();

function deviceLabel(req) {
  const ua = req.headers['user-agent'] || '';
  if (/Android/i.test(ua))  return 'Android';
  if (/iPhone|iPad/i.test(ua)) return 'iOS';
  if (/Windows/i.test(ua))  return 'Windows';
  if (/Mac/i.test(ua))      return 'Mac';
  return 'Browser';
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || null;
}

async function recordSession(user, req) {
  const sessionId = uuid();
  const session = {
    id:          sessionId,
    deviceLabel: deviceLabel(req),
    ip:          clientIp(req),
    lastSeen:    new Date(),
    createdAt:   new Date(),
  };
  user.sessions = user.sessions || [];
  user.sessions.push(session);
  // trim oldest beyond MAX_SESSIONS
  if (user.sessions.length > MAX_SESSIONS) {
    user.sessions = user.sessions.slice(-MAX_SESSIONS);
  }
  await user.save();
  return sessionId;
}

function signTokens(userId, sessionId) {
  const accessToken = jwt.sign(
    { sub: userId, sid: sessionId },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  const refreshToken = jwt.sign(
    { sub: userId, sid: sessionId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '30d' }
  );
  return { accessToken, refreshToken };
}

function safeUser(u) {
  if (!u) return null;
  const { pin_hash, __v, ...safe } = u;
  safe.has_pin = !!pin_hash;  // let frontend know if a PIN is set without exposing the hash
  return safe;
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, phone, pin, primaryRole = 'member', country = process.env.DEFAULT_COUNTRY || 'IN' } = req.body;

    if (!name || !phone || !pin) {
      return res.status(400).json({ error: 'name, phone and pin are required' });
    }
    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    }

    const normPhone = normalizePhone(phone, 10);
    if (!validatePhone(normPhone, country)) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    const existing = await User.findOne({ phone: normPhone });
    if (existing) {
      return res.status(409).json({ error: 'Phone number already registered' });
    }

    const pin_hash = await bcrypt.hash(pin, 10);
    const id = uuid();
    const user = await User.create({
      _id: id,
      name: name.trim(),
      phone: normPhone,
      pin_hash,
      primary_role: primaryRole,
      default_country: country,
    });

    const sessionId = await recordSession(user, req);
    const { accessToken, refreshToken } = signTokens(id, sessionId);
    res.status(201).json({ accessToken, refreshToken, user: safeUser(user.toObject()) });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { phone, pin, country = process.env.DEFAULT_COUNTRY || 'IN' } = req.body;

    if (!phone || !pin) {
      return res.status(400).json({ error: 'phone and pin are required' });
    }

    const normPhone = normalizePhone(phone, 10);
    const user = await User.findOne({ phone: normPhone });

    if (!user) {
      return res.status(401).json({ error: 'Phone number not found' });
    }

    const match = await bcrypt.compare(pin, user.pin_hash);
    if (!match) {
      return res.status(401).json({ error: 'Incorrect PIN' });
    }

    user.last_seen = new Date();
    const sessionId = await recordSession(user, req);
    const { accessToken, refreshToken } = signTokens(user._id, sessionId);
    res.json({ accessToken, refreshToken, user: safeUser(user.toObject()) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken is required' });
    }

    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'User not found' });

    // Update lastSeen for the session if it still exists
    const sid = payload.sid;
    if (sid) {
      const sess = user.sessions && user.sessions.find(s => s.id === sid);
      if (sess) { sess.lastSeen = new Date(); await user.save(); }
    }

    const { accessToken, refreshToken: newRefresh } = signTokens(user._id, sid || uuid());
    res.json({ accessToken, refreshToken: newRefresh });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// GET /api/auth/sessions
router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const currentToken = (req.headers['authorization'] || '').replace('Bearer ', '');
    let currentSid = null;
    try {
      const p = jwt.decode(currentToken);
      currentSid = p && p.sid;
    } catch (_) {}

    const sessions = (user.sessions || []).slice().reverse().map(s => ({
      id:          s.id,
      deviceLabel: s.deviceLabel,
      ip:          s.ip,
      lastSeen:    s.lastSeen,
      createdAt:   s.createdAt,
      isCurrent:   s.id === currentSid,
    }));

    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// DELETE /api/auth/sessions/:id  — revoke a specific session
router.delete('/sessions/:id', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const targetId = req.params.id;
    const before = (user.sessions || []).length;
    user.sessions = (user.sessions || []).filter(s => s.id !== targetId);
    if (user.sessions.length === before) {
      return res.status(404).json({ error: 'Session not found' });
    }
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

// DELETE /api/auth/sessions/others  — revoke all sessions except current
router.delete('/sessions/others', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const currentToken = (req.headers['authorization'] || '').replace('Bearer ', '');
    let currentSid = null;
    try {
      const p = jwt.decode(currentToken);
      currentSid = p && p.sid;
    } catch (_) {}
    user.sessions = (user.sessions || []).filter(s => s.id === currentSid);
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke sessions' });
  }
});

// POST /api/auth/logout — client discards tokens (stateless)
router.post('/logout', (req, res) => {
  res.json({ ok: true });
});

// POST /api/auth/google — Google ID token login / auto-register
router.post('/google', async (req, res) => {
  try {
    const { id_token, primary_role = 'member', country = process.env.DEFAULT_COUNTRY || 'IN' } = req.body;
    if (!id_token) {
      return res.status(400).json({ error: 'id_token is required' });
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: 'Google login not configured on server' });
    }

    // Verify the ID token with Google
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    const { sub: google_id, email, name: googleName, picture } = payload;

    // Find existing user by google_id or email
    let user = await User.findOne({ google_id });
    if (!user && email) {
      user = await User.findOne({ email });
    }

    if (user) {
      // Existing user — link google_id if not already set
      if (!user.google_id) {
        user.google_id = google_id;
        await user.save();
      }
      user.last_seen = new Date();
      await user.save();
    } else {
      // New user — auto-register with Google identity
      const id = uuid();
      user = await User.create({
        _id: id,
        name: googleName || email.split('@')[0],
        email,
        google_id,
        phone: null,
        pin_hash: null,
        primary_role,
        default_country: country,
      });
    }

    const sessionId = await recordSession(user, req);
    const { accessToken, refreshToken } = signTokens(user._id, sessionId);
    res.json({ accessToken, refreshToken, user: safeUser(user.toObject()), isNew: !payload });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: 'Google login failed' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { last_seen: new Date() });
    res.json({ user: safeUser(req.user) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
module.exports.safeUser = safeUser;
