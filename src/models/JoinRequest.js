// src/models/JoinRequest.js
// Stores member self-join requests pending admin approval.
const mongoose = require('mongoose');

const JoinRequestSchema = new mongoose.Schema({
  inviteCode:  { type: String, required: true, uppercase: true, trim: true },
  name:        { type: String, required: true, trim: true },
  phone:       { type: String, required: true, trim: true },
  plan:        { type: String, default: '' },
  status:      { type: String, enum: ['pending','approved','rejected','hold'], default: 'pending' },
  reason:      { type: String, default: '' },   // admin's reason for hold/reject
  createdAt:   { type: Date, default: Date.now },
  resolvedAt:  { type: Date },
}, { versionKey: false });

JoinRequestSchema.index({ inviteCode: 1, createdAt: -1 });
JoinRequestSchema.index({ phone: 1, inviteCode: 1 });

module.exports = mongoose.model('JoinRequest', JoinRequestSchema);
