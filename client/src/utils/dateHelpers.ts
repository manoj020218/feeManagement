import type { PayFreq } from '@/core/types';

export function addFreq(dateStr: string, freq: PayFreq): string {
  const d = new Date(dateStr);
  switch (freq) {
    case 'monthly':     d.setMonth(d.getMonth() + 1); break;
    case 'quarterly':   d.setMonth(d.getMonth() + 3); break;
    case 'half-yearly': d.setMonth(d.getMonth() + 6); break;
    case 'yearly':      d.setFullYear(d.getFullYear() + 1); break;
    case 'one-time':    return dateStr;
  }
  return d.toISOString().slice(0, 10);
}

export function daysDiff(dateStr: string): number {
  const now = new Date(); now.setHours(0,0,0,0);
  const target = new Date(dateStr); target.setHours(0,0,0,0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

export function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

export function fmtDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dueLabel(days: number): string {
  if (days < 0)  return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days <= 7)  return `Due in ${days}d`;
  return '';
}
