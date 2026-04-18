import ProfilePage from '@/modules/shared/ProfilePage';
import FeedbackForm from './FeedbackForm';
import { useAppStore } from '@/core/store/useAppStore';
import { api, APP_VERSION, API_BASE } from '@/core/services/api';
import { useState } from 'react';

export default function MemberProfilePage() {
  const settings = useAppStore(s => s.settings);
  const updateSettings = useAppStore(s => s.updateSettings);
  const [sessions, setSessions] = useState<{ id:string; deviceLabel:string; ip:string; lastSeen:string; isCurrent:boolean }[]>([]);
  const [sessOpen, setSessOpen] = useState(false);

  async function openSessions() {
    setSessOpen(true);
    const d = await api<{ sessions: typeof sessions }>('GET', '/auth/sessions');
    if (d?.sessions) setSessions(d.sessions);
  }

  return (
    <div>
      <ProfilePage accentColor="var(--member-accent)"/>

      {/* Feedback */}
      <div style={{ paddingTop: 4 }}>
        <FeedbackForm/>
      </div>

      {/* Cloud settings */}
      {API_BASE && (
        <div className="card" style={{ margin: '0 16px 12px' }}>
          <div className="card-hdr">Cloud & Devices</div>
          <div className="tgl-row">
            <div>
              <div style={{ fontSize:'.85rem', fontWeight:600 }}>VPS Sync</div>
              <div style={{ fontSize:'.7rem', color:'var(--muted)', marginTop:2 }}>1 year free</div>
            </div>
            <label className="tgl-switch">
              <input type="checkbox" checked={settings.vpsSyncEnabled !== false}
                onChange={e => updateSettings({ vpsSyncEnabled: e.target.checked })}/>
              <span className="tgl-track"/>
            </label>
          </div>
          <div className="tgl-row" style={{ cursor:'pointer', border:'none' }} onClick={openSessions}>
            <div>
              <div style={{ fontSize:'.85rem', fontWeight:600 }}>Active Devices</div>
              <div style={{ fontSize:'.7rem', color:'var(--muted)', marginTop:2 }}>View logged-in devices</div>
            </div>
            <span style={{ color:'var(--muted)' }}>›</span>
          </div>
        </div>
      )}

      <div style={{ padding:'0 16px', paddingBottom:24 }}>
        <div style={{ fontSize:'.7rem', color:'var(--muted)', textAlign:'center', marginBottom:8 }}>
          FeeFlow v{APP_VERSION} · Privacy-first fee management
        </div>
      </div>

      {/* Sessions modal */}
      {sessOpen && (
        <div className="mo open" onClick={e => { if(e.target===e.currentTarget) setSessOpen(false); }}>
          <div className="mo-box" style={{ maxHeight:'75vh', overflowY:'auto' }}>
            <div className="mo-handle"/>
            <div className="mo-title">Active Devices</div>
            {sessions.length === 0 && <div style={{ color:'var(--muted)', textAlign:'center', padding:16, fontSize:'.82rem' }}>Loading…</div>}
            {sessions.map(s => (
              <div key={s.id} style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize:'.85rem', fontWeight:600 }}>
                    {s.deviceLabel}
                    {s.isCurrent && <span style={{ marginLeft:6, fontSize:'.65rem', background:'rgba(45,212,160,.15)', color:'var(--green)', padding:'2px 7px', borderRadius:99, fontWeight:700 }}>This device</span>}
                  </div>
                  <div style={{ fontSize:'.72rem', color:'var(--muted)', marginTop:3 }}>
                    {new Date(s.lastSeen).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>
                {!s.isCurrent && (
                  <button onClick={async () => { if(confirm('Logout?')) { await api('DELETE','/auth/sessions/'+s.id); openSessions(); }}} style={{ background:'none', border:'1px solid rgba(255,92,92,.3)', borderRadius:6, color:'var(--red)', padding:'4px 9px', fontSize:'.72rem', cursor:'pointer', fontFamily:'Outfit,sans-serif', flexShrink:0 }}>Logout</button>
                )}
              </div>
            ))}
            <button className="btn g" onClick={() => setSessOpen(false)} style={{ marginTop:8 }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
