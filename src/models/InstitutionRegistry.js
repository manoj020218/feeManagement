// src/models/InstitutionRegistry.js
// Stores published institution invite codes so members can look them up by code.
// Only basic public info — no financial data.
const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  _id:   false,
  name:  { type: String, required: true },
  fee:   { type: Number, required: true },
  freq:  { type: String, default: 'monthly' },
});

const registrySchema = new mongoose.Schema({
  inviteCode:  { type: String, required: true, unique: true, uppercase: true, trim: true },
  name:        { type: String, required: true, trim: true },
  type:        { type: String, required: true },
  address:     { type: String, default: '' },
  adminUserId: { type: String, required: true },   // User._id of the publishing admin
  adminName:   { type: String, default: '' },
  adminPhone:  { type: String, default: null },
  plans:        [planSchema],
  description:     { type: String, default: '', maxlength: 500 },  // promotional description
  logo:            { type: String, default: null },                 // base64 data-url
  achievements:    [{ type: String }],                             // short strings e.g. "Est. 2010"
  requireApproval: { type: Boolean, default: false },              // admin must approve each join
  publishedAt:     { type: Date, default: Date.now },
  updatedAt:       { type: Date, default: Date.now },
}, { versionKey: false });

registrySchema.index({ adminUserId: 1 });

module.exports = mongoose.model('InstitutionRegistry', registrySchema);
