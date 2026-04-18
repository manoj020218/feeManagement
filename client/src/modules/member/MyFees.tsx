import { useAppStore } from '@/core/store/useAppStore';
import { th } from '@/data/institutionTypes';
import { fmtDate, fmtDateShort, daysDiff } from '@/utils/dateHelpers';

export default function MyFees() {
  const { memberships, defaultCountry } = useAppStore();
  const currency = defaultCountry === 'IN' ? '₹' : '$';

  if (memberships.length === 0) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 14 }}>🔗</div>
      <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 8 }}>No memberships yet</div>
      <div style={{ fontSize: '.82rem' }}>Tap <strong>Join</strong> below to join an institution using an invite code</div>
    </div>
  );

  return (
    <div style={{ padding: '16px 16px 0' }}>
      {memberships.map(ms => {
        const t     = th(ms.instType);
        const days  = ms.nextDue ? daysDiff(ms.nextDue) : null;
        const isOverdue = ms.status === 'overdue';
        const isDue     = ms.status === 'due';
        const isPaid    = ms.status === 'paid';
        const statusColor = isOverdue ? 'var(--red)' : isDue ? 'var(--yellow)' : 'var(--green)';
        const statusLabel = isOverdue ? 'OVERDUE' : isDue ? 'DUE' : isPaid ? 'PAID' : ms.status.toUpperCase();

        return (
          <div key={ms.id} className="card" style={{ marginBottom: 14, padding: 0, overflow: 'hidden' }}>

            {/* Header strip */}
            <div style={{
              background: `linear-gradient(135deg, ${t.color}22 0%, ${t.color}10 100%)`,
              borderBottom: `1px solid ${t.color}33`,
              padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              {/* Icon */}
              <div style={{
                width: 48, height: 48, borderRadius: 13,
                background: `${t.color}30`, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: '1.6rem', flexShrink: 0,
              }}>
                {t.icon}
              </div>

              {/* Name + type */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '.97rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ms.instName}
                </div>
                <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 2 }}>
                  {t.label}
                  {ms.instAddress && <> · {ms.instAddress}</>}
                </div>
              </div>

              {/* JOINED badge */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span style={{
                  fontSize: '.6rem', fontWeight: 800, padding: '3px 8px', borderRadius: 99,
                  background: 'rgba(52,199,89,.18)', color: 'var(--green)',
                  display: 'block', marginBottom: 4,
                }}>JOINED</span>
                <div style={{ fontSize: '.65rem', color: 'var(--muted)' }}>
                  {fmtDateShort(ms.joinDate)}
                </div>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '12px 16px' }}>

              {/* Plan / Fee / Status row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                <MiniStat label="Plan"      value={ms.myPlan} />
                <MiniStat label={`Fee (${ms.freq ?? 'monthly'})`}
                          value={`${currency}${ms.myFee.toLocaleString()}`}
                          color="var(--member-accent)" />
                <MiniStat label="Status"    value={statusLabel} color={statusColor} />
              </div>

              {/* Next due bar */}
              {ms.nextDue && (
                <div style={{
                  padding: '9px 13px', borderRadius: 8, marginBottom: 10,
                  background: `${statusColor}18`, border: `1px solid ${statusColor}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: '.78rem', fontWeight: 700, color: statusColor }}>
                    {isOverdue ? '⚠ Overdue since' : isDue ? '⏰ Due on' : '✓ Next due'}
                  </span>
                  <span style={{ fontSize: '.82rem', fontWeight: 800, color: statusColor }}>
                    {fmtDate(ms.nextDue)}
                    {days !== null && Math.abs(days) <= 10 && (
                      <span style={{ fontSize: '.7rem', marginLeft: 6, opacity: .8 }}>
                        ({days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? 'today' : `in ${days}d`})
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Last payment */}
              {ms.lastPayment ? (
                <div style={{
                  padding: '8px 13px', borderRadius: 8,
                  background: 'rgba(52,199,89,.07)', border: '1px solid rgba(52,199,89,.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: '.75rem', color: 'var(--green)', fontWeight: 600 }}>
                    ✓ Last paid · {fmtDateShort(ms.lastPayment.date)}
                  </span>
                  <span style={{ fontSize: '.82rem', fontWeight: 800, color: 'var(--green)' }}>
                    {currency}{ms.lastPayment.amount.toLocaleString()}
                    <span style={{ fontSize: '.7rem', fontWeight: 400, opacity: .7, marginLeft: 5 }}>
                      {ms.lastPayment.mode}
                    </span>
                  </span>
                </div>
              ) : (
                <div style={{ fontSize: '.73rem', color: 'var(--muted)', textAlign: 'center', padding: '4px 0' }}>
                  No payments recorded yet
                </div>
              )}

              {/* Admin contact */}
              {ms.adminName && (
                <div style={{ marginTop: 10, fontSize: '.72rem', color: 'var(--muted)' }}>
                  Admin: <span style={{ color: 'var(--text)' }}>{ms.adminName}</span>
                  {ms.adminPhone && <> · {ms.adminPhone}</>}
                  <span style={{ marginLeft: 8, opacity: .6 }}>Code: {ms.inviteCode}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: '.62rem', color: 'var(--muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: .4 }}>{label}</div>
      <div style={{ fontSize: '.82rem', fontWeight: 700, color: color ?? 'var(--text)' }}>{value}</div>
    </div>
  );
}
