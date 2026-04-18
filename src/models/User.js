// src/models/User.js — Mongoose schema (VPS stores user identity only)
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  _id:             { type: String },          // uuid
  name:            { type: String, required: true, trim: true },
  phone:           { type: String, default: null },   // 10-digit normalized; null for Google-only users
  pin_hash:        { type: String, default: null },   // null for Google-only users
  google_id:       { type: String, default: null },   // Google sub claim
  email:           { type: String, default: null },               // from Google OAuth
  address:         { type: String, default: null },               // optional contact address
  photo:           { type: String, default: null },               // base64 data-url (compressed)
  bio:             { type: String, default: null, maxlength: 200 }, // short bio
  primary_role:    { type: String, enum: ['admin', 'member', 'both'], default: 'member' },
  default_country: { type: String, default: 'IN' },
  last_seen:       { type: Date, default: Date.now },
  created_at:      { type: Date, default: Date.now },
  sessions:        [{
    _id:         false,
    id:          { type: String },          // uuid
    deviceLabel: { type: String, default: 'Unknown Device' },
    ip:          { type: String, default: null },
    lastSeen:    { type: Date, default: Date.now },
    createdAt:   { type: Date, default: Date.now },
  }],
}, { _id: false, versionKey: false });

// Sparse unique indexes (allow multiple null values)
userSchema.index({ phone: 1 }, { unique: true, sparse: true });
userSchema.index({ google_id: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('User', userSchema);
