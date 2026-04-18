import { useState } from 'react';
import { useAppStore } from '@/core/store/useAppStore';
import { useUIStore } from '@/core/store/useUIStore';
import { th } from '@/data/institutionTypes';
import { normalizePhone } from '@/utils/phoneNormalizer';
import { todayISO, addFreq } from '@/utils/dateHelpers';
import type { Member, PayFreq, FeeStatus } from '@/core/types';

interface Props {
  instId: string;
  member?: Member;
  onClose: () => void;
}

const FREQS: { value: PayFreq; label: string }[] = [
  { value:'monthly',     label:'Monthly'     },
  { value:'quarterly',   label:'Quarterly'   },
  { value:'half-yearly', label:'Half-Yearly' },
  { value:'yearly',      label:'Yearly'      },
  { value:'one-time',    label:'One-time'    },
];

export default function MemberForm({ instId, member, onClose }: Props) {
   // ✅ Individual selectors – no whole‑store destructuring
  const institutions = useAppStore(s => s.institutions);
  const addMember = useAppStore(s => s.addMember);
  const updateMember = useAppStore(s => s.updateMember);
  const { toast } = useUIStore();
  const inst = institutions.find(i => i.id === instId);
  const t = inst ? th(inst.type) : th('other');
  const isEdit = !!member;

  const [name,       setName]       = useState(member?.name       ?? '');
  const [phone,      setPhone]      = useState(member?.phone      ?? '');
  const [address,    setAddress]    = useState(member?.address    ?? '');
  const [identifier, setIdentifier] = useState(member?.identifier ?? '');
  const isCustomPlan = !!member && !t.plans.includes(member.plan);
  const [plan,       setPlan]       = useState(isCustomPlan ? '__custom__' : (member?.plan ?? (t.plans[0] ?? '')));
  const [customPlan, setCustomPlan] = useState(isCustomPlan ? (member?.plan ?? '') : '');
  const [fee,      setFee]      = useState(String(member?.fee ?? (t.fees[0] ?? 0)));
  const [freq,     setFreq]     = useState<PayFreq>(member?.freq     ?? 'monthly');
  const [joinDate, setJoinDate] = useState(member?.joinDate ?? todayISO());
  const [nextDue,  setNextDue]  = useState(member?.nextDue  ?? '');
  const [status,   setStatus]   = useState<FeeStatus>(member?.status ?? 'due');
  const [note,     setNote]     = useState(member?.note     ?? '');

  function handleSave() {
    if (!name.trim()) { toast('Enter member name', 'warn'); return; }
    const resolvedPlan = plan === '__custom__' ? customPlan.trim() : plan;
    if (!resolvedPlan) { toast('Enter a plan name', 'warn'); return; }
    const normPhone = phone ? normalizePhone(phone) : '';
    const feeNum = parseFloat(fee) || 0;
    const computedNextDue = nextDue || (joinDate ? addFreq(joinDate, freq) : '');

    if (isEdit && member) {
      updateMember(instId, member.id, {
        name: name.trim(), phone: normPhone || undefined, address: address.trim() || undefined,
        identifier: identifier.trim() || undefined,
        plan: resolvedPlan, fee: feeNum, freq, joinDate, nextDue: computedNextDue, status, note: note.trim() || undefined,
      });
      toast('Member updated', 'ok');
    } else {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      addMember({
        id, instId, name: name.trim(), phone: normPhone || undefined,
        address: address.trim() || undefined,
        identifier: identifier.trim() || undefined,
        plan: resolvedPlan, fee: feeNum, freq, joinDate, nextDue: computedNextDue, status, note: note.trim() || undefined,
      });
      toast('Member added', 'ok');
    }
    onClose();
  }

  const inpStyle: React.CSSProperties = {
    width:'100%', background:'var(--s2)', border:'1.5px solid var(--border)',
    borderRadius:'var(--r2)', padding:'10px 13px', color:'var(--text)',
    fontFamily:'Outfit,sans-serif', fontSize:'.88rem', outline:'none',
  };

  const selStyle: React.CSSProperties = { ...inpStyle };

  return (
    <div className="mo open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mo-box" style={{maxHeight:'90vh',overflowY:'auto'}}>
        <div className="mo-handle"/>
        <div className="mo-title">{isEdit ? 'Edit' : 'Add'} {t.member}</div>

        {/* Contact picker — Android only (Web Contact Picker API) */}
        {!isEdit && 'contacts' in navigator && (
          <button
            type="button"
            onClick={async () => {
              try {
                const contacts = await (navigator as unknown as {
                  contacts: { select: (props: string[], opts: object) => Promise<{ name: string[]; tel: string[] }[]> }
                }).contacts.select(['name', 'tel'], { multiple: false });
                if (contacts.length > 0) {
                  const c = contacts[0];
                  if (c.name?.[0])  setName(c.name[0].trim());
                  if (c.tel?.[0])   setPhone(normalizePhone(c.tel[0]));
                }
              } catch { /* user cancelled */ }
            }}
            style={{
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              width:'100%', marginBottom:14,
              background:'rgba(79,142,255,.1)', border:'1.5px dashed rgba(79,142,255,.4)',
              borderRadius:'var(--r2)', padding:'11px 14px',
              color:'var(--accent)', fontFamily:'Outfit,sans-serif', fontSize:'.85rem',
              fontWeight:700, cursor:'pointer',
            }}>
            <span style={{fontSize:'1.1rem'}}>📱</span> Pick from Phone Contacts
          </button>
        )}

        <div className="fld">
          <label>Name *</label>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder={`${t.member} name`} style={inpStyle}/>
        </div>
        <div className="fld">
          <label>Phone</label>
          <input value={phone}
            onChange={e=>setPhone(e.target.value)}
            onPaste={e=>{ const txt=e.clipboardData.getData('text'); setPhone(normalizePhone(txt)); e.preventDefault(); }}
            placeholder="10-digit mobile" type="tel" inputMode="numeric" style={inpStyle}/>
        </div>
        {t.identifier && (
          <div className="fld">
            <label>{t.identifier}</label>
            <input value={identifier} onChange={e=>setIdentifier(e.target.value)}
              placeholder={`e.g. ${t.identifier === 'Apartment No.' ? 'A-204' : t.identifier === 'Class / Section' ? '5-A' : t.identifier === 'Room No.' ? '101' : t.identifier}`}
              style={inpStyle}/>
          </div>
        )}
        <div className="fld">
          <label>Address</label>
          <input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Optional" style={inpStyle}/>
        </div>
        <div className="fld">
          <label>{t.plan}</label>
          <select value={plan} onChange={e=>setPlan(e.target.value)} style={selStyle}>
            {t.plans.map((p,i) => (
              <option key={p} value={p} onClick={() => setFee(String(t.fees[i] ?? 0))}>{p}</option>
            ))}
            <option value="__custom__">Custom…</option>
          </select>
          {plan === '__custom__' && (
            <input value={customPlan} onChange={e=>setCustomPlan(e.target.value)}
              placeholder="Enter custom plan name" autoFocus
              style={{...inpStyle, marginTop:6}}/>
          )}
        </div>
        <div className="fld">
          <label>Fee Amount</label>
          <input value={fee} onChange={e=>setFee(e.target.value)} type="number" placeholder="0" style={inpStyle}/>
        </div>
        <div className="fld">
          <label>Frequency</label>
          <select value={freq} onChange={e=>setFreq(e.target.value as PayFreq)} style={selStyle}>
            {FREQS.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div className="fld">
            <label>Join Date</label>
            <input value={joinDate} onChange={e=>setJoinDate(e.target.value)} type="date" style={inpStyle}/>
          </div>
          <div className="fld">
            <label>Next Due</label>
            <input value={nextDue} onChange={e=>setNextDue(e.target.value)} type="date" style={inpStyle}/>
          </div>
        </div>
        <div className="fld">
          <label>Status</label>
          <select value={status} onChange={e=>setStatus(e.target.value as FeeStatus)} style={selStyle}>
            <option value="paid">Paid</option>
            <option value="due">Due</option>
            <option value="overdue">Overdue</option>
            <option value="partial">Partial</option>
          </select>
        </div>
        <div className="fld">
          <label>Note</label>
          <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Optional note" style={inpStyle}/>
        </div>

        <div className="btn-row">
          <button className="btn g" onClick={onClose}>Cancel</button>
          <button className="btn p" onClick={handleSave}>{isEdit ? 'Update' : 'Add'} {t.member}</button>
        </div>
      </div>
    </div>
  );
}
