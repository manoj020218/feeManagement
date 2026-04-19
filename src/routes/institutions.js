// src/routes/institutions.js
// POST /api/institutions/publish  — admin publishes/updates an institution to the member directory
// GET  /api/institutions/lookup/:code — public: member looks up institution by invite code
// DELETE /api/institutions/:code — admin unpublishes their institution
const express = require('express');
const InstitutionRegistry = require('../models/InstitutionRegistry');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/institutions/publish  (auth required)
router.post('/publish', requireAuth, async (req, res) => {
  try {
    const { inviteCode, name, type, address = '', plans = [] } = req.body;

    if (!inviteCode || !name || !type) {
      return res.status(400).json({ error: 'inviteCode, name and type are required' });
    }
    if (inviteCode.length < 4 || inviteCode.length > 12) {
      return res.status(400).json({ error: 'inviteCode must be 4–12 characters' });
    }

    const admin = req.user;

    // Check if another admin already owns this code
    const existing = await InstitutionRegistry.findOne({ inviteCode: inviteCode.toUpperCase() });
    if (existing && existing.adminUserId !== String(admin._id)) {
      return res.status(409).json({ error: 'This invite code is already taken by another institution' });
    }

    const doc = await InstitutionRegistry.findOneAndUpdate(
      { inviteCode: inviteCode.toUpperCase() },
      {
        inviteCode: inviteCode.toUpperCase(),
        name:        name.trim(),
        type,
        address:     address.trim(),
        adminUserId: String(admin._id),
        adminName:   admin.name,
        adminPhone:  admin.phone ?? null,
        plans,
        updatedAt:   new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ ok: true, registry: doc });
  } catch (err) {
    console.error('Publish error:', err);
    res.status(500).json({ error: 'Failed to publish institution' });
  }
});

// GET /api/institutions/lookup/:code?phone=PHONE  (public — no auth needed)
// If phone is provided and matches a preMembers entry, returns preAssigned plan lock.
router.get('/lookup/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase().trim();
    const doc = await InstitutionRegistry.findOne({ inviteCode: code });
    if (!doc) {
      return res.status(404).json({ error: 'Institution not found. Check the invite code.' });
    }

    // Check for pre-assigned plan lock
    const phone = req.query.phone ? String(req.query.phone).trim() : null;
    let preAssigned = null;
    if (phone && doc.preMembers && doc.preMembers.length > 0) {
      const pm = doc.preMembers.find(p => p.phone === phone);
      if (pm) preAssigned = { plan: pm.plan, fee: pm.fee, freq: pm.freq };
    }

    res.json({
      inviteCode:      doc.inviteCode,
      name:            doc.name,
      type:            doc.type,
      address:         doc.address,
      adminName:       doc.adminName,
      adminPhone:      doc.adminPhone,
      plans:           doc.plans,
      requireApproval: doc.requireApproval ?? false,
      preAssigned,
    });
  } catch (err) {
    console.error('Lookup error:', err);
    res.status(500).json({ error: 'Lookup failed' });
  }
});

// PUT /api/institutions/:code  — admin updates institute profile (description, logo, achievements)
router.put('/:code', requireAuth, async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const doc  = await InstitutionRegistry.findOne({ inviteCode: code });
    if (!doc) return res.status(404).json({ error: 'Institution not found' });
    if (doc.adminUserId !== String(req.user._id)) {
      return res.status(403).json({ error: 'Not your institution' });
    }
    const { name, address, description, logo, achievements, plans, requireApproval } = req.body;
    if (name)                        doc.name            = name.trim();
    if (address !== undefined)       doc.address         = address.trim();
    if (description !== undefined)   doc.description     = description.slice(0, 500);
    if (logo !== undefined)          doc.logo            = logo || null;
    if (Array.isArray(achievements)) doc.achievements    = achievements.slice(0, 10);
    if (Array.isArray(plans))        doc.plans           = plans;
    if (requireApproval !== undefined) doc.requireApproval = !!requireApproval;
    doc.updatedAt = new Date();
    await doc.save();
    res.json({ ok: true, registry: doc });
  } catch (err) {
    console.error('Update institution error:', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// PUT /api/institutions/:code/pre-members  (auth required)
// Upserts a phone→plan lock so that member cannot pick a different plan when joining.
// Called automatically when admin adds/edits a member with a phone number.
router.put('/:code/pre-members', requireAuth, async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const doc  = await InstitutionRegistry.findOne({ inviteCode: code });
    if (!doc) return res.status(404).json({ error: 'Institution not found' });
    if (doc.adminUserId !== String(req.user._id)) {
      return res.status(403).json({ error: 'Not your institution' });
    }
    const { phone, plan, fee, freq } = req.body;
    if (!phone || !plan) return res.status(400).json({ error: 'phone and plan are required' });

    const idx = doc.preMembers.findIndex(p => p.phone === phone);
    if (idx >= 0) {
      doc.preMembers[idx] = { phone, plan, fee: fee ?? 0, freq: freq ?? 'monthly' };
    } else {
      doc.preMembers.push({ phone, plan, fee: fee ?? 0, freq: freq ?? 'monthly' });
    }
    doc.updatedAt = new Date();
    await doc.save();
    res.json({ ok: true });
  } catch (err) {
    console.error('Pre-member register error:', err);
    res.status(500).json({ error: 'Failed to register pre-member' });
  }
});

// DELETE /api/institutions/:code  (auth required — admin removes their listing)
router.delete('/:code', requireAuth, async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const doc = await InstitutionRegistry.findOne({ inviteCode: code });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.adminUserId !== String(req.user._id)) {
      return res.status(403).json({ error: 'Not your institution' });
    }
    await doc.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove listing' });
  }
});

module.exports = router;
