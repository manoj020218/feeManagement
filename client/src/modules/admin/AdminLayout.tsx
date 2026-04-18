import { useState } from 'react';
import BottomNav from '@/modules/shared/BottomNav';
import { useAppStore } from '@/core/store/useAppStore';
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
  const { institutions, activeInstId, setActiveRole, user } = useAppStore();
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Institution logo if available */}
          {inst?.logo && (
            <img src={inst.logo} style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} alt=""/>
          )}
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>
              {inst ? inst.name : 'FeeFlow'}
            </div>
            <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: 2 }}>
              Admin · {user?.name ?? ''}
            </div>
          </div>
        </div>
        <button onClick={() => setActiveRole('member')} style={{
          background: 'rgba(45,212,160,.1)', border: '1px solid rgba(45,212,160,.2)',
          borderRadius: 8, color: 'var(--green)', padding: '5px 10px',
          fontSize: '.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif',
        }}>
          Member View
        </button>
      </div>

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
