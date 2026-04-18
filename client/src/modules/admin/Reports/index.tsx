import { useMemo } from 'react';
import { useAppStore } from '@/core/store/useAppStore';
import { formatCurrency } from '@/data/countries';
import { fmtDate } from '@/utils/dateHelpers';

export default function ReportsPage() {
  const { institutions, activeInstId, getMembers, getTransactions, defaultCountry } = useAppStore();
  const inst    = institutions.find(i => i.id === activeInstId);
  const members = inst ? getMembers(inst.id) : [];
  const txns    = inst ? getTransactions(inst.id) : [];

  const stats = useMemo(() => {
    const totalCollected = txns.reduce((s, t) => s + t.amount, 0);
    const expectedMonthly = members.reduce((s, m) => s + (m.freq === 'monthly' ? m.fee : 0), 0);
    const byMode: Record<string, number> = {};
    txns.forEach(t => { byMode[t.mode] = (byMode[t.mode] ?? 0) + t.amount; });
    const byMonth: Record<string, number> = {};
    txns.forEach(t => {
      const key = t.date.slice(0, 7);
      byMonth[key] = (byMonth[key] ?? 0) + t.amount;
    });
    return { totalCollected, expectedMonthly, byMode, byMonth };
  }, [members, txns]);

  if (!inst) return <div style={{padding:24,color:'var(--muted)',textAlign:'center'}}>Select an institution first</div>;

  return (
    <div style={{padding:'16px 16px 0'}}>
      <div style={{fontWeight:800,fontSize:'.95rem',marginBottom:14}}>Reports</div>

      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
        <div className="card" style={{padding:14}}>
          <div style={{fontSize:'.7rem',color:'var(--muted)',marginBottom:4}}>Total Collected</div>
          <div style={{fontWeight:800,fontSize:'1.1rem',color:'var(--green)'}}>{formatCurrency(stats.totalCollected, defaultCountry)}</div>
        </div>
        <div className="card" style={{padding:14}}>
          <div style={{fontSize:'.7rem',color:'var(--muted)',marginBottom:4}}>Monthly Expected</div>
          <div style={{fontWeight:800,fontSize:'1.1rem',color:'var(--accent)'}}>{formatCurrency(stats.expectedMonthly, defaultCountry)}</div>
        </div>
        <div className="card" style={{padding:14}}>
          <div style={{fontSize:'.7rem',color:'var(--muted)',marginBottom:4}}>Total Members</div>
          <div style={{fontWeight:800,fontSize:'1.1rem'}}>{members.length}</div>
        </div>
        <div className="card" style={{padding:14}}>
          <div style={{fontSize:'.7rem',color:'var(--muted)',marginBottom:4}}>Paid This Month</div>
          <div style={{fontWeight:800,fontSize:'1.1rem',color:'var(--green)'}}>
            {members.filter(m=>m.status==='paid').length}
          </div>
        </div>
      </div>

      {/* By payment mode */}
      {Object.keys(stats.byMode).length > 0 && (
        <div className="card" style={{marginBottom:14}}>
          <div className="card-hdr">By Payment Mode</div>
          {Object.entries(stats.byMode).map(([mode, amt]) => (
            <div key={mode} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:'.85rem'}}>
              <span style={{textTransform:'capitalize'}}>{mode.replace('_',' ')}</span>
              <span style={{fontWeight:700,color:'var(--green)'}}>{formatCurrency(amt, defaultCountry)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Monthly breakdown */}
      {Object.keys(stats.byMonth).length > 0 && (
        <div className="card" style={{marginBottom:14}}>
          <div className="card-hdr">Monthly Breakdown</div>
          {Object.entries(stats.byMonth).sort((a,b)=>b[0].localeCompare(a[0])).map(([month, amt]) => (
            <div key={month} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:'.85rem'}}>
              <span>{new Date(month + '-01').toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</span>
              <span style={{fontWeight:700,color:'var(--green)'}}>{formatCurrency(amt, defaultCountry)}</span>
            </div>
          ))}
        </div>
      )}

      {txns.length === 0 && (
        <div style={{color:'var(--muted)',textAlign:'center',padding:32,fontSize:'.85rem'}}>No transactions to report yet</div>
      )}
    </div>
  );
}
