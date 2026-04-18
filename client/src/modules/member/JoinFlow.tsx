import { useState } from 'react';
import { useAppStore } from '@/core/store/useAppStore';
import { useUIStore } from '@/core/store/useUIStore';
import { api } from '@/core/services/api';
import { th } from '@/data/institutionTypes';
import { todayISO, addFreq } from '@/utils/dateHelpers';
import type { PayFreq } from '@/core/types';

interface Props { onJoined: () => void; }

interface RegistryResult {
  inviteCode: string;
  name: string;
  type: string;
  address: string;
  adminName: string;
  adminPhone: string | null;
  plans: { name: string; fee: number; freq: string }[];
}

export default function JoinFlow({ onJoined }: Props) {
  const { memberships, addMembership } = useAppStore();
  const { toast } = useUIStore();

  const [code,    setCode]    = useState('');
  const [step,    setStep]    = useState<'code' | 'plan'>('code');
  const [loading, setLoading] = useState(false);
  const [found,   setFound]   = useState<RegistryResult | null>(null);
  const [selPlan, setSelPlan] = useState(0);   // index into found.plans

  async function handleLookup() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) { toast('Enter the invite code', 'warn'); return; }

    // Already joined?
    if (memberships.find(m => m.inviteCode === trimmed)) {
      toast('You already joined this institution', 'warn');
      return;
    }

    setLoading(true);
    const data = await api<RegistryResult>('GET', `/institutions/lookup/${trimmed}`);
    setLoading(false);

    if (!data) {
      toast('Institution not found — check the invite code', 'err');
      return;
    }

    setFound(data);
    setSelPlan(0);
    setStep('plan');
  }

  function handleJoin() {
    if (!found) return;
    const plan = found.plans[selPlan] ?? { name: 'Standard', fee: 0, freq: 'monthly' };
    const id   = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const today = todayISO();

    addMembership({
      id,
      instName:    found.name,
      instType:    found.type,
      instAddress: found.address || undefined,
      inviteCode:  found.inviteCode,
      myPlan:      plan.name,
      myFee:       plan.fee,
      freq:        (plan.freq as PayFreq) || 'monthly',
      joinDate:    today,
      nextDue:     addFreq(today, (plan.freq as PayFreq) || 'monthly'),
      status:      'due',
      adminName:   found.adminName || undefined,
      adminPhone:  found.adminPhone || undefined,
    });

    toast(`Joined ${found.name}!`, 'ok');
    setCode('');
    setFound(null);
    setStep('code');
    onJoined();
  }

  const t = found ? th(found.type) : null;

  // ── Step 1: Enter code ─────────────────────────────────
  if (step === 'code') return (
    <div style={{ padding: 24 }}>
      <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 6, color: 'var(--member-accent)' }}>
        Join an Institution
      </div>
      <div style={{ fontSize: '.82rem', color: 'var(--muted)', marginBottom: 28 }}>
        Ask your admin for the invite code (e.g. <strong>AB12CD</strong>)
      </div>

      <div className="fld">
        <label>Invite Code</label>
        <input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handleLookup()}
          placeholder="e.g. AB12CD"
          maxLength={12}
          style={{
            width: '100%', background: 'var(--s2)', border: '2px solid var(--border)',
            borderRadius: 'var(--r2)', padding: '14px 16px', color: 'var(--text)',
            fontFamily: 'Outfit,sans-serif', fontSize: '1.3rem', fontWeight: 800,
            outline: 'none', letterSpacing: 4, textAlign: 'center', textTransform: 'uppercase',
          }}
        />
      </div>

      <button
        className="btn p"
        style={{ width: '100%', background: 'var(--member-accent)' }}
        onClick={handleLookup}
        disabled={loading}
      >
        {loading ? 'Searching…' : 'Find Institution →'}
      </button>
    </div>
  );

  // ── Step 2: Confirm & pick plan ────────────────────────
  if (step === 'plan' && found && t) {
    const plan = found.plans[selPlan];
    return (
      <div style={{ padding: 24 }}>
        {/* Institution card */}
        <div className="card" style={{ marginBottom: 16, padding: '20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, background: `${t.color}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', flexShrink: 0,
            }}>{t.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>{found.name}</div>
              <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: 2 }}>
                {t.label}
                {found.address && <> · {found.address}</>}
              </div>
            </div>
            <span style={{
              fontSize: '.62rem', fontWeight: 800, padding: '3px 8px', borderRadius: 99,
              background: 'rgba(52,199,89,.15)', color: 'var(--green)',
            }}>FOUND</span>
          </div>

          {found.adminName && (
            <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: 8 }}>
              Admin: <strong style={{ color: 'var(--text)' }}>{found.adminName}</strong>
              {found.adminPhone && <> · {found.adminPhone}</>}
            </div>
          )}
        </div>

        {/* Plan selection */}
        {found.plans.length > 0 ? (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: '.82rem', marginBottom: 10, color: 'var(--muted)' }}>
              SELECT YOUR PLAN
            </div>
            {found.plans.map((p, i) => (
              <div key={i}
                onClick={() => setSelPlan(i)}
                style={{
                  padding: '12px 14px', borderRadius: 10, marginBottom: 8, cursor: 'pointer',
                  border: `2px solid ${selPlan === i ? 'var(--member-accent)' : 'var(--border)'}`,
                  background: selPlan === i ? 'rgba(100,200,255,.06)' : 'var(--s2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '.9rem' }}>{p.name}</div>
                  <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 2 }}>
                    {p.freq ?? 'monthly'}
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--member-accent)' }}>
                  ₹{p.fee.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ marginBottom: 16, textAlign: 'center', color: 'var(--muted)', fontSize: '.82rem' }}>
            No plans published yet — fee details will be set by admin
          </div>
        )}

        {plan && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 16,
            background: 'rgba(100,200,255,.08)', border: '1px solid rgba(100,200,255,.2)',
            fontSize: '.8rem', color: 'var(--muted)',
          }}>
            You'll pay <strong style={{ color: 'var(--member-accent)' }}>₹{plan.fee.toLocaleString()}</strong> {plan.freq ?? 'monthly'} for <strong style={{ color: 'var(--text)' }}>{plan.name}</strong>
          </div>
        )}

        <button
          className="btn p"
          style={{ width: '100%', marginBottom: 10, background: 'var(--member-accent)' }}
          onClick={handleJoin}
        >
          Confirm & Join →
        </button>
        <button className="btn g" style={{ width: '100%' }}
          onClick={() => { setStep('code'); setFound(null); }}>
          ← Back
        </button>
      </div>
    );
  }

  return null;
}
