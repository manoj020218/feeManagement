import { useState } from 'react';
import BottomNav from '@/modules/shared/BottomNav';
import { useAppStore } from '@/core/store/useAppStore';
import MyFees from './MyFees';
import JoinFlow from './JoinFlow';
import Announcements from './Announcements';
import MemberProfilePage from './ProfilePage';

const NAV_ITEMS = [
  { id:'Fees',     label:'My Fees',  icon:'💳' },
  { id:'Join',     label:'Join',     icon:'🔗' },
  { id:'Announce', label:'Updates',  icon:'🔔' },
  { id:'Profile',  label:'Profile',  icon:'👤' },
];

export default function MemberLayout() {
  const [tab, setTab] = useState('Fees');
  const [annCount, setAnnCount] = useState(0);
  const { memberships, setActiveRole, institutions } = useAppStore();

  const navItems = NAV_ITEMS.map(n =>
    n.id === 'Announce' && annCount > 0
      ? { ...n, badge: String(annCount) }
      : n
  );

  return (
    <div className="page show" style={{ background: 'var(--bg)' }}>
      {/* Top bar */}
      <div className="topbar" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'calc(env(safe-area-inset-top) + 12px) 16px 12px',
        background: 'var(--s1)', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--member-accent)' }}>
            My Memberships
          </div>
          <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: 2 }}>
            {memberships.length} active
          </div>
        </div>
        {institutions.length > 0 && (
          <button onClick={() => setActiveRole('admin')} style={{
            background: 'rgba(79,142,255,.1)', border: '1px solid rgba(79,142,255,.2)',
            borderRadius: 8, color: 'var(--accent)', padding: '5px 10px',
            fontSize: '.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif',
          }}>
            Switch to Admin
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
        {tab === 'Fees'     && <MyFees/>}
        {tab === 'Join'     && <JoinFlow onJoined={() => setTab('Fees')}/>}
        {tab === 'Announce' && <Announcements onLoad={setAnnCount}/>}
        {tab === 'Profile'  && <MemberProfilePage/>}
      </div>

      <BottomNav items={navItems} active={tab} onSelect={setTab} accentColor="var(--member-accent)"/>
    </div>
  );
}
