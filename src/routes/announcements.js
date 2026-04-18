// src/routes/announcements.js
const express  = require('express');
const Announcement = require('../models/Announcement');
const InstitutionRegistry = require('../models/InstitutionRegistry');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/announcements  — admin creates announcement (broadcast)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { inviteCode, type = 'general', title, body, date } = req.body;
    if (!inviteCode || !title || !body) {
      return res.status(400).json({ error: 'inviteCode, title and body are required' });
    }

    // Verify admin owns this institution
    const reg = await InstitutionRegistry.findOne({ inviteCode: inviteCode.toUpperCase() });
    if (!reg) return res.status(404).json({ error: 'Institution not found' });
    if (reg.adminUserId !== String(req.user._id)) {
      return res.status(403).json({ error: 'Not your institution' });
    }

    const ann = await Announcement.create({
      inviteCode: inviteCode.toUpperCase(),
      instName:   reg.name,
      adminUserId: String(req.user._id),
      type,
      title: title.trim(),
      body:  body.trim(),
      date:  date ? new Date(date) : new Date(),
    });

    res.status(201).json({ ok: true, announcement: ann });
  } catch (err) {
    console.error('Announcement error:', err);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// GET /api/announcements?codes=AB12CD,XY34EF  — member fetches for joined institutions
router.get('/', requireAuth, async (req, res) => {
  try {
    const codesParam = req.query.codes || '';
    const codes = codesParam.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
    if (codes.length === 0) return res.json({ announcements: [] });

    const announcements = await Announcement.find({ inviteCode: { $in: codes } })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ announcements });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// GET /api/announcements/mine  — admin sees their own institution's announcements
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const announcements = await Announcement.find({ adminUserId: String(req.user._id) })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ announcements });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// DELETE /api/announcements/:id  — admin deletes their announcement
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const ann = await Announcement.findById(req.params.id);
    if (!ann) return res.status(404).json({ error: 'Not found' });
    if (ann.adminUserId !== String(req.user._id)) {
      return res.status(403).json({ error: 'Not your announcement' });
    }
    await ann.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;
