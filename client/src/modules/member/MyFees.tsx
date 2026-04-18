import { useState } from 'react';
import { useAppStore } from '@/core/store/useAppStore';
import { th } from '@/data/institutionTypes';
import { fmtDate, fmtDateShort, daysDiff } from '@/utils/dateHelpers';
import { formatCurrency } from '@/data/countries';
import JoinFlow from '@/modules/member/JoinFlow';
import ShareBanner from '@/modules/member/ShareBanner';

export default function MyFees() {
  const memberships = useAppStore(s => s.memberships);
const institutions = useAppStore(s => s.institutions);
const user = useAppStore(s => s.user);
const defaultCountry = useAppStore(s => s.defaultCountry);
  const allMembers      = useAppStore(s => s.members);
  const allTransactions = useAppStore(s => s.transactions);
  const [expandedTxn, setExpandedTxn] = useState<string | null>(null);
  const currency = defaultCountry === 'IN' ? '₹' : '$';
  const [showJoinFlow, setShowJoinFlow] = useState(false);

  // Empty state: no memberships yet
  if (memberships.length === 0) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 14 }}>🔗</div>
      <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 8 }}>No memberships yet</div>
      <div style={{ fontSize: '.82rem', marginBottom: 32 }}>
        Tap <strong>Join</strong> below to join an institution using an invite code
      </div>

      {/* Big round plus button */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={() => setShowJoinFlow(true)}
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'var(--member-accent)',
            border: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.1s ease',
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <span style={{ fontSize: '2.5rem', fontWeight: 300, color: 'white', lineHeight: 1 }}>+</span>
        </button>
      </div>

      {/* JoinFlow modal overlay */}
      {showJoinFlow && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowJoinFlow(false);
          }}
        >
          <div
            style={{
              background: 'var(--s1)',
              borderRadius: 'var(--r3)',
              width: '100%',
              maxWidth: 480,
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 35px rgba(0,0,0,0.3)',
            }}
          >
            <JoinFlow
              onJoined={() => {
                setShowJoinFlow(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );

  // Has memberships – display list (original code unchanged)
  return (
    <div style={{ padding: '16px 16px 0' }}>
      {memberships.map(ms => {
        const t = th(ms.instType);

        // Cross-reference live admin-side member record (same device)
        const inst          = institutions.find(i => i.inviteCode === ms.inviteCode);
        const instMembers   = inst ? (allMembers[inst.id] ?? []) : [];
        const myRecord      = instMembers.find(m => m.phone && user?.phone && m.phone === user.phone);

        // Prefer live record values — fall back to membership snapshot
        const liveNextDue   = myRecord?.nextDue  ?? ms.nextDue;
        const liveStatus    = myRecord?.status   ?? ms.status;
        const liveFee       = myRecord?.fee      ?? ms.myFee;
        const liveBalance   = myRecord?.balance  ?? 0;

        const days        = liveNextDue ? daysDiff(liveNextDue) : null;
        const isOverdue   = liveStatus === 'overdue';
        const isDue       = liveStatus === 'due';
        const isPaid      = liveStatus === 'paid';
        const statusColor = isOverdue ? 'var(--red)' : isDue ? 'var(--yellow)' : 'var(--green)';
        const statusLabel = isOverdue ? 'OVERDUE' : isDue ? 'DUE' : isPaid ? 'PAID' : liveStatus.toUpperCase();

        return (
          <div key={ms.id} className="card" style={{ marginBottom: 14, padding: 0, overflow: 'hidden' }}>

            {/* Header strip */}
            <div style={{
              background: `linear-gradient(135deg, ${t.color}22 0%, ${t.color}10 100%)`,
              borderBottom: `1px solid ${t.color}33`,
              padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 13,
                background: `${t.color}30`, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: '1.6rem', flexShrink: 0,
              }}>
                {t.icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '.97rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ms.instName}
                </div>
                <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 2 }}>
                  {t.label}
                  {ms.instAddress && <> · {ms.instAddress}</>}
                </div>
              </div>

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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                <MiniStat label="Plan"   value={ms.myPlan} />
                <MiniStat label={`Fee (${ms.freq ?? 'monthly'})`}
                          value={`${currency}${liveFee.toLocaleString()}`}
                          color="var(--member-accent)" />
                <MiniStat label="Status" value={statusLabel} color={statusColor} />
              </div>

              {/* Balance badge — shown when advance credit or arrears exist */}
              {liveBalance !== 0 && (
                <div style={{
                  padding: '7px 13px', borderRadius: 8, marginBottom: 8,
                  background: liveBalance > 0 ? 'rgba(52,199,89,.08)' : 'rgba(255,92,92,.08)',
                  border: `1px solid ${liveBalance > 0 ? 'rgba(52,199,89,.2)' : 'rgba(255,92,92,.2)'}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: '.75rem', fontWeight: 600, color: liveBalance > 0 ? 'var(--green)' : 'var(--red)' }}>
                    {liveBalance > 0 ? '✓ Advance credit' : '⚠ Arrears pending'}
                  </span>
                  <span style={{ fontSize: '.82rem', fontWeight: 800, color: liveBalance > 0 ? 'var(--green)' : 'var(--red)' }}>
                    {liveBalance > 0 ? '+' : '−'}{currency}{Math.abs(liveBalance).toLocaleString()}
                  </span>
                </div>
              )}

              {liveNextDue && (
                <div style={{
                  padding: '9px 13px', borderRadius: 8, marginBottom: 10,
                  background: `${statusColor}18`, border: `1px solid ${statusColor}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: '.78rem', fontWeight: 700, color: statusColor }}>
                    {isOverdue ? '⚠ Overdue since' : isDue ? '⏰ Due on' : '✓ Next due'}
                  </span>
                  <span style={{ fontSize: '.82rem', fontWeight: 800, color: statusColor }}>
                    {fmtDate(liveNextDue)}
                    {days !== null && Math.abs(days) <= 10 && (
                      <span style={{ fontSize: '.7rem', marginLeft: 6, opacity: .8 }}>
                        ({days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? 'today' : `in ${days}d`})
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Payment history — cross-referenced from admin store */}
              {(() => {
                const txns       = inst && myRecord
                  ? ([...(allTransactions[inst.id] ?? [])].filter(t => t.memberId === myRecord.id).reverse())
                  : [];

                const isExpanded = expandedTxn === ms.id;
                const shown      = isExpanded ? txns : txns.slice(0, 3);

                if (txns.length === 0) return (
                  <div style={{ fontSize: '.73rem', color: 'var(--muted)', textAlign: 'center', padding: '6px 0' }}>
                    No payments recorded yet
                  </div>
                );

                return (
                  <div>
                    <div style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>
                      Payment History
                    </div>
                    {shown.map(tx => (
                      <div key={tx.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '7px 10px', borderRadius: 7, marginBottom: 5,
                        background: 'rgba(52,199,89,.07)', border: '1px solid rgba(52,199,89,.14)',
                      }}>
                        <div>
                          <div style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--green)' }}>
                            {formatCurrency(tx.amount, defaultCountry)}
                          </div>
                          <div style={{ fontSize: '.68rem', color: 'var(--muted)', marginTop: 1 }}>
                            {fmtDateShort(tx.date)} · {tx.mode.replace('_', ' ')}
                            {tx.period ? ` · ${tx.period}` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {tx.receiptNo && (
                            <div style={{ fontSize: '.65rem', color: 'var(--muted)', fontWeight: 600 }}>{tx.receiptNo}</div>
                          )}
                          {tx.txnId && (
                            <div style={{ fontSize: '.62rem', color: 'var(--muted2)', marginTop: 1 }}>Txn: {tx.txnId}</div>
                          )}
                        </div>
                      </div>
                    ))}
                    {txns.length > 3 && (
                      <button onClick={() => setExpandedTxn(isExpanded ? null : ms.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--member-accent)', fontSize: '.73rem',
                          fontWeight: 700, cursor: 'pointer', padding: '4px 0', fontFamily: 'Outfit,sans-serif' }}>
                        {isExpanded ? 'Show less ↑' : `Show all ${txns.length} payments ↓`}
                      </button>
                    )}
                  </div>
                );
              })()}

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

      {/* Viral share banner — always at bottom of Fees tab */}
      <ShareBanner/>
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