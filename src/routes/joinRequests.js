// src/routes/joinRequests.js
// Member self-join with admin approval flow.
const express = require('express');
const JoinRequest = require('../models/JoinRequest');
const InstitutionRegistry = require('../models/InstitutionRegistry');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ── POST /api/join-requests ────────────────────────────────────────
// Member submits a join request. No auth required.
router.post('/', async (req, res) => {
  try {
    const { inviteCode, name, phone, plan } = req.body;
    if (!inviteCode || !name || !phone) {
      return res.status(400).json({ error: 'inviteCode, name, and phone are required' });
    }
    const code = inviteCode.toUpperCase().trim();

    // Validate invite code exists in the published registry
    const inst = await InstitutionRegistry.findOne({ inviteCode: code });
    if (!inst) {
      return res.status(404).json({ error: 'Institution not found. Check the invite code.' });
    }

    // If a pending request from same phone already exists, return it (idempotent)
    const existing = await JoinRequest.findOne({ inviteCode: code, phone: phone.trim(), status: 'pending' });
    if (existing) {
      return res.json({ id: existing._id, status: 'pending' });
    }

    const jr = await JoinRequest.create({
      inviteCode: code,
      name:       name.trim(),
      phone:      phone.trim(),
      plan:       plan ?? '',
    });
    res.json({ id: jr._id, status: 'pending' });
  } catch (err) {
    console.error('Join request create error:', err);
    res.status(500).json({ error: 'Failed to create join request' });
  }
});

// ── GET /api/join-requests/status/:phone/:inviteCode ───────────────
// Member polls their own request status. No auth required.
// NOTE: Must be declared BEFORE /:inviteCode to avoid Express matching 'status' as an inviteCode.
router.get('/status/:phone/:inviteCode', async (req, res) => {
  try {
    const code  = req.params.inviteCode.toUpperCase().trim();
    const phone = req.params.phone.trim();
    // Return most recent request from this phone for this code
    const jr = await JoinRequest.findOne({ inviteCode: code, phone }).sort({ createdAt: -1 });
    if (!jr) return res.status(404).json({ error: 'No request found' });
    res.json({ status: jr.status, reason: jr.reason || '' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// ── GET /api/join-requests/:inviteCode ────────────────────────────
// Admin fetches all requests for their institution. Auth required.
router.get('/:inviteCode', requireAuth, async (req, res) => {
  try {
    const code = req.params.inviteCode.toUpperCase().trim();

    // Verify admin owns this institution
    const inst = await InstitutionRegistry.findOne({ inviteCode: code });
    if (!inst) return res.status(404).json({ error: 'Institution not found' });
    if (inst.adminUserId !== String(req.user._id)) {
      return res.status(403).json({ error: 'Not your institution' });
    }

    const requests = await JoinRequest.find({ inviteCode: code }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch join requests' });
  }
});

// ── PATCH /api/join-requests/:id ──────────────────────────────────
// Admin approves / rejects / holds a request. Auth required.
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { status, reason } = req.body;
    if (!['approved', 'rejected', 'hold'].includes(status)) {
      return res.status(400).json({ error: 'status must be approved, rejected, or hold' });
    }

    const jr = await JoinRequest.findById(req.params.id);
    if (!jr) return res.status(404).json({ error: 'Request not found' });

    // Verify admin owns this institution
    const inst = await InstitutionRegistry.findOne({ inviteCode: jr.inviteCode });
    if (!inst || inst.adminUserId !== String(req.user._id)) {
      return res.status(403).json({ error: 'Not your institution' });
    }

    jr.status     = status;
    jr.reason     = reason ?? '';
    jr.resolvedAt = new Date();
    await jr.save();

    res.json({ ok: true, status: jr.status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update join request' });
  }
});

module.exports = router;
