// src/routes/users.js
const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { safeUser } = require('./auth');
const { normalizePhone, validatePhone } = require('../utils/phone');

const router = express.Router();
router.use(requireAuth);

// PUT /api/users/me — update name, country, address, phone, PIN
router.put('/me', async (req, res) => {
  try {
    const { name, defaultCountry, address, bio, photo, phone, current_pin, new_pin } = req.body;
    const update = {};

    if (name) update.name = name.trim();
    if (defaultCountry) update.default_country = defaultCountry;
    if (address !== undefined) update.address = address ? address.trim() : null;
    if (bio !== undefined) update.bio = bio ? bio.trim().slice(0, 200) : null;
    if (photo !== undefined) update.photo = photo || null; // base64 string

    // Phone update
    if (phone !== undefined) {
      if (phone) {
        const country = defaultCountry || req.user.default_country || 'IN';
        const normPhone = normalizePhone(phone, 10);
        if (!validatePhone(normPhone, country)) {
          return res.status(400).json({ error: 'Invalid phone number' });
        }
        const existing = await User.findOne({ phone: normPhone, _id: { $ne: req.user._id } });
        if (existing) {
          return res.status(409).json({ error: 'Phone number already in use' });
        }
        update.phone = normPhone;
      } else {
        update.phone = null;
      }
    }

    // PIN update / set
    if (new_pin) {
      if (!/^\d{4}$/.test(new_pin)) {
        return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
      }
      // If user already has a PIN, require current_pin verification
      if (req.user.pin_hash) {
        if (!current_pin) {
          return res.status(400).json({ error: 'Current PIN is required to set a new PIN' });
        }
        const match = await bcrypt.compare(current_pin, req.user.pin_hash);
        if (!match) {
          return res.status(401).json({ error: 'Current PIN is incorrect' });
        }
      }
      update.pin_hash = await bcrypt.hash(new_pin, 10);
    }

    const user = await User.findById(req.user._id);
    Object.assign(user, update);
    await user.save();

    res.json({ user: safeUser(user.toObject()) });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
