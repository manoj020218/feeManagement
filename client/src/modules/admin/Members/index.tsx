import { useState, useMemo } from 'react';
import { useAppStore } from '@/core/store/useAppStore';
import { useUIStore } from '@/core/store/useUIStore';
import { th } from '@/data/institutionTypes';
import { formatCurrency } from '@/data/countries';
import { fmtDateShort, daysDiff } from '@/utils/dateHelpers';
// fmtDate unused but kept for future receipt link
import MemberForm from './MemberForm';
import type { Member } from '@/core/types';

type Filter = 'All' | 'Paid' | 'Due' | 'Overdue';

export default function MembersPage() {
  const { institutions, activeInstId, getMembers, deleteMember, defaultCountry } = useAppStore();
  const { toast, openModal } = useUIStore();
  const inst = institutions.find(i => i.id === activeInstId);
  const members = inst ? getMembers(inst.id) : [];

  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<Filter>('All');
  const [editMember, setEdit] = useState<Member | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const t = inst ? th(inst.type) : th('other');

  const filtered = useMemo(() =>
    members.filter(m => {
      const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.phone?.includes(search);
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
      <div style={{display:'flex',gap:8,marginBottom:12}}>
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
        const days = m.nextDue ? daysDiff(m.nextDue) : null;
        const isOverdue = m.status === 'overdue';
        const isDue     = m.status === 'due';
        const statusColor = isOverdue ? 'var(--red)' : isDue ? 'var(--yellow)' : m.status === 'paid' ? 'var(--green)' : 'var(--muted)';

        return (
          <div key={m.id} className="card" style={{marginBottom:8,padding:'12px 14px'}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
              {/* Avatar */}
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
                  }}>{m.status.toUpperCase()}</span>
                </div>
                <div style={{fontSize:'.72rem',color:'var(--muted)',marginTop:3}}>
                  {m.plan}
                  {m.phone && ` · ${m.phone}`}
                </div>
                <div style={{display:'flex',gap:12,marginTop:5,flexWrap:'wrap'}}>
                  <span style={{fontSize:'.78rem',fontWeight:700,color:statusColor}}>
                    {formatCurrency(m.fee, defaultCountry)}
                  </span>
                  {m.nextDue && (
                    <span style={{fontSize:'.72rem',color: days !== null && days < 0 ? 'var(--red)' : 'var(--muted)'}}>
                      Due: {fmtDateShort(m.nextDue)}
                      {days !== null && days <= 7 ? (days < 0 ? ` (${Math.abs(days)}d ago)` : days === 0 ? ' (today)' : ` (${days}d)`) : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                <button onClick={() => setEdit(m)}
                  style={{background:'var(--s2)',border:'1px solid var(--border)',borderRadius:7,
                    color:'var(--text)',padding:'5px 10px',fontSize:'.72rem',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>
                  Edit
                </button>
                <button onClick={() => handleDelete(m)}
                  style={{background:'none',border:'1px solid rgba(255,92,92,.3)',borderRadius:7,
                    color:'var(--red)',padding:'5px 10px',fontSize:'.72rem',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>
                  Del
                </button>
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
    </div>
  );
}
