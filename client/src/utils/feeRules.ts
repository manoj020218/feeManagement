import { daysDiff, addFreq, todayISO } from './dateHelpers';
import type { Member, Institution, FeeStatus } from '@/core/types';

/**
 * Effective status of a member considering the institution's grace period.
 * A member is only "overdue" after nextDue + gracePeriod days have passed.
 */
export function effectiveStatus(member: Member, inst: Institution): FeeStatus {
  if (member.status === 'paid' || member.status === 'partial') return member.status;
  if (!member.nextDue) return member.status;

  const grace = inst.gracePeriod ?? 0;
  const days  = daysDiff(member.nextDue); // positive = future, negative = past due

  if (days >= 0) return member.status;              // not past due yet
  if (grace > 0 && Math.abs(days) <= grace) return 'due'; // within grace window
  return 'overdue';
}

/**
 * Net amount the member owes this cycle, factoring in any credit or arrears.
 *  - credit (balance > 0) reduces what is owed
 *  - arrears (balance < 0) add to what is owed
 */
export function netDue(member: Member): number {
  const balance = member.balance ?? 0;
  if (balance >= 0) return Math.max(0, member.fee - balance);
  return member.fee + Math.abs(balance);
}

/**
 * How many grace days are remaining for this member.
 * Returns null if not currently in grace window.
 */
export function graceRemaining(member: Member, inst: Institution): number | null {
  if (!member.nextDue) return null;
  const grace = inst.gracePeriod ?? 0;
  if (grace === 0) return null;
  const days = daysDiff(member.nextDue);
  if (days >= 0) return null;            // not past due
  const overdueDays = Math.abs(days);
  if (overdueDays <= grace) return grace - overdueDays;
  return null;
}

/**
 * Compute the result of recording a payment:
 *  - newBalance : updated running balance (0 if trackBalance is OFF)
 *  - newNextDue : advanced due date (extra cycles if autoAdvanceDue is ON)
 *  - newStatus  : 'paid' | 'partial'
 */
export function applyPayment(
  member: Member,
  inst: Institution,
  paid: number,
  paymentDate: string = todayISO(),
): { newBalance: number; newNextDue: string; newStatus: FeeStatus } {
  const trackBalance  = inst.trackBalance  !== false; // default ON
  const autoAdvanceDue = inst.autoAdvanceDue !== false; // default ON

  const prevBalance = trackBalance ? (member.balance ?? 0) : 0;
  let newBalance    = prevBalance + paid - member.fee;

  // Base next-due: advance by one cycle from current nextDue (or today)
  let newNextDue = member.nextDue
    ? addFreq(member.nextDue, member.freq)
    : addFreq(paymentDate, member.freq);

  // Auto-advance: each extra full fee absorbed = push nextDue one more cycle
  if (trackBalance && autoAdvanceDue && member.freq !== 'one-time') {
    while (newBalance >= member.fee) {
      newBalance -= member.fee;
      newNextDue  = addFreq(newNextDue, member.freq);
    }
  }

  const newStatus: FeeStatus = newBalance >= 0 ? 'paid' : 'partial';

  return {
    newBalance: trackBalance ? newBalance : 0,
    newNextDue,
    newStatus,
  };
}
