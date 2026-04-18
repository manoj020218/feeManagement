// scripts/seed.js — create demo users in MongoDB
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/feeflow');
  console.log('🌱 Seeding FeeFlow MongoDB...\n');

  // ── ADMIN USER ────────────────────────────────────────
  const adminPhone = '9000000001';
  let admin = await User.findOne({ phone: adminPhone });

  if (!admin) {
    const pin_hash = await bcrypt.hash('1234', 10);
    admin = await User.create({
      _id:           uuid(),
      name:          'Demo Admin',
      phone:         adminPhone,
      pin_hash,
      primary_role:  'both',
      default_country: 'IN',
    });
    console.log('✅ Admin created — Phone: 9000000001 | PIN: 1234');
  } else {
    console.log('ℹ️  Admin already exists (phone: 9000000001)');
  }

  // ── MEMBER USER ───────────────────────────────────────
  const memberPhone = '9876543210';
  let member = await User.findOne({ phone: memberPhone });

  if (!member) {
    const pin_hash = await bcrypt.hash('5678', 10);
    await User.create({
      _id:           uuid(),
      name:          'Arjun Sharma',
      phone:         memberPhone,
      pin_hash,
      primary_role:  'member',
      default_country: 'IN',
    });
    console.log('✅ Member created — Phone: 9876543210 | PIN: 5678');
  } else {
    console.log('ℹ️  Member already exists (phone: 9876543210)');
  }

  console.log('\n═══════════════════════════════════════');
  console.log('  DEMO LOGIN CREDENTIALS');
  console.log('═══════════════════════════════════════');
  console.log('  Admin   → Phone: 9000000001 | PIN: 1234');
  console.log('  Member  → Phone: 9876543210 | PIN: 5678');
  console.log('═══════════════════════════════════════\n');

  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
