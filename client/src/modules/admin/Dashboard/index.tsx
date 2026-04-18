import { useMemo } from 'react';
import { useAppStore } from '@/core/store/useAppStore';
import { th } from '@/data/institutionTypes';
import { fmtDateShort, daysDiff, dueLabel } from '@/utils/dateHelpers';
import { formatCurrency } from '@/data/countries';

interface Props { accentColor: string; }

export default function Dashboard({ accentColor }: Props) {
  const { institutions, activeInstId, setActiveInst, getMembers, getTransactions, defaultCountry } = useAppStore();
  const inst = institutions.find(i => i.id === activeInstId);
  const members = inst ? getMembers(inst.id) : [];
  const txns    = inst ? getTransactions(inst.id) : [];

  const stats = useMemo(() => {
    const total     = members.length;
    const paid      = members.filter(m => m.status === 'paid').length;
    const due       = members.filter(m => m.status === 'due' || m.status === 'overdue').length;
    const monthly   = txns.filter(t => {
      const d = new Date(t.date);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((s, t) => s + t.amount, 0);
    return { total, paid, due, monthly };
  }, [members, txns]);

  const dueMembers = useMemo(() =>
    members.filter(m => m.status === 'due' || m.status === 'overdue')
      .sort((a, b) => {
        const da = a.nextDue ? new Date(a.nextDue).getTime() : Infinity;
        const db = b.nextDue ? new Date(b.nextDue).getTime() : Infinity;
        return da - db;
      }).slice(0, 5),
  [members]);

  if (!inst) return (
    <div style={{padding:24,textAlign:'center',color:'var(--muted)'}}>
      <div style={{fontSize:'2rem',marginBottom:12}}>🏛️</div>
      <div style={{fontWeight:700,marginBottom:8}}>No institution yet</div>
      <div style={{fontSize:'.82rem'}}>Go to Settings to add one</div>
    </div>
  );

  const t = th(inst.type);

  return (
    <div style={{padding:'16px 16px 0'}}>
      {/* Institution selector (if multiple) */}
      {institutions.length > 1 && (
        <div style={{display:'flex',gap:8,overflowX:'auto',marginBottom:14,scrollbarWidth:'none'}}>
          {institutions.map(i => (
            <button key={i.id} onClick={() => setActiveInst(i.id)}
              style={{flexShrink:0,padding:'6px 14px',borderRadius:99,border:`1.5px solid ${i.id===activeInstId?accentColor:'var(--border)'}`,
                background:i.id===activeInstId?`rgba(${hexToRgb(accentColor)},.1)`:'transparent',
                color:i.id===activeInstId?accentColor:'var(--muted2)',
                fontFamily:'Outfit,sans-serif',fontSize:'.78rem',fontWeight:700,cursor:'pointer'}}>
              {th(i.type).icon} {i.name}
            </button>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
        <StatCard label="Total Members" value={stats.total} icon="👥" color={accentColor}/>
        <StatCard label="Paid" value={stats.paid} icon="✓" color="var(--green)"/>
        <StatCard label="Due / Overdue" value={stats.due} icon="⚠" color="var(--yellow)"/>
        <StatCard label={`This Month`} value={formatCurrency(stats.monthly, defaultCountry)} icon="💰" color="var(--green)" small/>
      </div>

      {/* Due soon */}
      {dueMembers.length > 0 && (
        <div className="card" style={{marginBottom:14}}>
          <div className="card-hdr">Due Soon</div>
          {dueMembers.map(m => {
            const days = m.nextDue ? daysDiff(m.nextDue) : null;
            const isOverdue = days !== null && days < 0;
            return (
              <div key={m.id} className="mrow" style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                <div className="mavatar" style={{
                  width:38,height:38,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
                  background:`rgba(${hexToRgb(accentColor)},.15)`,color:accentColor,fontWeight:800,fontSize:'.9rem',flexShrink:0,
                }}>
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:'.88rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.name}</div>
                  <div style={{fontSize:'.72rem',color:'var(--muted)',marginTop:2}}>{m.plan}</div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontWeight:800,fontSize:'.82rem',color:isOverdue?'var(--red)':'var(--yellow)'}}>
                    {formatCurrency(m.fee, defaultCountry)}
                  </div>
                  <div style={{fontSize:'.68rem',color:isOverdue?'var(--red)':'var(--muted)',marginTop:2}}>
                    {days !== null ? (days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `in ${days}d`) : '—'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent transactions */}
      <div className="card" style={{marginBottom:14}}>
        <div className="card-hdr">Recent Payments</div>
        {txns.length === 0 && <div style={{color:'var(--muted)',fontSize:'.82rem',padding:'4px 0'}}>No payments yet</div>}
        {[...txns].reverse().slice(0, 5).map(tx => {
          const m = members.find(mb => mb.id === tx.memberId);
          return (
            <div key={tx.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:'.85rem'}}>{m?.name ?? 'Unknown'}</div>
                <div style={{fontSize:'.72rem',color:'var(--muted)',marginTop:2}}>{fmtDateShort(tx.date)} · {tx.mode}</div>
              </div>
              <div style={{fontWeight:800,fontSize:'.88rem',color:'var(--green)',flexShrink:0}}>
                {formatCurrency(tx.amount, defaultCountry)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, small }: {
  label: string; value: string | number; icon: string; color: string; small?: boolean;
}) {
  return (
    <div className="card" style={{padding:'14px',display:'flex',alignItems:'center',gap:10,marginBottom:0}}>
      <div style={{fontSize:'1.4rem',flexShrink:0}}>{icon}</div>
      <div>
        <div style={{fontWeight:800,fontSize:small?'.92rem':'1.2rem',color}}>{value}</div>
        <div style={{fontSize:'.7rem',color:'var(--muted)',marginTop:1}}>{label}</div>
      </div>
    </div>
  );
}

function hexToRgb(color: string): string {
  if (color.startsWith('var(')) return '79,142,255';
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  if (!r) return '79,142,255';
  return `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}`;
}
