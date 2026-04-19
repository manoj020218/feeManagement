import { Share } from '@capacitor/share';
import { formatCurrency, getCountry } from '@/data/countries';

export const FEEFLOW_APP_URL = 'https://feeflow.iotsoft.in/';

interface ReceiptShareTextArgs {
  institutionName: string;
  memberName: string;
  amount: number;
  period: string;
  receiptNo: string;
  paidDate: string;
  payMode: string;
  nextDue?: string;
  inviteCode?: string;
  appLink?: string;
  countryCode?: string;
}

function digitsOnly(value: string): string {
  return (value || '').replace(/\D/g, '');
}

export function normalizePhoneForMessaging(phone: string, countryCode: string): string {
  const country = getCountry(countryCode);
  const raw = digitsOnly(phone);
  const dial = digitsOnly(country.dial);

  if (!raw) return '';
  if (raw.startsWith(dial) && raw.length >= dial.length + country.digits) return raw;
  return `${dial}${raw.slice(-country.digits)}`;
}

export function buildWhatsAppShareUrl(
  phone: string | undefined,
  text: string,
  countryCode: string,
): string | null {
  if (!phone) return null;
  const target = normalizePhoneForMessaging(phone, countryCode);
  if (!target) return null;
  return `https://wa.me/${target}?text=${encodeURIComponent(text)}`;
}

export function buildWhatsAppAppUrl(
  phone: string | undefined,
  text: string,
  countryCode: string,
): string | null {
  if (!phone) return null;
  const target = normalizePhoneForMessaging(phone, countryCode);
  if (!target) return null;
  return `whatsapp://send?phone=${target}&text=${encodeURIComponent(text)}`;
}

export function buildSmsShareUrl(
  phone: string | undefined,
  text: string,
  countryCode: string,
): string | null {
  if (!phone) return null;
  const target = normalizePhoneForMessaging(phone, countryCode);
  if (!target) return null;
  return `sms:+${target}?body=${encodeURIComponent(text)}`;
}

export function buildReceiptShareText({
  institutionName,
  memberName,
  amount,
  period,
  receiptNo,
  paidDate,
  payMode,
  nextDue,
  inviteCode,
  appLink = FEEFLOW_APP_URL,
  countryCode = 'IN',
}: ReceiptShareTextArgs): string {
  const lines = [
    `Payment received from ${institutionName}`,
    '',
    `Hello ${memberName},`,
    'Your payment has been recorded successfully.',
    '',
    `Receipt No: ${receiptNo}`,
    `Amount: ${formatCurrency(amount, countryCode)}`,
    `Date: ${paidDate}`,
    `Mode: ${payMode}`,
    period ? `Period: ${period}` : '',
    nextDue ? `Next due: ${nextDue}` : '',
    '',
    inviteCode
      ? `Track your payments on FeeFlow with invite code ${inviteCode}: ${appLink}`
      : `Track your payments on FeeFlow: ${appLink}`,
  ];

  return lines.filter(Boolean).join('\n');
}

export function shareViralInvite(
  inviteCode: string,
  institutionName: string,
  appLink: string = FEEFLOW_APP_URL,
) {
  const message = [
    `${institutionName} uses FeeFlow for smart fee management.`,
    '',
    `Join with code: ${inviteCode}`,
    `Install FeeFlow: ${appLink}`,
    '',
    'Track fees, get receipts on WhatsApp, and keep everything private.',
  ].join('\n');

  return Share.share({
    title: 'Invite to join',
    text: message,
    dialogTitle: 'Share via',
  });
}

export function shareReceiptText(
  instName: string,
  memberName: string,
  amount: number,
  period: string,
  receiptNo: string,
  appLink: string = FEEFLOW_APP_URL,
  countryCode: string = 'IN',
) {
  const text = buildReceiptShareText({
    institutionName: instName,
    memberName,
    amount,
    period,
    receiptNo,
    paidDate: new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    payMode: 'Recorded',
    appLink,
    countryCode,
  });

  return Share.share({
    title: 'Receipt',
    text,
    dialogTitle: 'Share receipt',
  });
}
