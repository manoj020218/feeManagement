// src/utils/phone.js — mirrors the normalizePhone logic in the frontend

function normalizePhone(raw, digits = 10) {
  if (!raw) return '';
  let n = raw.toString().replace(/[^0-9]/g, '');
  if (!n) return '';
  if (digits === 10) {
    if (n.length === 14 && n.startsWith('0091')) n = n.slice(4);
    else if (n.length === 13 && n.startsWith('091')) n = n.slice(3);
    else if (n.length === 12 && n.startsWith('91'))  n = n.slice(2);
    else if (n.length === 11 && n.startsWith('0'))   n = n.slice(1);
    if (n.length > digits) n = n.slice(-digits);
  } else {
    if (n.length > digits) n = n.slice(-digits);
  }
  return n;
}

function validatePhone(norm, country = 'IN') {
  if (!norm) return false;
  const digits = country === 'IN' ? 10 : 10;
  if (norm.length !== digits) return false;
  if (country === 'IN') return /^[6-9]\d{9}$/.test(norm);
  return /^\d+$/.test(norm);
}

module.exports = { normalizePhone, validatePhone };
