// src/routes/feedback.js
const express  = require('express');
const Feedback = require('../models/Feedback');
const InstitutionRegistry = require('../models/InstitutionRegistry');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/feedback  — member sends feedback to an institution
router.post('/', requireAuth, async (req, res) => {
  try {
    const { inviteCode, text } = req.body;
    if (!inviteCode || !text) {
      return res.status(400).json({ error: 'inviteCode and text are required' });
    }
    if (text.length > 300) {
      return res.status(400).json({ error: 'Feedback must be 300 characters or fewer' });
    }

    const reg = await InstitutionRegistry.findOne({ inviteCode: inviteCode.toUpperCase() });
    if (!reg) return res.status(404).json({ error: 'Institution not found' });

    const fb = await Feedback.create({
      inviteCode:  inviteCode.toUpperCase(),
      instName:    reg.name,
      memberId:    String(req.user._id),
      memberName:  req.user.name,
      memberPhone: req.user.phone || null,
      text:        text.trim(),
    });

    res.status(201).json({ ok: true, feedback: fb });
  } catch (err) {
    console.error('Feedback error:', err);
    res.status(500).json({ error: 'Failed to send feedback' });
  }
});

// GET /api/feedback/:code  — admin views feedback for their institution
router.get('/:code', requireAuth, async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const reg  = await InstitutionRegistry.findOne({ inviteCode: code });
    if (!reg) return res.status(404).json({ error: 'Institution not found' });
    if (reg.adminUserId !== String(req.user._id)) {
      return res.status(403).json({ error: 'Not your institution' });
    }

    const feedback = await Feedback.find({ inviteCode: code })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ feedback });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// PUT /api/feedback/:id/reply  — admin replies/reacts to feedback
router.put('/:id/reply', requireAuth, async (req, res) => {
  try {
    const fb = await Feedback.findById(req.params.id);
    if (!fb) return res.status(404).json({ error: 'Not found' });

    // Verify admin owns the institution
    const reg = await InstitutionRegistry.findOne({ inviteCode: fb.inviteCode });
    if (!reg || reg.adminUserId !== String(req.user._id)) {
      return res.status(403).json({ error: 'Not your institution' });
    }

    const { reply, reaction } = req.body;
    if (reply !== undefined) { fb.reply = reply ? reply.trim().slice(0, 500) : null; fb.repliedAt = new Date(); }
    if (reaction !== undefined) fb.reaction = reaction;
    await fb.save();

    res.json({ ok: true, feedback: fb });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update feedback' });
  }
});

module.exports = router;
