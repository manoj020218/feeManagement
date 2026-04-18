import { useState } from 'react';
import BottomNav from '@/modules/shared/BottomNav';
import { useAppStore } from '@/core/store/useAppStore';
import { th } from '@/data/institutionTypes';
import Dashboard from './Dashboard';
import MembersPage from './Members';
import PaymentsPage from './Payments';
import ReportsPage from './Reports';
import AdminAnnounce from './Announce';
import AdminProfile from './Profile';

const NAV_ITEMS = [
  { id:'Home',     label:'Home',     icon:'🏠' },
  { id:'Members',  label:'Members',  icon:'👥' },
  { id:'Payments', label:'Payments', icon:'💳' },
  { id:'Announce', label:'Announce', icon:'📢' },
  { id:'Profile',  label:'Profile',  icon:'👤' },
];

export default function AdminLayout() {
  const [tab, setTab] = useState('Home');
  const [switcherOpen, setSwitcherOpen] = useState(false);
  //const { institutions, activeInstId, setActiveInst, setActiveRole, user } = useAppStore();
   // ✅ Individual selectors – no whole‑store destructuring
  const institutions = useAppStore(s => s.institutions);
  const activeInstId = useAppStore(s => s.activeInstId);
  const setActiveInst = useAppStore(s => s.setActiveInst);
  const setActiveRole = useAppStore(s => s.setActiveRole);
  const user = useAppStore(s => s.user);
  const inst = institutions.find(i => i.id === activeInstId);
  const accentColor = inst?.accentColor ?? 'var(--accent)';

  return (
    <div className="page show" style={{ background: 'var(--bg)' }}>
      {/* Top bar */}
      <div className="topbar" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
        padding: 'calc(env(safe-area-inset-top) + 12px) 16px 12px',
        background: 'var(--s1)', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        {/* Institution name — tappable to switch when multiple exist */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: institutions.length > 1 ? 'pointer' : 'default', flex: 1, minWidth: 0 }}
          onClick={() => { if (institutions.length > 1) setSwitcherOpen(true); }}
        >
          {inst?.logo && (
            <img src={inst.logo} style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} alt=""/>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {inst ? inst.name : 'FeeFlow'}
              </span>
              {institutions.length > 1 && (
                <span style={{ fontSize: '.75rem', color: 'var(--muted)', flexShrink: 0 }}>▾</span>
              )}
            </div>
            <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: 2 }}>
              Admin · {user?.name ?? ''}
            </div>
          </div>
        </div>
        <button onClick={() => setActiveRole('member')} style={{
          background: 'rgba(45,212,160,.1)', border: '1px solid rgba(45,212,160,.2)',
          borderRadius: 8, color: 'var(--green)', padding: '5px 10px',
          fontSize: '.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif', flexShrink: 0,
        }}>
          Member View
        </button>
      </div>

      {/* Institution switcher dropdown */}
      {switcherOpen && (
        <div className="mo open" onClick={e => { if (e.target === e.currentTarget) setSwitcherOpen(false); }}>
          <div className="mo-box">
            <div className="mo-handle"/>
            <div className="mo-title">Switch Institution</div>
            {institutions.map(i => (
              <div key={i.id}
                onClick={() => { setActiveInst(i.id); setSwitcherOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                  borderBottom: '1px solid var(--border)', cursor: 'pointer',
                  background: i.id === activeInstId ? 'rgba(79,142,255,.05)' : 'transparent',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
                  background: `${th(i.type).color}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
                }}>
                  {i.logo
                    ? <img src={i.logo} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/>
                    : th(i.type).icon
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '.9rem' }}>{i.name}</div>
                  <div style={{ fontSize: '.7rem', color: 'var(--muted)' }}>{i.inviteCode}</div>
                </div>
                {i.id === activeInstId && (
                  <span style={{ fontSize: '.65rem', fontWeight: 800, color: 'var(--accent)', padding: '2px 8px', borderRadius: 99, background: 'rgba(79,142,255,.12)' }}>ACTIVE</span>
                )}
              </div>
            ))}
            <button className="btn g" style={{ marginTop: 10 }} onClick={() => setSwitcherOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
        {tab === 'Home'     && <Dashboard accentColor={accentColor}/>}
        {tab === 'Members'  && <MembersPage/>}
        {tab === 'Payments' && <PaymentsPage/>}
        {tab === 'Announce' && <AdminAnnounce/>}
        {tab === 'Profile'  && <AdminProfile/>}
      </div>

      <BottomNav items={NAV_ITEMS} active={tab} onSelect={setTab} accentColor={accentColor}/>
    </div>
  );
}
