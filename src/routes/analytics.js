// src/routes/analytics.js — usage stats (protected by ANALYTICS_KEY header)
const express = require('express');
const User = require('../models/User');

const router = express.Router();

function requireAnalyticsKey(req, res, next) {
  const key = req.headers['analytics-key'] || req.headers['x-analytics-key'];
  if (!key || key !== process.env.ANALYTICS_KEY) {
    return res.status(401).json({ error: 'Invalid analytics key' });
  }
  next();
}

// GET /api/analytics/stats
router.get('/stats', requireAnalyticsKey, async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const [totalUsers, newToday, newThisWeek, activeLastWeek, byRole] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ created_at: { $gte: startOfToday } }),
      User.countDocuments({ created_at: { $gte: startOfWeek } }),
      User.countDocuments({ last_seen: { $gte: startOfWeek } }),
      User.aggregate([
        { $group: { _id: '$primary_role', count: { $sum: 1 } } }
      ]),
    ]);

    const byRoleMap = {};
    for (const r of byRole) byRoleMap[r._id] = r.count;

    res.json({
      totalUsers,
      newToday,
      newThisWeek,
      byRole: {
        admin:  byRoleMap['admin']  || 0,
        member: byRoleMap['member'] || 0,
        both:   byRoleMap['both']   || 0,
      },
      activeLastWeek,
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
