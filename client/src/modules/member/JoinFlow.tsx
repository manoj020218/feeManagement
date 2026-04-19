import { useState } from 'react';
import { useAppStore } from '@/core/store/useAppStore';
import { useUIStore } from '@/core/store/useUIStore';
import { api, NETWORK_ERROR } from '@/core/services/api';
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
  requireApproval?: boolean;
  /** Set when admin has pre-registered this phone → member cannot choose a different plan */
  preAssigned?: { plan: string; fee: number; freq: string } | null;
}

// localStorage key for a pending join request
function jrKey(inviteCode: string) { return `ff_jr_${inviteCode}`; }

export default function JoinFlow({ onJoined }: Props) {
  const memberships = useAppStore(s => s.memberships);
  const addMembership = useAppStore(s => s.addMembership);
  const user = useAppStore(s => s.user);
  const { toast } = useUIStore();

  const [code,    setCode]    = useState('');
  const [step,    setStep]    = useState<'code' | 'plan' | 'request' | 'status'>('code');
  const [loading, setLoading] = useState(false);
  const [found,   setFound]   = useState<RegistryResult | null>(null);
  const [selPlan, setSelPlan] = useState(0);

  // Request step fields
  const [reqName,  setReqName]  = useState('');
  const [reqPhone, setReqPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Status step
  const [reqStatus,  setReqStatus]  = useState<'pending'|'approved'|'rejected'|'hold'>('pending');
  const [reqReason,  setReqReason]  = useState('');
  const [checking,   setChecking]   = useState(false);

  async function handleLookup() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) { toast('Enter the invite code', 'warn'); return; }

    if (memberships.find(m => m.inviteCode === trimmed)) {
      toast('You already joined this institution', 'warn');
      return;
    }

    // Check if we already have a pending request for this code
    const saved = localStorage.getItem(jrKey(trimmed));
    if (saved) {
      try {
        const { phone } = JSON.parse(saved) as { phone: string };
        setLoading(true);
        const phoneParam = user?.phone ? `?phone=${encodeURIComponent(user.phone)}` : '';
        const data = await api<RegistryResult>('GET', `/institutions/lookup/${trimmed}${phoneParam}`);
        setLoading(false);
        if (data === NETWORK_ERROR) { toast('Cannot connect to server — check your internet', 'err'); return; }
        if (!data) { toast('Institution not found — ask your admin to publish it first', 'err'); return; }
        setFound(data);
        setReqPhone(phone);
        // Re-poll status
        const statusData = await api<{ status: typeof reqStatus; reason: string }>(
          'GET', `/join-requests/status/${encodeURIComponent(phone)}/${trimmed}`
        );
        if (statusData) {
          setReqStatus(statusData.status);
          setReqReason(statusData.reason ?? '');
          if (statusData.status === 'approved') {
            handleApprovedJoin(data, phone);
            return;
          }
        }
        setStep('status');
        return;
      } catch { /* proceed to normal lookup */ }
    }

    setLoading(true);
    const phoneParam = user?.phone ? `?phone=${encodeURIComponent(user.phone)}` : '';
    const data = await api<RegistryResult>('GET', `/institutions/lookup/${trimmed}${phoneParam}`);
    setLoading(false);

    if (data === NETWORK_ERROR) {
      toast('Cannot connect to server — check your internet connection', 'err');
      return;
    }
    if (!data) {
      toast('Institution not found — ask your admin to publish the institution first', 'err');
      return;
    }

    setFound(data);
    setSelPlan(0);
    setStep('plan');
  }

  function handleJoin() {
    if (!found) return;
    // If admin pre-assigned a plan, use that — member cannot override
    const plan = found.preAssigned ?? found.plans[selPlan] ?? { name: 'Standard', fee: 0, freq: 'monthly' };
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

  function handleApprovedJoin(inst: RegistryResult, phone: string) {
    const planName = localStorage.getItem(jrKey(inst.inviteCode) + '_plan') ?? '';
    const matchedPlan = inst.plans.find(p => p.name === planName) ?? inst.plans[0];
    const plan = matchedPlan ?? { name: 'Standard', fee: 0, freq: 'monthly' };
    const id   = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const today = todayISO();

    addMembership({
      id,
      instName:    inst.name,
      instType:    inst.type,
      instAddress: inst.address || undefined,
      inviteCode:  inst.inviteCode,
      myPlan:      plan.name,
      myFee:       plan.fee,
      freq:        (plan.freq as PayFreq) || 'monthly',
      joinDate:    today,
      nextDue:     addFreq(today, (plan.freq as PayFreq) || 'monthly'),
      status:      'due',
      adminName:   inst.adminName || undefined,
      adminPhone:  inst.adminPhone || undefined,
    });

    // Clean up localStorage
    localStorage.removeItem(jrKey(inst.inviteCode));
    localStorage.removeItem(jrKey(inst.inviteCode) + '_plan');

    toast(`You're in! Welcome to ${inst.name}`, 'ok');
    setCode('');
    setFound(null);
    setStep('code');
    onJoined();
  }

  // After plan selected, member proceeds — either instant join or request flow
  function handlePlanConfirm() {
    if (!found) return;
    if (found.requireApproval) {
      // Pre-fill from logged-in user profile
      setReqName(user?.name ?? '');
      setReqPhone(user?.phone ?? '');
      setStep('request');
    } else {
      handleJoin();
    }
  }

  async function handleSubmitRequest() {
    if (!found) return;
    if (!reqName.trim()) { toast('Enter your name', 'warn'); return; }
    if (!reqPhone.trim()) { toast('Enter your phone number', 'warn'); return; }

    const plan = found.plans[selPlan] ?? { name: '', fee: 0, freq: 'monthly' };
    setSubmitting(true);
    const data = await api<{ id: string; status: string }>(
      'POST', '/join-requests',
      { inviteCode: found.inviteCode, name: reqName.trim(), phone: reqPhone.trim(), plan: plan.name }
    );
    setSubmitting(false);

    if (!data) { toast('Could not send request — check connection', 'err'); return; }

    // Save to localStorage so we can resume later
    localStorage.setItem(jrKey(found.inviteCode), JSON.stringify({ phone: reqPhone.trim(), inviteCode: found.inviteCode }));
    localStorage.setItem(jrKey(found.inviteCode) + '_plan', plan.name);

    setReqStatus('pending');
    setReqReason('');
    setStep('status');
  }

  async function handleCheckStatus() {
    if (!found) return;
    setChecking(true);
    const data = await api<{ status: typeof reqStatus; reason: string }>(
      'GET', `/join-requests/status/${encodeURIComponent(reqPhone)}/${found.inviteCode}`
    );
    setChecking(false);
    if (!data) { toast('Could not check — try again', 'warn'); return; }
    setReqStatus(data.status);
    setReqReason(data.reason ?? '');

    if (data.status === 'approved') {
      handleApprovedJoin(found, reqPhone);
    }
  }

  const t = found ? th(found.type) : null;

  const inp: React.CSSProperties = {
    width: '100%', background: 'var(--s2)', border: '1.5px solid var(--border)',
    borderRadius: 'var(--r2)', padding: '11px 14px', color: 'var(--text)',
    fontFamily: 'Outfit,sans-serif', fontSize: '.88rem', outline: 'none',
  };

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

  // ── Step 2: Pick plan ──────────────────────────────────
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

          {found.requireApproval && (
            <div style={{
              fontSize: '.75rem', padding: '7px 11px', borderRadius: 8, marginTop: 4,
              background: 'rgba(255,200,0,.1)', border: '1px solid rgba(255,200,0,.25)',
              color: 'var(--yellow)',
            }}>
              Joining requires admin approval. You'll submit a request after picking a plan.
            </div>
          )}
        </div>

        {/* Plan selection — locked if admin pre-assigned, choosable otherwise */}
        {found.preAssigned ? (
          // ── Locked plan (admin pre-registered this member's phone) ──────────
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: '.82rem', marginBottom: 10, color: 'var(--muted)' }}>
              YOUR PLAN
            </div>
            <div style={{
              padding: '14px 16px', borderRadius: 10, marginBottom: 8,
              border: '2px solid var(--member-accent)', background: 'rgba(100,200,255,.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '.9rem' }}>{found.preAssigned.plan}</div>
                <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 2 }}>
                  {found.preAssigned.freq ?? 'monthly'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--member-accent)' }}>
                  ₹{found.preAssigned.fee.toLocaleString()}
                </div>
                <div style={{ fontSize: '.62rem', color: 'var(--muted)', marginTop: 2 }}>per {found.preAssigned.freq ?? 'month'}</div>
              </div>
            </div>
            <div style={{
              fontSize: '.75rem', padding: '8px 12px', borderRadius: 8,
              background: 'rgba(52,199,89,.08)', border: '1px solid rgba(52,199,89,.25)',
              color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>🔒</span>
              <span>Your plan has been set by your admin and cannot be changed. Contact your admin for any changes.</span>
            </div>
          </div>
        ) : found.plans.length > 0 ? (
          // ── Free plan selection ──────────────────────────────────────────────
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
                  <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 2 }}>{p.freq ?? 'monthly'}</div>
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

        {!found.preAssigned && plan && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 16,
            background: 'rgba(100,200,255,.08)', border: '1px solid rgba(100,200,255,.2)',
            fontSize: '.8rem', color: 'var(--muted)',
          }}>
            You'll pay <strong style={{ color: 'var(--member-accent)' }}>₹{plan.fee.toLocaleString()}</strong>{' '}
            {plan.freq ?? 'monthly'} for <strong style={{ color: 'var(--text)' }}>{plan.name}</strong>
          </div>
        )}

        <button
          className="btn p"
          style={{ width: '100%', marginBottom: 10, background: 'var(--member-accent)' }}
          onClick={handlePlanConfirm}
        >
          {found.requireApproval ? 'Continue — Enter Details →' : 'Confirm & Join →'}
        </button>
        <button className="btn g" style={{ width: '100%' }}
          onClick={() => { setStep('code'); setFound(null); }}>
          ← Back
        </button>
      </div>
    );
  }

  // ── Step 3: Request (name + phone) — approval mode only ──
  if (step === 'request' && found && t) {
    const plan = found.plans[selPlan] ?? { name: 'Standard', fee: 0, freq: 'monthly' };
    return (
      <div style={{ padding: 24 }}>
        <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 4 }}>
          {t.icon} {found.name}
        </div>
        <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: 20 }}>
          Plan: <strong style={{ color: 'var(--text)' }}>{plan.name}</strong>
          {plan.fee > 0 && <> · ₹{plan.fee.toLocaleString()} {plan.freq}</>}
        </div>

        <div style={{
          fontSize: '.75rem', padding: '8px 12px', borderRadius: 8, marginBottom: 18,
          background: 'rgba(255,200,0,.1)', border: '1px solid rgba(255,200,0,.25)', color: 'var(--yellow)',
        }}>
          The admin will review your request. You'll be notified once approved.
        </div>

        <div className="fld">
          <label>Your Name *</label>
          <input value={reqName} onChange={e => setReqName(e.target.value)}
            placeholder="Full name" style={inp}/>
        </div>
        <div className="fld">
          <label>Phone Number *</label>
          <input value={reqPhone} onChange={e => setReqPhone(e.target.value)}
            placeholder="10-digit mobile" type="tel" inputMode="numeric" style={inp}/>
        </div>

        <button className="btn p"
          style={{ width: '100%', marginBottom: 10, background: 'var(--member-accent)' }}
          onClick={handleSubmitRequest} disabled={submitting}>
          {submitting ? 'Sending…' : 'Send Join Request →'}
        </button>
        <button className="btn g" style={{ width: '100%' }}
          onClick={() => setStep('plan')}>
          ← Back
        </button>
      </div>
    );
  }

  // ── Step 4: Status card — member polls result ──────────
  if (step === 'status' && found) {
    const statusInfo: Record<string, { icon: string; color: string; msg: string }> = {
      pending:  { icon: '⏳', color: 'var(--yellow)',  msg: 'Your request is under review. Check back soon.' },
      approved: { icon: '✅', color: 'var(--green)',   msg: "You're approved! Tap below to activate." },
      rejected: { icon: '❌', color: 'var(--red)',     msg: reqReason ? `Not approved — ${reqReason}` : 'Your request was not approved.' },
      hold:     { icon: '⏸', color: 'var(--muted)',   msg: reqReason ? `On hold — ${reqReason}. Contact your admin.` : 'Your request is on hold. Contact your admin.' },
    };
    const info = statusInfo[reqStatus] ?? statusInfo.pending;

    return (
      <div style={{ padding: 24 }}>
        <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 4 }}>
          {found.name}
        </div>
        <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: 20 }}>
          Join request sent · {reqPhone}
        </div>

        <div style={{
          padding: '20px 16px', borderRadius: 12, textAlign: 'center', marginBottom: 20,
          background: `${info.color}12`, border: `1.5px solid ${info.color}40`,
        }}>
          <div style={{ fontSize: '2.8rem', marginBottom: 10 }}>{info.icon}</div>
          <div style={{ fontWeight: 800, fontSize: '.95rem', color: info.color, marginBottom: 6 }}>
            {reqStatus.toUpperCase()}
          </div>
          <div style={{ fontSize: '.82rem', color: 'var(--muted)', lineHeight: 1.5 }}>
            {info.msg}
          </div>
        </div>

        {reqStatus === 'approved' ? (
          <button className="btn p"
            style={{ width: '100%', background: 'var(--green)', marginBottom: 10 }}
            onClick={() => handleApprovedJoin(found, reqPhone)}>
            Activate Membership →
          </button>
        ) : (
          <button className="btn p"
            style={{ width: '100%', marginBottom: 10, background: 'var(--member-accent)' }}
            onClick={handleCheckStatus} disabled={checking}>
            {checking ? 'Checking…' : 'Check Status'}
          </button>
        )}

        <button className="btn g" style={{ width: '100%' }}
          onClick={() => { setStep('code'); setCode(''); setFound(null); }}>
          Close
        </button>
      </div>
    );
  }

  return null;
}
