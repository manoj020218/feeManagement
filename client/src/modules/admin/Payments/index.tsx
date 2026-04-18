import { useState, useMemo } from 'react';
import { useAppStore } from '@/core/store/useAppStore';
import { useUIStore } from '@/core/store/useUIStore';
import { th } from '@/data/institutionTypes';
import { formatCurrency } from '@/data/countries';
import { fmtDate, fmtDateShort, addFreq, todayISO } from '@/utils/dateHelpers';
import type { Transaction, PayMode } from '@/core/types';

const PAY_MODES: { value: PayMode; label: string }[] = [
  { value:'cash',         label:'Cash'          },
  { value:'upi',          label:'UPI'           },
  { value:'card',         label:'Card'          },
  { value:'cheque',       label:'Cheque'        },
  { value:'bank_transfer',label:'Bank Transfer' },
  { value:'other',        label:'Other'         },
];

export default function PaymentsPage() {
  const { institutions, activeInstId, getMembers, getTransactions, addTransaction, updateMember, deleteTransaction, defaultCountry } = useAppStore();
  const { toast } = useUIStore();
  const inst = institutions.find(i => i.id === activeInstId);
  const members  = inst ? getMembers(inst.id) : [];
  const allTxns  = inst ? getTransactions(inst.id) : [];

  const [showForm,   setShowForm]   = useState(false);
  const [searchMem,  setSearchMem]  = useState('');
  const [pickedMem,  setPickedMem]  = useState('');
  const [amount,     setAmount]     = useState('');
  const [mode,       setMode]       = useState<PayMode>('cash');
  const [date,       setDate]       = useState(todayISO());
  const [period,     setPeriod]     = useState('');
  const [note,       setNote]       = useState('');

  const filteredMembers = useMemo(() =>
    members.filter(m => m.name.toLowerCase().includes(searchMem.toLowerCase())),
  [members, searchMem]);

  function handleRecord() {
    const member = members.find(m => m.id === pickedMem);
    if (!member)  { toast('Select a member', 'warn'); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast('Enter valid amount', 'warn'); return; }

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const receiptNo = 'RCP' + String(allTxns.length + 1).padStart(4, '0');
    const tx: Transaction = {
      id, instId: inst!.id, memberId: member.id,
      amount: amt, mode, date, period: period.trim() || undefined,
      note: note.trim() || undefined, receiptNo,
    };
    addTransaction(tx);

    // Update member status and next due
    const newNextDue = member.nextDue ? addFreq(member.nextDue, member.freq) : addFreq(date, member.freq);
    updateMember(inst!.id, member.id, { status: 'paid', nextDue: newNextDue });

    toast(`Payment recorded — ${receiptNo}`, 'ok');
    setShowForm(false);
    setPickedMem(''); setAmount(''); setPeriod(''); setNote('');
  }

  const inpStyle: React.CSSProperties = {
    width:'100%', background:'var(--s2)', border:'1.5px solid var(--border)',
    borderRadius:'var(--r2)', padding:'10px 13px', color:'var(--text)',
    fontFamily:'Outfit,sans-serif', fontSize:'.88rem', outline:'none',
  };

  if (!inst) return <div style={{padding:24,color:'var(--muted)',textAlign:'center'}}>Select an institution first</div>;

  const t = th(inst.type);

  return (
    <div style={{padding:'16px 16px 0'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div style={{fontWeight:800,fontSize:'.95rem'}}>Payments</div>
        <button onClick={() => setShowForm(true)}
          style={{background:'var(--accent)',border:'none',borderRadius:'var(--r2)',color:'#fff',
            padding:'8px 14px',fontFamily:'Outfit,sans-serif',fontSize:'.8rem',fontWeight:700,cursor:'pointer'}}>
          + Record
        </button>
      </div>

      {/* Transactions list */}
      {allTxns.length === 0 && (
        <div style={{color:'var(--muted)',fontSize:'.85rem',textAlign:'center',padding:32}}>No payments recorded yet</div>
      )}
      {[...allTxns].reverse().map(tx => {
        const m = members.find(mb => mb.id === tx.memberId);
        return (
          <div key={tx.id} className="card" style={{marginBottom:8,padding:'12px 14px'}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:'.88rem'}}>{m?.name ?? 'Unknown'}</div>
                <div style={{fontSize:'.72rem',color:'var(--muted)',marginTop:2}}>
                  {fmtDateShort(tx.date)} · {tx.mode.replace('_',' ').toUpperCase()}
                  {tx.period ? ` · ${tx.period}` : ''}
                  {tx.receiptNo ? ` · ${tx.receiptNo}` : ''}
                </div>
                {tx.note && <div style={{fontSize:'.72rem',color:'var(--muted2)',marginTop:2}}>{tx.note}</div>}
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontWeight:800,color:'var(--green)',fontSize:'.9rem'}}>
                  {formatCurrency(tx.amount, defaultCountry)}
                </div>
                <button onClick={() => {
                  if (confirm('Delete this payment?')) {
                    deleteTransaction(inst.id, tx.id);
                    toast('Deleted', 'ok');
                  }
                }} style={{background:'none',border:'none',color:'var(--muted)',fontSize:'.7rem',cursor:'pointer',marginTop:2,fontFamily:'Outfit,sans-serif'}}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Record Payment Modal */}
      {showForm && (
        <div className="mo open" onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="mo-box" style={{maxHeight:'90vh',overflowY:'auto'}}>
            <div className="mo-handle"/>
            <div className="mo-title">Record Payment</div>

            <div className="fld">
              <label>Search {t.member}</label>
              <input value={searchMem} onChange={e=>setSearchMem(e.target.value)} placeholder="Type name…" style={inpStyle}/>
              {searchMem && filteredMembers.length > 0 && (
                <div style={{background:'var(--s2)',border:'1px solid var(--border)',borderRadius:8,marginTop:4,maxHeight:160,overflowY:'auto'}}>
                  {filteredMembers.map(m => (
                    <div key={m.id} onClick={() => { setPickedMem(m.id); setSearchMem(m.name); setAmount(String(m.fee)); }}
                      style={{padding:'9px 13px',cursor:'pointer',borderBottom:'1px solid var(--border)',fontSize:'.85rem',display:'flex',justifyContent:'space-between'}}>
                      <span>{m.name}</span>
                      <span style={{color:'var(--muted)',fontSize:'.75rem'}}>{formatCurrency(m.fee, defaultCountry)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="fld">
              <label>Amount</label>
              <input value={amount} onChange={e=>setAmount(e.target.value)} type="number" placeholder="0" style={inpStyle}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div className="fld">
                <label>Mode</label>
                <select value={mode} onChange={e=>setMode(e.target.value as PayMode)}
                  style={{...inpStyle}}>
                  {PAY_MODES.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="fld">
                <label>Date</label>
                <input value={date} onChange={e=>setDate(e.target.value)} type="date" style={inpStyle}/>
              </div>
            </div>
            <div className="fld">
              <label>Period (optional)</label>
              <input value={period} onChange={e=>setPeriod(e.target.value)} placeholder="e.g. April 2025" style={inpStyle}/>
            </div>
            <div className="fld">
              <label>Note</label>
              <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Optional" style={inpStyle}/>
            </div>

            <div className="btn-row">
              <button className="btn g" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn p" onClick={handleRecord}>Record Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
