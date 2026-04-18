/** Strips +91 / 0091 prefix, removes spaces, returns last `digits` characters */
export function normalizePhone(raw: string, digits = 10): string {
  let s = (raw || '').replace(/\s+/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  if (s.startsWith('0091')) s = s.slice(4);
  else if (s.startsWith('91') && s.length > digits) s = s.slice(2);
  return s.slice(-digits);
}

export function validatePhone(phone: string, countryCode = 'IN'): boolean {
  const digits = countryCode === 'SG' ? 8 : countryCode === 'AE' || countryCode === 'SA' ? 9 : 10;
  return /^\d+$/.test(phone) && phone.length === digits;
}

export function formatPhone(phone: string, dial: string): string {
  if (!phone) return '';
  return `${dial} ${phone.slice(0, 5)} ${phone.slice(5)}`;
}
