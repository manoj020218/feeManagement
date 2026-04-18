import { useState } from 'react';
import { useAppStore } from '@/core/store/useAppStore';
import { useUIStore } from '@/core/store/useUIStore';
import { formatCurrency } from '@/data/countries';
import { fmtDateShort } from '@/utils/dateHelpers';

import RecordPaymentModal from './RecordPaymentModal';
const EMPTY_ARRAY: never[] = [];

export default function PaymentsPage() {
  // ✅ Individual selectors – no whole‑store destructuring
  const institutions = useAppStore(s => s.institutions);
  const activeInstId = useAppStore(s => s.activeInstId);
  const deleteTransaction = useAppStore(s => s.deleteTransaction);
  const defaultCountry = useAppStore(s => s.defaultCountry);

  // ✅ Stable fallback using EMPTY_ARRAY
  const members = useAppStore(s => 
    activeInstId ? s.members[activeInstId] ?? EMPTY_ARRAY : EMPTY_ARRAY
  );
  const allTxns = useAppStore(s => 
    activeInstId ? s.transactions[activeInstId] ?? EMPTY_ARRAY : EMPTY_ARRAY
  );
  const { toast } = useUIStore();
  const inst = institutions.find(i => i.id === activeInstId);

  const [showForm, setShowForm] = useState(false);

  if (!inst) return <div style={{padding:24,color:'var(--muted)',textAlign:'center'}}>Select an institution first</div>;

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
                {tx.txnId && <div style={{fontSize:'.72rem',color:'var(--muted2)',marginTop:2}}>Txn: {tx.txnId}</div>}
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

      {showForm && (
        <RecordPaymentModal instId={inst.id} onClose={() => setShowForm(false)}/>
      )}
    </div>
  );
}
