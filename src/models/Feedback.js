// src/models/Feedback.js
const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  inviteCode:   { type: String, required: true, uppercase: true, index: true },
  instName:     { type: String },
  memberId:     { type: String, required: true },   // User._id of sender
  memberName:   { type: String, default: 'Member' },
  memberPhone:  { type: String, default: null },
  text:         { type: String, required: true, trim: true, maxlength: 300 },
  // Admin reply
  reply:        { type: String, default: null, maxlength: 500 },
  repliedAt:    { type: Date, default: null },
  reaction:     { type: String, enum: ['none','thumbs_up','heart','noted'], default: 'none' },
  createdAt:    { type: Date, default: Date.now },
}, { versionKey: false });

feedbackSchema.index({ inviteCode: 1, createdAt: -1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
