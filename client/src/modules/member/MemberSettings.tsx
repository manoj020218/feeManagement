import { useAppStore } from '@/core/store/useAppStore';
import { useAuthStore } from '@/core/store/useAuthStore';
import { th } from '@/data/institutionTypes';

export default function MemberSettings() {
  const { user, memberships, removeMembership } = useAppStore();
  const { logout } = useAuthStore();

  return (
    <div style={{padding:'16px 16px 0'}}>
      {/* Profile */}
      <div className="card" style={{marginBottom:10}}>
        <div className="card-hdr">Profile</div>
        <div className="tgl-row"><label>Name</label>
          <span style={{fontSize:'.85rem',color:'var(--muted)'}}>{user?.name ?? '—'}</span>
        </div>
        <div className="tgl-row" style={{border:'none'}}><label>Phone</label>
          <span style={{fontSize:'.82rem',color:'var(--muted)'}}>{user?.phone ?? '—'}</span>
        </div>
      </div>

      {/* My Memberships */}
      <div className="card" style={{marginBottom:10}}>
        <div className="card-hdr">My Memberships ({memberships.length})</div>
        {memberships.length === 0 && (
          <div style={{fontSize:'.82rem',color:'var(--muted)'}}>No memberships</div>
        )}
        {memberships.map(ms => (
          <div key={ms.id} className="tgl-row">
            <div>
              <div style={{fontSize:'.85rem',fontWeight:600}}>{th(ms.instType).icon} {ms.instName}</div>
              <div style={{fontSize:'.7rem',color:'var(--muted)'}}>{ms.myPlan} · {ms.inviteCode}</div>
            </div>
            <button onClick={() => { if (confirm(`Leave ${ms.instName}?`)) removeMembership(ms.id); }}
              style={{background:'none',border:'1px solid rgba(255,92,92,.3)',borderRadius:6,color:'var(--red)',
                padding:'4px 9px',fontSize:'.72rem',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>
              Leave
            </button>
          </div>
        ))}
      </div>

      <div className="pnote" style={{padding:'12px 0'}}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width={16} height={16}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        All data is stored locally on your device
      </div>

      <button className="btn g" style={{color:'var(--red)',borderColor:'rgba(255,92,92,.2)',marginBottom:24}}
        onClick={() => { if (confirm('Log out?')) logout(); }}>
        Log Out
      </button>
    </div>
  );
}
