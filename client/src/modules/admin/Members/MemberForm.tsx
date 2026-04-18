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
  const { institutions, addMember, updateMember } = useAppStore();
  const { toast } = useUIStore();
  const inst = institutions.find(i => i.id === instId);
  const t = inst ? th(inst.type) : th('other');
  const isEdit = !!member;

  const [name,     setName]     = useState(member?.name     ?? '');
  const [phone,    setPhone]    = useState(member?.phone    ?? '');
  const [address,  setAddress]  = useState(member?.address  ?? '');
  const [plan,     setPlan]     = useState(member?.plan     ?? (t.plans[0] ?? ''));
  const [fee,      setFee]      = useState(String(member?.fee ?? (t.fees[0] ?? 0)));
  const [freq,     setFreq]     = useState<PayFreq>(member?.freq     ?? 'monthly');
  const [joinDate, setJoinDate] = useState(member?.joinDate ?? todayISO());
  const [nextDue,  setNextDue]  = useState(member?.nextDue  ?? '');
  const [status,   setStatus]   = useState<FeeStatus>(member?.status ?? 'due');
  const [note,     setNote]     = useState(member?.note     ?? '');

  function handleSave() {
    if (!name.trim()) { toast('Enter member name', 'warn'); return; }
    const normPhone = phone ? normalizePhone(phone) : '';
    const feeNum = parseFloat(fee) || 0;
    const computedNextDue = nextDue || (joinDate ? addFreq(joinDate, freq) : '');

    if (isEdit && member) {
      updateMember(instId, member.id, {
        name: name.trim(), phone: normPhone || undefined, address: address.trim() || undefined,
        plan, fee: feeNum, freq, joinDate, nextDue: computedNextDue, status, note: note.trim() || undefined,
      });
      toast('Member updated', 'ok');
    } else {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      addMember({
        id, instId, name: name.trim(), phone: normPhone || undefined,
        address: address.trim() || undefined,
        plan, fee: feeNum, freq, joinDate, nextDue: computedNextDue, status, note: note.trim() || undefined,
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
            <input value={plan === '__custom__' ? '' : plan}
              onChange={e=>setPlan(e.target.value)} placeholder="Custom plan name"
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
