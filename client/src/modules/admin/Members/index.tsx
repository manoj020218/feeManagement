import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAppStore } from '@/core/store/useAppStore';
import { useUIStore } from '@/core/store/useUIStore';
import { th } from '@/data/institutionTypes';
import { formatCurrency } from '@/data/countries';
import { fmtDateShort, daysDiff, todayISO, addFreq } from '@/utils/dateHelpers';
import { effectiveStatus, graceRemaining } from '@/utils/feeRules';
import { api } from '@/core/services/api';
import { exportMembers } from '@/core/services/excelService';
import MemberForm from './MemberForm';
import MemberImportModal from './MemberImportModal';
import RecordPaymentModal from '@/modules/admin/Payments/RecordPaymentModal';
import type { Member, JoinRequest } from '@/core/types';

type Filter = 'All' | 'Paid' | 'Due' | 'Overdue';

// Stable empty array to avoid new references
const EMPTY_ARRAY: never[] = [];

export default function MembersPage() {
  // ✅ Individual selectors – no whole‑store destructuring
  const institutions = useAppStore(s => s.institutions);
  const activeInstId = useAppStore(s => s.activeInstId);
  const deleteMember = useAppStore(s => s.deleteMember);
  const defaultCountry = useAppStore(s => s.defaultCountry);
  const addMember = useAppStore(s => s.addMember);

  // ✅ Members with stable fallback
  const members = useAppStore(s => 
    activeInstId ? s.members[activeInstId] ?? EMPTY_ARRAY : EMPTY_ARRAY
  );

  const { toast } = useUIStore();
  const inst = institutions.find(i => i.id === activeInstId);

  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<Filter>('All');
  const [editMember, setEdit] = useState<Member | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [payMember, setPayMember] = useState<Member | null>(null);

  // Join requests
  const [joinReqs,    setJoinReqs]    = useState<JoinRequest[]>([]);
  const [reqsLoading, setReqsLoading] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [reasonFor,   setReasonFor]   = useState<string | null>(null);
  const [reasonText,  setReasonText]  = useState('');
  // Plan editing before approve
  const [editPlanFor, setEditPlanFor] = useState<string | null>(null);
  const [editPlanVal, setEditPlanVal] = useState('');
  const [editFeeVal,  setEditFeeVal]  = useState('');

  const t = inst ? th(inst.type) : th('other');

  const fetchRequests = useCallback(async () => {
    if (!inst) return;
    setReqsLoading(true);
    const data = await api<JoinRequest[]>('GET', `/join-requests/${inst.inviteCode}`);
    setReqsLoading(false);
    if (data) setJoinReqs(data);
  }, [inst]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  async function handleApproveRequest(jr: JoinRequest, overridePlan?: string, overrideFee?: number) {
    if (!inst) return;
    setActioningId(jr._id);
    const res = await api('PATCH', `/join-requests/${jr._id}`, { status: 'approved' });
    if (!res) { toast('Failed — check connection', 'err'); setActioningId(null); return; }

    const finalPlan = overridePlan || jr.plan || t.plans[0] || 'Standard';
    // Look up fee from published plans, fallback to overrideFee or 0
    const planEntry = t.plans.indexOf(finalPlan);
    const finalFee  = overrideFee !== undefined ? overrideFee : (planEntry >= 0 ? (t.fees[planEntry] ?? 0) : 0);
    const today = todayISO();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    addMember({
      id, instId: inst.id,
      name:  jr.name,
      phone: jr.phone || undefined,
      plan:  finalPlan,
      fee:   finalFee,
      freq:  'monthly',
      joinDate: today,
      nextDue:  addFreq(today, 'monthly'),
      status:   'due',
    });

    // Lock plan on VPS so member cannot change it if they re-join or use another device
    if (inst.isPublished && jr.phone) {
      api('PUT', `/institutions/${inst.inviteCode}/pre-members`, {
        phone: jr.phone, plan: finalPlan, fee: finalFee, freq: 'monthly',
      });
    }

    toast(`${jr.name} approved & added`, 'ok');
    setActioningId(null);
    setEditPlanFor(null);
    setJoinReqs(prev => prev.map(r => r._id === jr._id ? { ...r, status: 'approved' } : r));
  }

  async function handleResolveRequest(jr: JoinRequest, status: 'rejected' | 'hold') {
    if (!inst) return;
    setActioningId(jr._id);
    const res = await api('PATCH', `/join-requests/${jr._id}`, { status, reason: reasonText.trim() });
    if (!res) { toast('Failed — check connection', 'err'); setActioningId(null); return; }
    toast(status === 'rejected' ? 'Request rejected' : 'Request put on hold', 'ok');
    setActioningId(null);
    setReasonFor(null);
    setReasonText('');
    setJoinReqs(prev => prev.map(r => r._id === jr._id ? { ...r, status, reason: reasonText.trim() } : r));
  }

  const filtered = useMemo(() =>
    members.filter(m => {
      const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.phone?.includes(search) || m.identifier?.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === 'All' || m.status === filter.toLowerCase();
      return matchSearch && matchFilter;
    }),
  [members, search, filter]);

  const counts = useMemo(() => ({
    All:     members.length,
    Paid:    members.filter(m=>m.status==='paid').length,
    Due:     members.filter(m=>m.status==='due').length,
    Overdue: members.filter(m=>m.status==='overdue').length,
  }), [members]);

  function handleDelete(m: Member) {
    if (!confirm(`Delete ${m.name}? All their transactions will also be removed.`)) return;
    deleteMember(m.instId, m.id);
    toast('Member deleted', 'ok');
  }

  if (!inst) return <div style={{padding:24,color:'var(--muted)',textAlign:'center'}}>Select an institution first</div>;

  return (
    <div style={{padding:'16px 16px 0'}}>
      {/* Search + Add */}
      <div style={{display:'flex',gap:8,marginBottom:8}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder={`Search ${t.members.toLowerCase()}…`}
          style={{flex:1,background:'var(--s2)',border:'1.5px solid var(--border)',borderRadius:'var(--r2)',
            padding:'9px 13px',color:'var(--text)',fontFamily:'Outfit,sans-serif',fontSize:'.85rem',outline:'none'}}/>
        <button onClick={() => setAddOpen(true)}
          style={{background:'var(--accent)',border:'none',borderRadius:'var(--r2)',color:'#fff',
            padding:'9px 16px',fontFamily:'Outfit,sans-serif',fontSize:'.82rem',fontWeight:700,cursor:'pointer',flexShrink:0}}>
          + Add
        </button>
      </div>

      {/* Export / Import toolbar */}
      <div style={{display:'flex',gap:6,marginBottom:12,justifyContent:'flex-end'}}>
        <button
          onClick={() => exportMembers(members, inst.name)}
          style={{background:'var(--s2)',border:'1px solid var(--border)',borderRadius:7,
            color:'var(--muted2)',padding:'5px 11px',fontFamily:'Outfit,sans-serif',
            fontSize:'.72rem',fontWeight:600,cursor:'pointer'}}>
          ↓ Export Excel
        </button>
        <button
          onClick={() => setImportOpen(true)}
          style={{background:'var(--s2)',border:'1px solid var(--border)',borderRadius:7,
            color:'var(--muted2)',padding:'5px 11px',fontFamily:'Outfit,sans-serif',
            fontSize:'.72rem',fontWeight:600,cursor:'pointer'}}>
          ↑ Import Excel
        </button>
      </div>

      {/* Pending Join Requests (unchanged) */}
      {inst.requireApproval && (() => {
        const pending = joinReqs.filter(r => r.status === 'pending');
        if (pending.length === 0 && !reqsLoading) return null;
        return (
          <div style={{
            marginBottom: 14, borderRadius: 'var(--r2)',
            border: '1.5px solid rgba(255,200,0,.35)',
            background: 'rgba(255,200,0,.07)', overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 14px', fontWeight: 800, fontSize: '.82rem',
              borderBottom: '1px solid rgba(255,200,0,.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              color: 'var(--yellow)',
            }}>
              <span>Pending Requests {pending.length > 0 ? `(${pending.length})` : ''}</span>
              <button onClick={fetchRequests} disabled={reqsLoading}
                style={{ background: 'none', border: 'none', color: 'var(--yellow)', cursor: 'pointer',
                  fontSize: '.72rem', fontWeight: 700, fontFamily: 'Outfit,sans-serif' }}>
                {reqsLoading ? '…' : '↻ Refresh'}
              </button>
            </div>

            {reqsLoading && pending.length === 0 && (
              <div style={{ padding: '12px 14px', fontSize: '.78rem', color: 'var(--muted)' }}>Loading…</div>
            )}

            {pending.map(jr => (
              <div key={jr._id} style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,200,0,.15)' }}>
                <div style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: 2 }}>{jr.name}</div>
                <div style={{ fontSize: '.73rem', color: 'var(--muted)', marginBottom: 8 }}>
                  {jr.phone}
                  {jr.plan && <> · Plan: <strong style={{ color: 'var(--text)' }}>{jr.plan}</strong></>}
                  <span style={{ marginLeft: 8, opacity: .7 }}>{new Date(jr.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}</span>
                </div>

                {editPlanFor === jr._id ? (
                  // ── Plan editor (shown before approve) ────────────────────
                  <div>
                    <div style={{ fontSize: '.73rem', color: 'var(--muted)', marginBottom: 6 }}>
                      Change plan before approving:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 6, marginBottom: 7 }}>
                      <select
                        value={editPlanVal}
                        onChange={e => {
                          const idx = t.plans.indexOf(e.target.value);
                          setEditPlanVal(e.target.value);
                          setEditFeeVal(idx >= 0 ? String(t.fees[idx] ?? 0) : editFeeVal);
                        }}
                        style={{
                          background:'var(--s2)', border:'1px solid var(--border)', borderRadius:7,
                          padding:'7px 10px', color:'var(--text)', fontFamily:'Outfit,sans-serif',
                          fontSize:'.82rem', outline:'none',
                        }}
                      >
                        {t.plans.map(p => <option key={p} value={p}>{p}</option>)}
                        <option value="__custom__">Custom…</option>
                      </select>
                      <input
                        type="number"
                        placeholder="Fee ₹"
                        value={editFeeVal}
                        onChange={e => setEditFeeVal(e.target.value)}
                        style={{
                          background:'var(--s2)', border:'1px solid var(--border)', borderRadius:7,
                          padding:'7px 10px', color:'var(--text)', fontFamily:'Outfit,sans-serif',
                          fontSize:'.82rem', outline:'none',
                        }}
                      />
                    </div>
                    {editPlanVal === '__custom__' && (
                      <input
                        placeholder="Custom plan name"
                        value={editPlanVal === '__custom__' ? '' : editPlanVal}
                        onChange={e => setEditPlanVal(e.target.value)}
                        style={{
                          width:'100%', background:'var(--s2)', border:'1px solid var(--border)', borderRadius:7,
                          padding:'7px 10px', color:'var(--text)', fontFamily:'Outfit,sans-serif',
                          fontSize:'.82rem', outline:'none', marginBottom:7,
                        }}
                      />
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleApproveRequest(jr, editPlanVal === '__custom__' ? '' : editPlanVal, parseFloat(editFeeVal) || 0)}
                        disabled={actioningId === jr._id}
                        style={{ flex:2, background:'rgba(52,199,89,.15)', border:'1px solid rgba(52,199,89,.35)',
                          borderRadius:7, color:'var(--green)', padding:'7px 10px', fontSize:'.76rem',
                          fontWeight:700, cursor:'pointer', fontFamily:'Outfit,sans-serif' }}>
                        {actioningId === jr._id ? '…' : '✓ Approve with this plan'}
                      </button>
                      <button onClick={() => { setEditPlanFor(null); }}
                        style={{ background:'none', border:'1px solid var(--border)', borderRadius:7,
                          color:'var(--muted)', padding:'7px 10px', fontSize:'.73rem', cursor:'pointer', fontFamily:'Outfit,sans-serif' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : reasonFor === jr._id ? (
                  // ── Hold / Reject reason entry ─────────────────────────────
                  <div>
                    <input
                      value={reasonText}
                      onChange={e => setReasonText(e.target.value)}
                      placeholder="Reason (optional)"
                      style={{
                        width: '100%', background: 'var(--s2)', border: '1px solid var(--border)',
                        borderRadius: 7, padding: '7px 10px', color: 'var(--text)',
                        fontFamily: 'Outfit,sans-serif', fontSize: '.82rem', outline: 'none', marginBottom: 7,
                      }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleResolveRequest(jr, 'hold')} disabled={actioningId === jr._id}
                        style={{ flex:1, background:'rgba(100,100,255,.12)', border:'1px solid rgba(100,100,255,.3)',
                          borderRadius:7, color:'var(--accent)', padding:'6px 8px', fontSize:'.73rem',
                          fontWeight:700, cursor:'pointer', fontFamily:'Outfit,sans-serif' }}>
                        {actioningId === jr._id ? '…' : 'Hold'}
                      </button>
                      <button onClick={() => handleResolveRequest(jr, 'rejected')} disabled={actioningId === jr._id}
                        style={{ flex:1, background:'rgba(255,92,92,.1)', border:'1px solid rgba(255,92,92,.3)',
                          borderRadius:7, color:'var(--red)', padding:'6px 8px', fontSize:'.73rem',
                          fontWeight:700, cursor:'pointer', fontFamily:'Outfit,sans-serif' }}>
                        {actioningId === jr._id ? '…' : 'Reject'}
                      </button>
                      <button onClick={() => { setReasonFor(null); setReasonText(''); }}
                        style={{ background:'none', border:'1px solid var(--border)', borderRadius:7,
                          color:'var(--muted)', padding:'6px 8px', fontSize:'.73rem', cursor:'pointer', fontFamily:'Outfit,sans-serif' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // ── Default action row ─────────────────────────────────────
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handleApproveRequest(jr)} disabled={actioningId === jr._id}
                      style={{ flex:1, background:'rgba(52,199,89,.15)', border:'1px solid rgba(52,199,89,.35)',
                        borderRadius:7, color:'var(--green)', padding:'7px 10px', fontSize:'.76rem',
                        fontWeight:700, cursor:'pointer', fontFamily:'Outfit,sans-serif' }}>
                      {actioningId === jr._id ? '…' : '✓ Approve'}
                    </button>
                    <button
                      onClick={() => {
                        setEditPlanFor(jr._id);
                        const firstPlan = jr.plan && t.plans.includes(jr.plan) ? jr.plan : (t.plans[0] ?? '');
                        setEditPlanVal(firstPlan);
                        const idx = t.plans.indexOf(firstPlan);
                        setEditFeeVal(idx >= 0 ? String(t.fees[idx] ?? 0) : '0');
                      }}
                      style={{ flex:1, background:'rgba(79,142,255,.1)', border:'1px solid rgba(79,142,255,.3)',
                        borderRadius:7, color:'var(--accent)', padding:'7px 10px', fontSize:'.76rem',
                        fontWeight:700, cursor:'pointer', fontFamily:'Outfit,sans-serif' }}>
                      ✏ Edit Plan
                    </button>
                    <button onClick={() => { setReasonFor(jr._id); setReasonText(''); }}
                      style={{ flex:1, background:'rgba(255,200,0,.1)', border:'1px solid rgba(255,200,0,.3)',
                        borderRadius:7, color:'var(--yellow)', padding:'7px 10px', fontSize:'.76rem',
                        fontWeight:700, cursor:'pointer', fontFamily:'Outfit,sans-serif' }}>
                      Hold / Reject…
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Filter chips */}
      <div style={{display:'flex',gap:6,marginBottom:14,overflowX:'auto',scrollbarWidth:'none'}}>
        {(['All','Paid','Due','Overdue'] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{flexShrink:0,padding:'5px 13px',borderRadius:99,
              border:`1.5px solid ${filter===f?'var(--accent)':'var(--border)'}`,
              background:filter===f?'rgba(79,142,255,.12)':'transparent',
              color:filter===f?'var(--accent)':'var(--muted2)',
              fontFamily:'Outfit,sans-serif',fontSize:'.75rem',fontWeight:700,cursor:'pointer'}}>
            {f} {counts[f] > 0 ? `(${counts[f]})` : ''}
          </button>
        ))}
      </div>

      {/* Member list */}
      {filtered.length === 0 && (
        <div style={{color:'var(--muted)',fontSize:'.85rem',textAlign:'center',padding:32}}>
          {members.length === 0 ? `No ${t.members.toLowerCase()} yet — add one above` : 'No results'}
        </div>
      )}

      {filtered.map(m => {
        const days        = m.nextDue ? daysDiff(m.nextDue) : null;
        const effStatus   = effectiveStatus(m, inst);
        const graceLeft   = graceRemaining(m, inst);
        const isOverdue   = effStatus === 'overdue';
        const isDue       = effStatus === 'due';
        const statusColor = isOverdue ? 'var(--red)' : isDue ? 'var(--yellow)' : effStatus === 'paid' ? 'var(--green)' : 'var(--muted)';
        const balance     = m.balance ?? 0;

        return (
          <div key={m.id} className="card" style={{marginBottom:8,padding:'12px 14px'}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
              <div style={{
                width:42,height:42,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
                background:inst.accentColor?`${inst.accentColor}22`:'rgba(79,142,255,.1)',
                color:inst.accentColor??'var(--accent)',fontWeight:800,fontSize:'1rem',flexShrink:0,
              }}>
                {m.name.charAt(0).toUpperCase()}
              </div>

              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                  <span style={{fontWeight:700,fontSize:'.92rem'}}>{m.name}</span>
                  <span style={{
                    fontSize:'.62rem',fontWeight:800,padding:'2px 7px',borderRadius:99,
                    background:`${statusColor}22`,color:statusColor,
                  }}>{effStatus.toUpperCase()}</span>
                  {graceLeft !== null && (
                    <span style={{fontSize:'.6rem',color:'var(--yellow)',fontWeight:700}}>
                      Grace {graceLeft}d left
                    </span>
                  )}
                </div>
                <div style={{fontSize:'.72rem',color:'var(--muted)',marginTop:3}}>
                  {m.identifier && (
                    <span style={{
                      display:'inline-block',marginRight:6,padding:'1px 7px',borderRadius:99,
                      background:'rgba(79,142,255,.12)',color:'var(--accent)',fontWeight:700,fontSize:'.68rem',
                    }}>{m.identifier}</span>
                  )}
                  {m.plan}
                  {m.phone && ` · ${m.phone}`}
                </div>
                <div style={{display:'flex',gap:12,marginTop:5,flexWrap:'wrap',alignItems:'center'}}>
                  <span style={{fontSize:'.78rem',fontWeight:700,color:statusColor}}>
                    {formatCurrency(m.fee, defaultCountry)}
                  </span>
                  {balance !== 0 && inst.trackBalance !== false && (
                    <span style={{
                      fontSize:'.65rem',fontWeight:800,padding:'1px 7px',borderRadius:99,
                      background: balance > 0 ? 'rgba(0,200,120,.12)' : 'rgba(255,92,92,.12)',
                      color: balance > 0 ? 'var(--green)' : 'var(--red)',
                    }}>
                      {balance > 0 ? `+${formatCurrency(balance, defaultCountry)} advance` : `${formatCurrency(Math.abs(balance), defaultCountry)} arrears`}
                    </span>
                  )}
                  {m.nextDue && (
                    <span style={{fontSize:'.72rem',color: isOverdue ? 'var(--red)' : 'var(--muted)'}}>
                      Due: {fmtDateShort(m.nextDue)}
                      {days !== null && days <= 7 ? (days < 0 ? ` (${Math.abs(days)}d ago)` : days === 0 ? ' (today)' : ` (${days}d)`) : ''}
                    </span>
                  )}
                </div>
              </div>

              <div style={{display:'flex',flexDirection:'column',gap:5,flexShrink:0,alignItems:'stretch'}}>
                <button onClick={() => setPayMember(m)}
                  style={{background:'var(--accent)',border:'none',borderRadius:7,
                    color:'#fff',padding:'5px 10px',fontSize:'.72rem',fontWeight:700,cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>
                  Rec
                </button>
                <div style={{display:'flex',gap:5}}>
                  <button onClick={() => setEdit(m)}
                    style={{flex:1,background:'var(--s2)',border:'1px solid var(--border)',borderRadius:7,
                      color:'var(--text)',padding:'4px 8px',fontSize:'.72rem',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(m)}
                    style={{flex:1,background:'none',border:'1px solid rgba(255,92,92,.3)',borderRadius:7,
                      color:'var(--red)',padding:'4px 8px',fontSize:'.72rem',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>
                    Del
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {(addOpen || editMember) && (
        <MemberForm
          instId={inst.id}
          member={editMember ?? undefined}
          onClose={() => { setAddOpen(false); setEdit(null); }}
        />
      )}

      {payMember && (
        <RecordPaymentModal
          instId={inst.id}
          preselectedMember={payMember}
          onClose={() => setPayMember(null)}
        />
      )}

      {importOpen && inst && (
        <MemberImportModal inst={inst} onClose={() => setImportOpen(false)}/>
      )}
    </div>
  );
}