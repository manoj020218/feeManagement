// src/models/Announcement.js
const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  inviteCode:   { type: String, required: true, uppercase: true, index: true },
  instName:     { type: String, required: true },
  adminUserId:  { type: String, required: true },
  type:         { type: String, enum: ['general', 'holiday', 'schedule_change', 'urgent'], default: 'general' },
  title:        { type: String, required: true, trim: true, maxlength: 120 },
  body:         { type: String, required: true, trim: true, maxlength: 1000 },
  date:         { type: Date, default: Date.now },  // when the event/holiday is (optional)
  createdAt:    { type: Date, default: Date.now },
}, { versionKey: false });

announcementSchema.index({ inviteCode: 1, createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
