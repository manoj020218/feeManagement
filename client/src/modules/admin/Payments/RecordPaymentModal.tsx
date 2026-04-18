import { useState, useMemo } from 'react';
import { useAppStore } from '@/core/store/useAppStore';
import { useUIStore } from '@/core/store/useUIStore';
import { th } from '@/data/institutionTypes';
import { formatCurrency } from '@/data/countries';
import { todayISO } from '@/utils/dateHelpers';
import { netDue, applyPayment } from '@/utils/feeRules';
import type { Member, Transaction, PayMode } from '@/core/types';

const PAY_MODES: { value: PayMode; label: string }[] = [
  { value:'cash',         label:'Cash'          },
  { value:'upi',          label:'UPI'           },
  { value:'card',         label:'Card'          },
  { value:'cheque',       label:'Cheque'        },
  { value:'bank_transfer',label:'Bank Transfer' },
  { value:'other',        label:'Other'         },
];

interface Props {
  instId: string;
  /** When provided the member search is skipped and member is pre-filled */
  preselectedMember?: Member;
  onClose: () => void;
}

const EMPTY_ARRAY: never[] = [];
export default function RecordPaymentModal({ instId, preselectedMember, onClose }: Props) {
const institutions = useAppStore(s => s.institutions);
const addTransaction = useAppStore(s => s.addTransaction);
const updateMember = useAppStore(s => s.updateMember);
const defaultCountry = useAppStore(s => s.defaultCountry);

const members = useAppStore(s => s.members[instId] ?? EMPTY_ARRAY);
const allTxns = useAppStore(s => s.transactions[instId] ?? EMPTY_ARRAY);
  const toast = useUIStore(s => s.toast);  // ✅ fix


  const inst = institutions.find(i => i.id === instId);
  if (!inst) {
  toast('Institution not found', 'err');
  onClose();
  return null;
  }
  const t       = inst ? th(inst.type) : th('other');
  const trackBalance = inst ? inst.trackBalance !== false : true;

  const [searchMem, setSearchMem] = useState(preselectedMember?.name ?? '');
  const [pickedMem, setPickedMem] = useState(preselectedMember?.id   ?? '');
  const [amount,    setAmount]    = useState('');
  const [mode,      setMode]      = useState<PayMode>('cash');
  const [date,      setDate]      = useState(todayISO());
  const [period,    setPeriod]    = useState('');
  const [txnId,     setTxnId]     = useState('');
  const [note,      setNote]      = useState('');

  // The active member (either pre-selected or picked from search)
  const activeMember = useMemo(() =>
    preselectedMember ?? members.find(m => m.id === pickedMem) ?? null,
  [preselectedMember, members, pickedMem]);

  const filteredMembers = useMemo(() =>
    !preselectedMember && searchMem
      ? members.filter(m => m.name.toLowerCase().includes(searchMem.toLowerCase()))
      : [],
  [members, searchMem, preselectedMember]);

  // Balance info for the active member
  const memberBalance  = activeMember?.balance ?? 0;
  const memberNetDue   = activeMember ? netDue(activeMember) : 0;

  const inpStyle: React.CSSProperties = {
    width:'100%', background:'var(--s2)', border:'1.5px solid var(--border)',
    borderRadius:'var(--r2)', padding:'10px 13px', color:'var(--text)',
    fontFamily:'Outfit,sans-serif', fontSize:'.88rem', outline:'none',
  };

  function pickMember(m: Member) {
    setPickedMem(m.id);
    setSearchMem(m.name);
    // pre-fill with net due (not raw fee)
    setAmount(String(netDue(m)));
  }

  function handleRecord() {
    const member = activeMember;
    if (!member) { toast(`Select a ${t.member.toLowerCase()}`, 'warn'); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast('Enter valid amount', 'warn'); return; }

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const receiptNo = 'RCP' + String(allTxns.length + 1).padStart(4, '0');
    const tx: Transaction = {
      id, instId, memberId: member.id,
      amount: amt, mode, date,
      period: period.trim() || undefined,
      note: note.trim() || undefined,
      receiptNo,
      txnId: txnId.trim() || undefined,
    };
    addTransaction(tx);

    const { newBalance, newNextDue, newStatus } = applyPayment(member, inst!, amt, date);
    updateMember(instId, member.id, {
      status: newStatus,
      nextDue: newNextDue,
      balance: newBalance,
    });

    const overpaid = newBalance > 0;
    const underpaid = newBalance < 0;
    const suffix = overpaid
      ? ` · ₹${newBalance.toFixed(0)} advance carried`
      : underpaid
        ? ` · ₹${Math.abs(newBalance).toFixed(0)} arrears`
        : '';
    toast(`${receiptNo} recorded${suffix}`, 'ok');
    onClose();
  }

  return (
    <div className="mo open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mo-box" style={{maxHeight:'90vh',overflowY:'auto'}}>
        <div className="mo-handle"/>
        <div className="mo-title">Record Payment</div>

        {/* Member — either pre-filled chip or searchable dropdown */}
        {preselectedMember ? (
          <div className="fld">
            <label>{t.member}</label>
            <div style={{
              background:'var(--s2)',border:'1.5px solid var(--accent)',borderRadius:'var(--r2)',
              padding:'10px 13px',fontSize:'.88rem',display:'flex',justifyContent:'space-between',alignItems:'center',
            }}>
              <span style={{fontWeight:700}}>{preselectedMember.name}</span>
              <span style={{fontSize:'.75rem',color:'var(--muted)'}}>
                {preselectedMember.identifier ? `${preselectedMember.identifier} · ` : ''}
                {preselectedMember.plan}
              </span>
            </div>
          </div>
        ) : (
          <div className="fld">
            <label>Search {t.member}</label>
            <input value={searchMem} onChange={e => setSearchMem(e.target.value)}
              placeholder="Type name…" style={inpStyle}/>
            {filteredMembers.length > 0 && (
              <div style={{background:'var(--s2)',border:'1px solid var(--border)',borderRadius:8,marginTop:4,maxHeight:160,overflowY:'auto'}}>
                {filteredMembers.map(m => (
                  <div key={m.id} onClick={() => pickMember(m)}
                    style={{padding:'9px 13px',cursor:'pointer',borderBottom:'1px solid var(--border)',
                      fontSize:'.85rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span>{m.name}</span>
                    <span style={{color:'var(--muted)',fontSize:'.75rem'}}>{formatCurrency(netDue(m), defaultCountry)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Balance / net-due info bar */}
        {activeMember && trackBalance && (memberBalance !== 0 || true) && (
          <div style={{
            display:'flex',gap:10,marginBottom:12,padding:'10px 13px',
            background:'var(--s2)',borderRadius:'var(--r2)',border:'1px solid var(--border)',
            fontSize:'.78rem',
          }}>
            <div style={{flex:1}}>
              <div style={{color:'var(--muted)',marginBottom:2}}>Regular fee</div>
              <div style={{fontWeight:700}}>{formatCurrency(activeMember.fee, defaultCountry)}</div>
            </div>
            {memberBalance !== 0 && (
              <div style={{flex:1}}>
                <div style={{color:'var(--muted)',marginBottom:2}}>
                  {memberBalance > 0 ? 'Advance credit' : 'Arrears'}
                </div>
                <div style={{fontWeight:700,color: memberBalance > 0 ? 'var(--green)' : 'var(--red)'}}>
                  {memberBalance > 0 ? '+' : '−'}{formatCurrency(Math.abs(memberBalance), defaultCountry)}
                </div>
              </div>
            )}
            <div style={{flex:1}}>
              <div style={{color:'var(--muted)',marginBottom:2}}>Net due</div>
              <div style={{fontWeight:800,color:'var(--accent)'}}>{formatCurrency(memberNetDue, defaultCountry)}</div>
            </div>
          </div>
        )}

        <div className="fld">
          <label>Amount</label>
          <input value={amount} onChange={e => setAmount(e.target.value)}
            type="number" placeholder={activeMember ? String(memberNetDue) : '0'} style={inpStyle}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div className="fld">
            <label>Mode</label>
            <select value={mode} onChange={e => setMode(e.target.value as PayMode)} style={inpStyle}>
              {PAY_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>Date</label>
            <input value={date} onChange={e => setDate(e.target.value)} type="date" style={inpStyle}/>
          </div>
        </div>
        {mode !== 'cash' && (
          <div className="fld">
            <label>Transaction ID (optional)</label>
            <input value={txnId} onChange={e => setTxnId(e.target.value)}
              placeholder="UPI ref / cheque no. / transfer ID" style={inpStyle}/>
          </div>
        )}
        <div className="fld">
          <label>Period (optional)</label>
          <input value={period} onChange={e => setPeriod(e.target.value)}
            placeholder="e.g. April 2025" style={inpStyle}/>
        </div>
        <div className="fld">
          <label>Note</label>
          <input value={note} onChange={e => setNote(e.target.value)}
            placeholder="Optional" style={inpStyle}/>
        </div>

        <div className="btn-row">
          <button className="btn g" onClick={onClose}>Cancel</button>
          <button className="btn p" onClick={handleRecord}>Record Payment</button>
        </div>
      </div>
    </div>
  );
}
