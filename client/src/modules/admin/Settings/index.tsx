import { useState } from 'react';
import { useAppStore } from '@/core/store/useAppStore';
import { useAuthStore } from '@/core/store/useAuthStore';
import { useUIStore } from '@/core/store/useUIStore';
import { th, TYPES } from '@/data/institutionTypes';
import { COUNTRIES } from '@/data/countries';
import { APP_VERSION, API_BASE, checkVersion, api } from '@/core/services/api';
import { todayISO } from '@/utils/dateHelpers';
import type { PayQR } from '@/core/types';
import QRCodeLib from 'qrcode';
import { performDriveBackup } from '@/core/services/driveService';

export default function SettingsPage() {
  // ✅ Individual selectors – no whole‑store destructuring
  const user = useAppStore(s => s.user);
  const institutions = useAppStore(s => s.institutions);
  const memberships = useAppStore(s => s.memberships);
  const defaultCountry = useAppStore(s => s.defaultCountry);
  const activeInstId = useAppStore(s => s.activeInstId);
  const setDefaultCountry = useAppStore(s => s.setDefaultCountry);
  const addInstitution = useAppStore(s => s.addInstitution);
  const setActiveInst = useAppStore(s => s.setActiveInst);
  const updateInstitution = useAppStore(s => s.updateInstitution);
  const deleteInstitution = useAppStore(s => s.deleteInstitution);
  const settings = useAppStore(s => s.settings);
  const updateSettings = useAppStore(s => s.updateSettings);

  const { logout } = useAuthStore();
  const { toast } = useUIStore();

  const [updateStatus, setUpdateStatus] = useState('');
  const [updChecking, setUpdChecking]   = useState(false);

  // Add institution
  const [addInstOpen, setAddInstOpen] = useState(false);
  const [newInstName, setNewInstName] = useState('');
  const [newInstType, setNewInstType] = useState('school');

  // QR form
  const [qrOpen,    setQrOpen]    = useState(false);
  const [qrInstId,  setQrInstId]  = useState('');
  const [qrEditId,  setQrEditId]  = useState('');
  const [qrName,    setQrName]    = useState('');
  const [qrUpi,     setQrUpi]     = useState('');
  const [qrApp,     setQrApp]     = useState<PayQR['app']>('PhonePe');
  const [qrPreview, setQrPreview] = useState('');

  // Sessions
  const [sessions,      setSessions]      = useState<{ id:string; deviceLabel:string; ip:string; lastSeen:string; isCurrent:boolean }[]>([]);
  const [sessionsOpen,  setSessionsOpen]  = useState(false);

  // Publish institution
  const [publishingId,  setPublishingId]  = useState<string | null>(null);
  const [pubOpen,       setPubOpen]       = useState(false);
  const [pubInstId,     setPubInstId]     = useState('');
  const [pubAddress,    setPubAddress]    = useState('');
  const [pubPlans,      setPubPlans]      = useState<{ name:string; fee:number; freq:string }[]>([
    { name:'Standard', fee:0, freq:'monthly' },
  ]);

  async function handleCheckUpdate() {
    setUpdChecking(true);
    setUpdateStatus('Checking…');
    const data = await checkVersion();
    setUpdChecking(false);
    if (!data) { setUpdateStatus('Could not check — check connection'); return; }
    const [maj,min,pat] = data.version.split('.').map(Number);
    const [cmaj,cmin,cpat] = APP_VERSION.split('.').map(Number);
    if (maj > cmaj || min > cmin || pat > cpat) {
      setUpdateStatus(`v${data.version} available${data.changelog ? ' — ' + data.changelog : ''}  →  Tap to install`);
    } else {
      setUpdateStatus(`You're on the latest version (v${APP_VERSION})`);
    }
  }

  async function generateQRPreview(upi: string, name: string) {
    if (!upi) { setQrPreview(''); return; }
    const str = `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(name)}&cu=INR`;
    try {
      const dataUrl = await QRCodeLib.toDataURL(str, { width:160, margin:1 });
      setQrPreview(dataUrl);
    } catch { setQrPreview(''); }
  }

  function openAddQR(instId: string, existing?: PayQR) {
    setQrInstId(instId);
    setQrEditId(existing?.id ?? '');
    setQrName(existing?.name ?? '');
    setQrUpi(existing?.upi ?? '');
    setQrApp(existing?.app ?? 'PhonePe');
    setQrPreview('');
    if (existing?.upi) generateQRPreview(existing.upi, existing.name);
    setQrOpen(true);
  }

  function saveQR() {
    if (!qrName.trim() || !qrUpi.trim()) { toast('Enter name and UPI ID', 'warn'); return; }
    if (!qrUpi.includes('@')) { toast('UPI ID must contain @ e.g. 9876543210@ybl', 'warn'); return; }
    const inst = institutions.find(i => i.id === qrInstId);
    if (!inst) return;
    const qrs = [...(inst.payQRs ?? [])];
    if (qrEditId) {
      const idx = qrs.findIndex(q => q.id === qrEditId);
      if (idx > -1) qrs[idx] = { id:qrEditId, name:qrName.trim(), upi:qrUpi.trim(), app:qrApp };
    } else {
      qrs.push({ id:'qr'+Date.now(), name:qrName.trim(), upi:qrUpi.trim(), app:qrApp });
    }
    updateInstitution(qrInstId, { payQRs: qrs });
    toast('QR saved', 'ok');
    setQrOpen(false);
  }

  function deleteQR(instId: string, qrId: string) {
    if (!confirm('Delete this QR code?')) return;
    const inst = institutions.find(i => i.id === instId);
    if (!inst) return;
    updateInstitution(instId, { payQRs: (inst.payQRs ?? []).filter(q => q.id !== qrId) });
    toast('Deleted', 'ok');
  }

  async function openSessions() {
    setSessionsOpen(true);
    const data = await api<{ sessions: typeof sessions }>('GET', '/auth/sessions');
    if (data?.sessions) setSessions(data.sessions);
  }

  async function revokeSession(sid: string) {
    if (!confirm('Logout this device?')) return;
    await api('DELETE', '/auth/sessions/' + sid);
    openSessions();
    toast('Device logged out', 'ok');
  }

  async function revokeOthers() {
    if (!confirm('Logout all other devices?')) return;
    await api('DELETE', '/auth/sessions/others');
    openSessions();
    toast('All other devices logged out', 'ok');
  }

  function handleAddInst() {
    if (!newInstName.trim()) { toast('Enter institution name', 'warn'); return; }
    const t = th(newInstType);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    addInstitution({
      id, name: newInstName.trim(), type: newInstType, inviteCode: code,
      country: defaultCountry,
      currency: COUNTRIES.find(c=>c.code===defaultCountry)?.currency ?? 'INR',
      accentColor: t.color, template: {}, payQRs: [], createdAt: todayISO(),
    });
    setActiveInst(id);
    setAddInstOpen(false);
    setNewInstName('');
    toast('Institution added', 'ok');
  }

  function openPublish(instId: string) {
    const inst = institutions.find(i => i.id === instId);
    if (!inst) return;
    setPubInstId(instId);
    setPubAddress('');
    setPubPlans(th(inst.type).plans.map((p, i) => ({
      name: p,
      fee: th(inst.type).fees[i] ?? 0,
      freq: 'monthly',
    })));
    setPubOpen(true);
  }

  async function handlePublish() {
    const inst = institutions.find(i => i.id === pubInstId);
    if (!inst) return;
    setPublishingId(pubInstId);
    const data = await api('POST', '/institutions/publish', {
      inviteCode: inst.inviteCode,
      name: inst.name,
      type: inst.type,
      address: pubAddress.trim(),
      plans: pubPlans.filter(p => p.name.trim()),
    });
    setPublishingId(null);
    if (!data) { toast('Publish failed — check connection', 'err'); return; }
    toast(`"${inst.name}" is now in the member directory ✓`, 'ok');
    setPubOpen(false);
  }

  const handleBackup = async () => {
  const state = useAppStore.getState();
  const backupData = {
    user: state.user,
    institutions: state.institutions,
    memberships: state.memberships,
    // add any other fields (e.g., settings, theme)
  };
  const fileName = `FeeFlow_backup_${new Date().toISOString()}.json`;
  try {
    await performDriveBackup(backupData, fileName);
    // success toast
  } catch (error) {
    // error toast
  }
};

  const inpStyle: React.CSSProperties = {
    width:'100%', background:'var(--s2)', border:'1.5px solid var(--border)',
    borderRadius:'var(--r2)', padding:'10px 13px', color:'var(--text)',
    fontFamily:'Outfit,sans-serif', fontSize:'.88rem', outline:'none',
  };

  return (
    <div style={{padding:'16px 16px 0'}}>
      {/* Account */}
      <div className="card" style={{marginBottom:10}}>
        <div className="card-hdr">Account</div>
        <div className="tgl-row"><label>Name</label>
          <span style={{fontSize:'.85rem',color:'var(--muted)'}}>{user?.name ?? '—'}</span>
        </div>
        <div className="tgl-row" style={{border:'none'}}><label>Phone</label>
          <span style={{fontSize:'.82rem',color:'var(--muted)'}}>{user?.phone ?? '—'}</span>
        </div>
      </div>

      {/* Institutions */}
      <div className="card" style={{marginBottom:10}}>
        <div className="card-hdr">Institutions ({institutions.length})</div>
        {institutions.map(inst => (
          <div key={inst.id} style={{borderBottom:'1px solid var(--border)',padding:'10px 0'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}>
              <div style={{flex:1}}>
                <div style={{fontSize:'.85rem',fontWeight:600}}>{th(inst.type).icon} {inst.name}</div>
                <div style={{fontSize:'.7rem',color:'var(--muted)',marginTop:2}}>
                  {th(inst.type).label}
                  <span style={{
                    marginLeft:8,fontWeight:800,letterSpacing:2,
                    background:'var(--s2)',border:'1px solid var(--border)',
                    borderRadius:5,padding:'2px 7px',fontSize:'.68rem',color:'var(--text)',
                    userSelect:'all',
                  }}>{inst.inviteCode}</span>
                </div>
              </div>
            </div>
            <div style={{display:'flex',gap:7}}>
              <button onClick={() => openPublish(inst.id)}
                disabled={publishingId === inst.id}
                style={{flex:1,background:'rgba(79,142,255,.1)',border:'1px solid rgba(79,142,255,.25)',
                  borderRadius:7,color:'var(--accent)',padding:'6px 10px',fontSize:'.72rem',
                  fontWeight:700,cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>
                {publishingId === inst.id ? 'Publishing…' : '📢 Publish / Share'}
              </button>
              <button onClick={() => { if (confirm('Delete institution and all data?')) { deleteInstitution(inst.id); toast('Deleted', 'ok'); }}}
                style={{background:'none',border:'1px solid rgba(255,92,92,.3)',borderRadius:7,
                  color:'var(--red)',padding:'6px 10px',fontSize:'.72rem',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>
                Delete
              </button>
            </div>
          </div>
        ))}
        <button className="btn g" style={{margin:'10px 0 0'}} onClick={() => setAddInstOpen(true)}>+ Add Institution</button>
      </div>

      {/* Fee Rules — per institution */}
      {institutions.length > 0 && (
        <div className="card" style={{marginBottom:10}}>
          <div className="card-hdr">Fee Rules</div>
          {institutions.map(inst => (
            <div key={inst.id} style={{borderBottom:'1px solid var(--border)',padding:'12px 0'}}>
              <div style={{fontSize:'.82rem',fontWeight:700,marginBottom:10}}>
                {th(inst.type).icon} {inst.name}
              </div>

              {/* Grace Period */}
              <div className="tgl-row" style={{marginBottom:10,border:'none'}}>
                <div>
                  <div style={{fontSize:'.85rem',fontWeight:600}}>Grace Period</div>
                  <div style={{fontSize:'.7rem',color:'var(--muted)',marginTop:2}}>Days after due date before marking overdue</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <input
                    type="number" min={0} max={60}
                    value={inst.gracePeriod ?? 0}
                    onChange={e => updateInstitution(inst.id, { gracePeriod: Math.max(0, parseInt(e.target.value) || 0) })}
                    style={{
                      width:56,background:'var(--s2)',border:'1.5px solid var(--border)',
                      borderRadius:'var(--r2)',padding:'6px 10px',color:'var(--text)',
                      fontFamily:'Outfit,sans-serif',fontSize:'.88rem',outline:'none',textAlign:'center',
                    }}
                  />
                  <span style={{fontSize:'.78rem',color:'var(--muted)'}}>days</span>
                </div>
              </div>

              {/* Track balance */}
              <div className="tgl-row" style={{border:'none',marginBottom: inst.trackBalance !== false ? 10 : 0}}>
                <div>
                  <div style={{fontSize:'.85rem',fontWeight:600}}>Track Advance & Arrears</div>
                  <div style={{fontSize:'.7rem',color:'var(--muted)',marginTop:2}}>Carry forward overpayments and short payments</div>
                </div>
                <label className="tgl-switch">
                  <input type="checkbox"
                    checked={inst.trackBalance !== false}
                    onChange={e => updateInstitution(inst.id, { trackBalance: e.target.checked })}/>
                  <span className="tgl-track"/>
                </label>
              </div>

              {/* Auto-advance — only when trackBalance is ON */}
              {inst.trackBalance !== false && (
                <div className="tgl-row" style={{border:'none',marginBottom:10}}>
                  <div>
                    <div style={{fontSize:'.85rem',fontWeight:600}}>Auto-advance Next Due</div>
                    <div style={{fontSize:'.7rem',color:'var(--muted)',marginTop:2}}>Push due date forward when bulk payment covers extra cycle(s)</div>
                  </div>
                  <label className="tgl-switch">
                    <input type="checkbox"
                      checked={inst.autoAdvanceDue !== false}
                      onChange={e => updateInstitution(inst.id, { autoAdvanceDue: e.target.checked })}/>
                    <span className="tgl-track"/>
                  </label>
                </div>
              )}

              {/* Require Approval for new members */}
              <div className="tgl-row" style={{border:'none'}}>
                <div>
                  <div style={{fontSize:'.85rem',fontWeight:600}}>Require Approval for New Members</div>
                  <div style={{fontSize:'.7rem',color:'var(--muted)',marginTop:2}}>Members must request to join; you approve or reject</div>
                </div>
                <label className="tgl-switch">
                  <input type="checkbox"
                    checked={inst.requireApproval === true}
                    onChange={e => {
                      const val = e.target.checked;
                      updateInstitution(inst.id, { requireApproval: val });
                      // Sync to published registry so members see the flag when looking up
                      api('PUT', `/institutions/${inst.inviteCode}`, { requireApproval: val });
                    }}/>
                  <span className="tgl-track"/>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* App Info */}
      <div className="card" style={{marginBottom:10}}>
        <div className="card-hdr">App Info</div>
        <div className="tgl-row"><label>Version</label><span style={{color:'var(--muted)',fontSize:'.82rem'}}>v{APP_VERSION}</span></div>
        <div className="tgl-row" style={{border:'none'}}>
          <label>Updates</label>
          <button onClick={handleCheckUpdate} disabled={updChecking}
            style={{background:'var(--s2)',border:'1px solid var(--border)',borderRadius:7,color:'var(--accent)',fontSize:'.75rem',fontWeight:700,padding:'5px 12px',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>
            {updChecking ? 'Checking…' : 'Check for Update'}
          </button>
        </div>
        {updateStatus && <div style={{fontSize:'.75rem',color:'var(--yellow)',padding:'6px 0'}}>{updateStatus}</div>}
      </div>

      {/* Cloud & Devices */}
      {API_BASE && (
        <div className="card" style={{marginBottom:10}}>
          <div className="card-hdr">Cloud & Devices</div>
          <div className="tgl-row">
            <div>
              <div style={{fontSize:'.85rem',fontWeight:600}}>VPS Sync</div>
              <div style={{fontSize:'.7rem',color:'var(--muted)',marginTop:2}}>Sync login & profile · 1 year free</div>
            </div>
            <label className="tgl-switch">
              <input type="checkbox" checked={settings.vpsSyncEnabled !== false}
                onChange={e => updateSettings({ vpsSyncEnabled: e.target.checked })}/>
              <span className="tgl-track"/>
            </label>
          </div>
          <div className="tgl-row" style={{border:'none',cursor:'pointer'}} onClick={openSessions}>
            <div>
              <div style={{fontSize:'.85rem',fontWeight:600}}>Active Devices</div>
              <div style={{fontSize:'.7rem',color:'var(--muted)',marginTop:2}}>Tap to view logged-in devices</div>
            </div>
            <span style={{color:'var(--muted)'}}>›</span>
          </div>
        </div>
      )}

      {/* Payment QR Codes */}
      {institutions.length > 0 && (
        <div className="card" style={{marginBottom:10}}>
          <div className="card-hdr">Payment QR Codes</div>
          <div style={{fontSize:'.75rem',color:'var(--muted2)',marginBottom:12}}>
            Add PhonePe / Google Pay UPI IDs for fee reminders
          </div>
          {institutions.map(inst => (
            <div key={inst.id} style={{borderBottom:'1px solid var(--border)',paddingBottom:12,marginBottom:12}}>
              <div style={{fontSize:'.82rem',fontWeight:700,marginBottom:8}}>{th(inst.type).icon} {inst.name}</div>
              {(inst.payQRs ?? []).map(qr => (
                <div key={qr.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:'.82rem'}}>{qr.name}</div>
                    <div style={{fontSize:'.72rem',color:'var(--muted)'}}>{qr.upi} · {qr.app}</div>
                  </div>
                  <button onClick={() => openAddQR(inst.id, qr)}
                    style={{background:'none',border:'1px solid var(--border)',borderRadius:6,color:'var(--text)',padding:'4px 8px',fontSize:'.72rem',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>
                    Edit
                  </button>
                  <button onClick={() => deleteQR(inst.id, qr.id)}
                    style={{background:'none',border:'1px solid rgba(255,92,92,.3)',borderRadius:6,color:'var(--red)',padding:'4px 8px',fontSize:'.72rem',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>
                    Del
                  </button>
                </div>
              ))}
              <button className="btn g" style={{marginTop:8,fontSize:'.75rem',padding:'6px 14px'}} onClick={() => openAddQR(inst.id)}>
                + Add UPI / QR
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="pnote" style={{padding:'12px 0'}}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width={16} height={16}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        No financial data stored on servers
      </div>

      <button className="btn g" style={{color:'var(--red)',borderColor:'rgba(255,92,92,.2)',marginBottom:24}}
        onClick={() => { if (confirm('Log out?')) logout(); }}>
        Log Out
      </button>

      {/* Publish Institution Modal */}
      {pubOpen && (() => {
        const inst = institutions.find(i => i.id === pubInstId);
        if (!inst) return null;
        return (
          <div className="mo open" onClick={e => { if (e.target === e.currentTarget) setPubOpen(false); }}>
            <div className="mo-box" style={{maxHeight:'80vh',overflowY:'auto'}}>
              <div className="mo-handle"/>
              <div className="mo-title">📢 Publish to Member Directory</div>
              <div style={{fontSize:'.78rem',color:'var(--muted)',marginBottom:14}}>
                Members can now find <strong style={{color:'var(--text)'}}>{inst.name}</strong> using code{' '}
                <strong style={{letterSpacing:2,color:'var(--accent)'}}>{inst.inviteCode}</strong>
              </div>

              <div className="fld">
                <label>Address / Location <span style={{color:'var(--muted)',fontWeight:400}}>(optional)</span></label>
                <input value={pubAddress} onChange={e=>setPubAddress(e.target.value)}
                  placeholder="e.g. 12 Main St, Mumbai" style={inpStyle}/>
              </div>

              <div style={{fontWeight:700,fontSize:'.78rem',marginBottom:8,marginTop:4}}>
                FEE PLANS <span style={{fontWeight:400,color:'var(--muted)'}}>(members choose one when joining)</span>
              </div>
              {pubPlans.map((p, i) => (
                <div key={i} style={{display:'flex',gap:7,marginBottom:8,alignItems:'center'}}>
                  <input value={p.name} onChange={e=>{ const pl=[...pubPlans]; pl[i]={...pl[i],name:e.target.value}; setPubPlans(pl); }}
                    placeholder="Plan name" style={{...inpStyle,flex:2}}/>
                  <input type="number" value={p.fee || ''} onChange={e=>{ const pl=[...pubPlans]; pl[i]={...pl[i],fee:Number(e.target.value)}; setPubPlans(pl); }}
                    placeholder="₹ Fee" style={{...inpStyle,flex:1,textAlign:'right'}}/>
                  <select value={p.freq} onChange={e=>{ const pl=[...pubPlans]; pl[i]={...pl[i],freq:e.target.value}; setPubPlans(pl); }}
                    style={{...inpStyle,flex:1,padding:'10px 7px'}}>
                    {['monthly','quarterly','half-yearly','yearly','one-time'].map(f=>(
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  {pubPlans.length > 1 && (
                    <button onClick={()=>setPubPlans(pubPlans.filter((_,j)=>j!==i))}
                      style={{background:'none',border:'none',color:'var(--red)',fontSize:'1.1rem',cursor:'pointer',padding:'0 4px'}}>✕</button>
                  )}
                </div>
              ))}
              <button className="btn g" style={{marginBottom:14,fontSize:'.75rem'}}
                onClick={()=>setPubPlans([...pubPlans,{name:'',fee:0,freq:'monthly'}])}>
                + Add Plan
              </button>

              <div className="btn-row">
                <button className="btn g" onClick={()=>setPubOpen(false)}>Cancel</button>
                <button className="btn p" onClick={handlePublish}>Publish →</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add Institution Modal */}
      {addInstOpen && (
        <div className="mo open" onClick={e => { if (e.target === e.currentTarget) setAddInstOpen(false); }}>
          <div className="mo-box">
            <div className="mo-handle"/>
            <div className="mo-title">Add Institution</div>
            <div className="fld">
              <label>Type</label>
              <select value={newInstType} onChange={e=>setNewInstType(e.target.value)} style={inpStyle}>
                {Object.entries(TYPES).map(([k,v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>
            <div className="fld">
              <label>Name</label>
              <input value={newInstName} onChange={e=>setNewInstName(e.target.value)} placeholder="Institution name" style={inpStyle}/>
            </div>
            <div className="btn-row">
              <button className="btn g" onClick={() => setAddInstOpen(false)}>Cancel</button>
              <button className="btn p" onClick={handleAddInst}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrOpen && (
        <div className="mo open" onClick={e => { if (e.target === e.currentTarget) setQrOpen(false); }}>
          <div className="mo-box">
            <div className="mo-handle"/>
            <div className="mo-title">{qrEditId ? 'Edit' : 'Add'} Payment QR</div>
            <div className="fld"><label>Display Name</label>
              <input value={qrName} onChange={e=>{ setQrName(e.target.value); generateQRPreview(qrUpi, e.target.value); }} placeholder="e.g. PhonePe — Admin" style={inpStyle}/>
            </div>
            <div className="fld"><label>UPI ID / VPA</label>
              <input value={qrUpi} onChange={e=>{ setQrUpi(e.target.value); generateQRPreview(e.target.value, qrName); }} placeholder="e.g. 9876543210@ybl" style={inpStyle}/>
            </div>
            <div className="fld"><label>Payment App</label>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:6}}>
                {(['PhonePe','Google Pay','Paytm','UPI'] as PayQR['app'][]).map(app => (
                  <label key={app} style={{display:'flex',alignItems:'center',gap:5,fontSize:'.82rem',cursor:'pointer',padding:'6px 12px',borderRadius:8,border:`1.5px solid ${qrApp===app?'var(--accent)':'var(--border)'}`,background:'var(--s2)'}}>
                    <input type="radio" name="qrApp" value={app} checked={qrApp===app} onChange={()=>setQrApp(app)} style={{accentColor:'var(--accent)'}}/>
                    {app}
                  </label>
                ))}
              </div>
            </div>
            {qrPreview && (
              <div style={{textAlign:'center',margin:'14px 0'}}>
                <div style={{fontSize:'.72rem',color:'var(--muted)',marginBottom:8}}>QR PREVIEW</div>
                <img src={qrPreview} style={{width:128,height:128,borderRadius:8,border:'1px solid var(--border)'}} alt="QR"/>
                <div style={{fontSize:'.72rem',color:'var(--muted)',marginTop:4}}>{qrUpi}</div>
              </div>
            )}
            <div className="btn-row">
              <button className="btn g" onClick={() => setQrOpen(false)}>Cancel</button>
              <button className="btn p" onClick={saveQR}>Save QR</button>
            </div>
          </div>
        </div>
      )}

      {/* Sessions Modal */}
      {sessionsOpen && (
        <div className="mo open" onClick={e => { if (e.target === e.currentTarget) setSessionsOpen(false); }}>
          <div className="mo-box" style={{maxHeight:'75vh',overflowY:'auto'}}>
            <div className="mo-handle"/>
            <div className="mo-title">Active Devices</div>
            {sessions.length === 0 && <div style={{color:'var(--muted)',textAlign:'center',padding:16,fontSize:'.82rem'}}>Loading…</div>}
            {sessions.map(s => (
              <div key={s.id} style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                <div>
                  <div style={{fontSize:'.85rem',fontWeight:600}}>
                    {s.deviceLabel}
                    {s.isCurrent && <span style={{marginLeft:6,fontSize:'.65rem',background:'rgba(79,142,255,.15)',color:'var(--accent)',padding:'2px 7px',borderRadius:99,fontWeight:700}}>This device</span>}
                  </div>
                  <div style={{fontSize:'.72rem',color:'var(--muted)',marginTop:3}}>
                    {new Date(s.lastSeen).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                  </div>
                  {s.ip && <div style={{fontSize:'.7rem',color:'var(--muted)',marginTop:1}}>{s.ip}</div>}
                </div>
                {!s.isCurrent && (
                  <button onClick={() => revokeSession(s.id)}
                    style={{background:'none',border:'1px solid rgba(255,92,92,.3)',borderRadius:6,color:'var(--red)',padding:'4px 9px',fontSize:'.72rem',cursor:'pointer',fontFamily:'Outfit,sans-serif',flexShrink:0}}>
                    Logout
                  </button>
                )}
              </div>
            ))}
            <button className="btn g" style={{color:'var(--red)',borderColor:'rgba(255,92,92,.2)',marginBottom:8}} onClick={revokeOthers}>
              Logout All Other Devices
            </button>
            <button className="btn g" onClick={() => setSessionsOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
