import { useState, useRef, useCallback } from 'react';
import { useAppStore } from '@/core/store/useAppStore';
import { useAuthStore } from '@/core/store/useAuthStore';
import { useUIStore } from '@/core/store/useUIStore';
import { api, APP_VERSION, API_BASE, checkVersion } from '@/core/services/api';
import { th, TYPES } from '@/data/institutionTypes';
import { COUNTRIES } from '@/data/countries';
import { normalizePhone, validatePhone } from '@/utils/phoneNormalizer';
import { todayISO } from '@/utils/dateHelpers';
import PinInput from '@/modules/shared/PinInput';
import type { PayQR } from '@/core/types';
import QRCodeLib from 'qrcode';

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 150;
      let { width, height } = img;
      if (width > height) { if (width > MAX) { height = height * MAX / width; width = MAX; } }
      else                { if (height > MAX) { width = width * MAX / height; height = MAX; } }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function AdminProfile() {
  const {
    user, institutions, activeInstId, defaultCountry,
    addInstitution, updateInstitution, deleteInstitution,
    setActiveInst, settings, updateSettings,
  } = useAppStore();
  const { logout } = useAuthStore();
  const { toast } = useUIStore();

  const inp: React.CSSProperties = {
    width: '100%', background: 'var(--s2)', border: '1.5px solid var(--border)',
    borderRadius: 'var(--r2)', padding: '10px 13px', color: 'var(--text)',
    fontFamily: 'Outfit,sans-serif', fontSize: '.88rem', outline: 'none',
  };

  // ── User profile ──────────────────────────────────────
  const [editUser,  setEditUser]  = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [uName,    setUName]    = useState(user?.name ?? '');
  const [uPhone,   setUPhone]   = useState(user?.phone ?? '');
  const [uAddress, setUAddress] = useState(user?.address ?? '');
  const [uBio,     setUBio]     = useState(user?.bio ?? '');
  const [uPhoto,   setUPhoto]   = useState(user?.photo ?? '');
  const userFileRef = useRef<HTMLInputElement>(null);

  const [pinOpen,   setPinOpen]   = useState(false);
  const [curPin,    setCurPin]    = useState('');
  const [newPin,    setNewPin]    = useState('');
  const [cfmPin,    setCfmPin]    = useState('');
  const [pinSaving, setPinSaving] = useState(false);

  function startEditUser() {
    setUName(user?.name ?? ''); setUPhone(user?.phone ?? '');
    setUAddress(user?.address ?? ''); setUBio(user?.bio ?? '');
    setUPhoto(user?.photo ?? ''); setEditUser(true);
  }

  const onUserPhoto = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { setUPhoto(await compressImage(f)); } catch { toast('Image error', 'warn'); }
    e.target.value = '';
  }, [toast]);

  async function saveUser() {
    if (!uName.trim()) { toast('Name required', 'warn'); return; }
    setSavingUser(true);
    const norm = normalizePhone(uPhone);
    if (uPhone && !validatePhone(norm, defaultCountry)) { toast('Invalid phone', 'warn'); setSavingUser(false); return; }
    const data = await api<{ user: typeof user }>('PUT', '/users/me', {
      name: uName.trim(), phone: uPhone ? norm : null,
      address: uAddress.trim() || null, bio: uBio.trim() || null, photo: uPhoto || null,
    });
    setSavingUser(false);
    if (!data) { toast('Save failed', 'err'); return; }
    useAppStore.getState().setUser({ ...user!, ...data.user } as NonNullable<typeof user>);
    toast('Profile saved ✓', 'ok'); setEditUser(false);
  }

  async function savePin() {
    if (newPin !== cfmPin) { toast('PINs do not match', 'warn'); return; }
    if (newPin.length !== 4) { toast('Enter 4-digit PIN', 'warn'); return; }
    setPinSaving(true);
    const ok = await api('PUT', '/users/me', { current_pin: curPin || undefined, new_pin: newPin });
    setPinSaving(false);
    if (!ok) { toast('PIN update failed', 'err'); return; }
    toast('PIN updated ✓', 'ok'); setPinOpen(false);
    setCurPin(''); setNewPin(''); setCfmPin('');
  }

  // ── Institution profile ───────────────────────────────
  const [instEditId, setInstEditId] = useState('');
  const [iName,  setIName]  = useState('');
  const [iDesc,  setIDesc]  = useState('');
  const [iAddr,  setIAddr]  = useState('');
  const [iAchievements, setIAchievements] = useState('');
  const [iLogo,  setILogo]  = useState('');
  const [iSaving, setISaving] = useState(false);
  const instFileRef = useRef<HTMLInputElement>(null);

  function openInstEdit(id: string) {
    const inst = institutions.find(i => i.id === id);
    if (!inst) return;
    setInstEditId(id);
    setIName(inst.name); setIDesc(''); setIAddr(''); setIAchievements(''); setILogo(inst.logo ?? '');
  }

  const onInstPhoto = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { setILogo(await compressImage(f)); } catch { toast('Image error', 'warn'); }
    e.target.value = '';
  }, [toast]);

  async function saveInstProfile() {
    const inst = institutions.find(i => i.id === instEditId);
    if (!inst) return;
    setISaving(true);
    const data = await api('PUT', `/institutions/${inst.inviteCode}`, {
      name: iName.trim(),
      address: iAddr.trim(),
      description: iDesc.trim(),
      logo: iLogo || null,
      achievements: iAchievements.split(',').map(s => s.trim()).filter(Boolean),
    });
    setISaving(false);
    if (!data) { toast('Update failed — publish the institution first', 'err'); return; }
    updateInstitution(instEditId, { name: iName.trim(), logo: iLogo || undefined });
    toast('Institution profile updated ✓', 'ok');
    setInstEditId('');
  }

  // ── Add institution ───────────────────────────────────
  const [addOpen,   setAddOpen]   = useState(false);
  const [newName,   setNewName]   = useState('');
  const [newType,   setNewType]   = useState('school');

  function addInst() {
    if (!newName.trim()) { toast('Enter institution name', 'warn'); return; }
    const t = th(newType);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    addInstitution({
      id, name: newName.trim(), type: newType, inviteCode: code,
      country: defaultCountry,
      currency: COUNTRIES.find(c => c.code === defaultCountry)?.currency ?? 'INR',
      accentColor: t.color, template: {}, payQRs: [], createdAt: todayISO(),
    });
    setActiveInst(id); setAddOpen(false); setNewName('');
    toast('Institution added', 'ok');
  }

  // ── QR codes ──────────────────────────────────────────
  const [qrInstId, setQrInstId] = useState('');
  const [qrOpen,   setQrOpen]   = useState(false);
  const [qrEditId, setQrEditId] = useState('');
  const [qrName,   setQrName]   = useState('');
  const [qrUpi,    setQrUpi]    = useState('');
  const [qrApp,    setQrApp]    = useState<PayQR['app']>('PhonePe');
  const [qrPrev,   setQrPrev]   = useState('');

  async function genQR(upi: string, name: string) {
    if (!upi) { setQrPrev(''); return; }
    try {
      setQrPrev(await QRCodeLib.toDataURL(`upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(name)}&cu=INR`, { width: 160, margin: 1 }));
    } catch { setQrPrev(''); }
  }

  function openQR(instId: string, q?: PayQR) {
    setQrInstId(instId); setQrEditId(q?.id ?? ''); setQrName(q?.name ?? '');
    setQrUpi(q?.upi ?? ''); setQrApp(q?.app ?? 'PhonePe'); setQrPrev('');
    if (q?.upi) genQR(q.upi, q.name);
    setQrOpen(true);
  }

  function saveQR() {
    if (!qrName.trim() || !qrUpi.trim()) { toast('Enter name and UPI ID', 'warn'); return; }
    if (!qrUpi.includes('@')) { toast('UPI ID must contain @', 'warn'); return; }
    const inst = institutions.find(i => i.id === qrInstId); if (!inst) return;
    const qrs = [...(inst.payQRs ?? [])];
    if (qrEditId) {
      const idx = qrs.findIndex(q => q.id === qrEditId);
      if (idx > -1) qrs[idx] = { id: qrEditId, name: qrName.trim(), upi: qrUpi.trim(), app: qrApp };
    } else {
      qrs.push({ id: 'qr' + Date.now(), name: qrName.trim(), upi: qrUpi.trim(), app: qrApp });
    }
    updateInstitution(qrInstId, { payQRs: qrs });
    toast('QR saved', 'ok'); setQrOpen(false);
  }

  // ── Sessions ──────────────────────────────────────────
  const [sessions,  setSessions]  = useState<{ id:string; deviceLabel:string; ip:string; lastSeen:string; isCurrent:boolean }[]>([]);
  const [sessOpen,  setSessOpen]  = useState(false);

  async function openSessions() {
    setSessOpen(true);
    const d = await api<{ sessions: typeof sessions }>('GET', '/auth/sessions');
    if (d?.sessions) setSessions(d.sessions);
  }

  // ── OTA ───────────────────────────────────────────────
  const [updStatus,   setUpdStatus]   = useState('');
  const [updChecking, setUpdChecking] = useState(false);

  async function checkUpd() {
    setUpdChecking(true); setUpdStatus('Checking…');
    const d = await checkVersion();
    setUpdChecking(false);
    if (!d) { setUpdStatus('Could not check'); return; }
    const [a,b,c] = d.version.split('.').map(Number);
    const [x,y,z] = APP_VERSION.split('.').map(Number);
    setUpdStatus((a>x||b>y||c>z)
      ? `v${d.version} available${d.changelog?' — '+d.changelog:''}`
      : `You're on the latest (v${APP_VERSION})`);
  }

  // ── Publish ───────────────────────────────────────────
  const [pubOpen,    setPubOpen]    = useState(false);
  const [pubInstId2, setPubInstId2] = useState('');
  const [pubAddr,    setPubAddr]    = useState('');
  const [pubPlans,   setPubPlans]   = useState<{name:string;fee:number;freq:string}[]>([{name:'Standard',fee:0,freq:'monthly'}]);
  const [publishing, setPublishing] = useState(false);

  function openPub(id: string) {
    const inst = institutions.find(i => i.id === id); if (!inst) return;
    setPubInstId2(id); setPubAddr('');
    setPubPlans(th(inst.type).plans.map((p, i) => ({ name: p, fee: th(inst.type).fees[i] ?? 0, freq: 'monthly' })));
    setPubOpen(true);
  }

  async function doPublish() {
    const inst = institutions.find(i => i.id === pubInstId2); if (!inst) return;
    setPublishing(true);
    const ok = await api('POST', '/institutions/publish', {
      inviteCode: inst.inviteCode, name: inst.name, type: inst.type,
      address: pubAddr.trim(), plans: pubPlans.filter(p => p.name.trim()),
    });
    setPublishing(false);
    if (!ok) { toast('Publish failed', 'err'); return; }
    toast(`"${inst.name}" published ✓`, 'ok'); setPubOpen(false);
  }

  return (
    <div style={{ padding: '16px 16px 0' }}>

      {/* ── User Profile ─────────────────────────────── */}
      <div className="card" style={{ marginBottom: 12, padding: '18px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: editUser ? 16 : 0 }}>
          <input ref={userFileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={onUserPhoto}/>
          <div onClick={editUser ? () => userFileRef.current?.click() : undefined}
            style={{
              width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
              background: uPhoto ? 'transparent' : 'rgba(79,142,255,.15)',
              border: '2px solid rgba(79,142,255,.3)', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.6rem', cursor: editUser ? 'pointer' : 'default', position: 'relative',
            }}>
            {(editUser ? uPhoto : user?.photo)
              ? <img src={editUser ? uPhoto : user?.photo!} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/>
              : <span>{user?.name?.[0]?.toUpperCase()}</span>}
            {editUser && <div style={{ position:'absolute',inset:0,background:'rgba(0,0,0,.35)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.9rem' }}>📷</div>}
          </div>

          <div style={{ flex: 1 }}>
            {editUser ? (
              <input value={uName} onChange={e => setUName(e.target.value)} placeholder="Name" style={{ ...inp, fontWeight: 700 }}/>
            ) : (
              <>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>{user?.name}</div>
                <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 2 }}>
                  🏛 Admin{user?.email && ` · ${user.email}`}
                </div>
                {user?.bio && <div style={{ fontSize: '.78rem', color: 'var(--muted2)', marginTop: 4 }}>{user.bio}</div>}
              </>
            )}
          </div>

          {!editUser && (
            <button onClick={startEditUser} style={{
              background:'rgba(79,142,255,.1)', border:'1px solid rgba(79,142,255,.25)',
              borderRadius:8, color:'var(--accent)', padding:'6px 12px',
              fontSize:'.72rem', fontWeight:700, cursor:'pointer', fontFamily:'Outfit,sans-serif',
            }}>Edit</button>
          )}
        </div>

        {editUser && (
          <>
            <div className="fld" style={{ marginTop: 10 }}>
              <label>Phone</label>
              <input value={uPhone} onChange={e => setUPhone(e.target.value)} placeholder="Mobile number" type="tel" style={inp}/>
            </div>
            <div className="fld">
              <label>Address</label>
              <input value={uAddress} onChange={e => setUAddress(e.target.value)} placeholder="Your address" style={inp}/>
            </div>
            <div className="fld">
              <label>Bio <span style={{ color:'var(--muted)', fontWeight:400 }}>(max 200 chars)</span></label>
              <textarea value={uBio} onChange={e => setUBio(e.target.value.slice(0,200))} rows={2}
                placeholder="Short bio…" style={{ ...inp, resize:'vertical', lineHeight:1.5 }}/>
              <div style={{ fontSize:'.68rem', color:'var(--muted)', textAlign:'right', marginTop:3 }}>{uBio.length}/200</div>
            </div>
            <div className="btn-row">
              <button className="btn g" onClick={() => setEditUser(false)}>Cancel</button>
              <button className="btn p" onClick={saveUser} disabled={savingUser}>{savingUser ? 'Saving…' : 'Save'}</button>
            </div>
          </>
        )}
      </div>

      {/* Contact info + PIN */}
      {!editUser && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-hdr">Security</div>
          <div className="tgl-row">
            <label>Phone</label>
            <span style={{ fontSize:'.82rem', color:'var(--muted)' }}>{user?.phone ?? '—'}</span>
          </div>
          <div className="tgl-row" style={{ border:'none' }}>
            <label>PIN</label>
            <button onClick={() => setPinOpen(true)} style={{
              background:'var(--s2)', border:'1px solid var(--border)', borderRadius:7,
              color:'var(--accent)', padding:'5px 12px', fontSize:'.75rem',
              fontWeight:700, cursor:'pointer', fontFamily:'Outfit,sans-serif',
            }}>{user?.has_pin ? 'Change PIN' : 'Set PIN'}</button>
          </div>
        </div>
      )}

      {/* ── Institutions ────────────────────────────── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-hdr">Institutions ({institutions.length})</div>
        {institutions.map(inst => (
          <div key={inst.id} style={{ borderBottom:'1px solid var(--border)', padding:'10px 0' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              {inst.logo
                ? <img src={inst.logo} style={{ width:36, height:36, borderRadius:9, objectFit:'cover' }} alt=""/>
                : <div style={{ width:36, height:36, borderRadius:9, background:`${th(inst.type).color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem' }}>{th(inst.type).icon}</div>
              }
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:'.88rem' }}>{inst.name}</div>
                <div style={{ fontSize:'.7rem', color:'var(--muted)' }}>
                  {th(inst.type).label}
                  <span style={{ marginLeft:8, letterSpacing:2, background:'var(--s2)', border:'1px solid var(--border)', borderRadius:5, padding:'1px 6px', fontSize:'.67rem' }}>{inst.inviteCode}</span>
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <button onClick={() => openInstEdit(inst.id)} style={{
                flex:1, background:'rgba(79,142,255,.1)', border:'1px solid rgba(79,142,255,.2)',
                borderRadius:7, color:'var(--accent)', padding:'6px 10px', fontSize:'.72rem',
                fontWeight:700, cursor:'pointer', fontFamily:'Outfit,sans-serif',
              }}>✏️ Edit Profile</button>
              <button onClick={() => openPub(inst.id)} style={{
                flex:1, background:'rgba(52,199,89,.08)', border:'1px solid rgba(52,199,89,.2)',
                borderRadius:7, color:'var(--green)', padding:'6px 10px', fontSize:'.72rem',
                fontWeight:700, cursor:'pointer', fontFamily:'Outfit,sans-serif',
              }}>📢 Publish</button>
              <button onClick={() => openQR(inst.id)} style={{
                background:'var(--s2)', border:'1px solid var(--border)', borderRadius:7,
                color:'var(--text)', padding:'6px 10px', fontSize:'.72rem',
                cursor:'pointer', fontFamily:'Outfit,sans-serif',
              }}>🔗 QR</button>
              <button onClick={() => { if(confirm('Delete institution and all data?')) { deleteInstitution(inst.id); toast('Deleted','ok'); }}} style={{
                background:'none', border:'1px solid rgba(255,92,92,.25)', borderRadius:7,
                color:'var(--red)', padding:'6px 8px', fontSize:'.72rem', cursor:'pointer', fontFamily:'Outfit,sans-serif',
              }}>🗑</button>
            </div>
            {/* QR list */}
            {(inst.payQRs ?? []).length > 0 && (
              <div style={{ marginTop:8 }}>
                {(inst.payQRs ?? []).map(qr => (
                  <div key={qr.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderTop:'1px solid var(--border)', fontSize:'.75rem' }}>
                    <span style={{ flex:1 }}>{qr.name} · {qr.upi}</span>
                    <button onClick={() => openQR(inst.id, qr)} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:'.72rem' }}>Edit</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <button className="btn g" style={{ margin:'10px 0 0' }} onClick={() => setAddOpen(true)}>+ Add Institution</button>
      </div>

      {/* ── App / Cloud ──────────────────────────────── */}
      {API_BASE && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-hdr">Cloud & Devices</div>
          <div className="tgl-row">
            <div>
              <div style={{ fontSize:'.85rem', fontWeight:600 }}>VPS Sync</div>
              <div style={{ fontSize:'.7rem', color:'var(--muted)', marginTop:2 }}>Sync login & profile · 1 year free</div>
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

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-hdr">App Info</div>
        <div className="tgl-row"><label>Version</label><span style={{ color:'var(--muted)', fontSize:'.82rem' }}>v{APP_VERSION}</span></div>
        <div className="tgl-row" style={{ border:'none' }}>
          <label>Updates</label>
          <button onClick={checkUpd} disabled={updChecking} style={{
            background:'var(--s2)', border:'1px solid var(--border)', borderRadius:7,
            color:'var(--accent)', fontSize:'.75rem', fontWeight:700, padding:'5px 12px',
            cursor:'pointer', fontFamily:'Outfit,sans-serif',
          }}>{updChecking ? 'Checking…' : 'Check'}</button>
        </div>
        {updStatus && <div style={{ fontSize:'.75rem', color:'var(--yellow)', padding:'4px 0 2px' }}>{updStatus}</div>}
      </div>

      <div className="pnote" style={{ padding:'10px 0' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width={14} height={14}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        No financial data stored on servers
      </div>

      <button className="btn g" style={{ color:'var(--red)', borderColor:'rgba(255,92,92,.2)', marginBottom:24, width:'100%' }}
        onClick={() => { if(confirm('Log out?')) logout(); }}>
        Log Out
      </button>

      {/* ── Modals ──────────────────────────────────── */}

      {/* Edit institution profile */}
      {instEditId && (() => {
        const inst = institutions.find(i => i.id === instEditId);
        if (!inst) return null;
        return (
          <div className="mo open" onClick={e => { if(e.target===e.currentTarget) setInstEditId(''); }}>
            <div className="mo-box" style={{ maxHeight:'85vh', overflowY:'auto' }}>
              <div className="mo-handle"/>
              <div className="mo-title">Edit Institution Profile</div>
              <input ref={instFileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={onInstPhoto}/>
              {/* Logo */}
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                <div onClick={() => instFileRef.current?.click()} style={{
                  width:56, height:56, borderRadius:13, background:`${th(inst.type).color}22`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'1.5rem', cursor:'pointer', overflow:'hidden', border:'2px dashed var(--border)', position:'relative',
                }}>
                  {iLogo ? <img src={iLogo} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/> : th(inst.type).icon}
                  <div style={{ position:'absolute',inset:0,background:'rgba(0,0,0,.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.75rem' }}>📷</div>
                </div>
                <div style={{ fontSize:'.78rem', color:'var(--muted)' }}>Tap to change logo</div>
              </div>
              <div className="fld">
                <label>Name</label>
                <input value={iName} onChange={e => setIName(e.target.value)} style={inp}/>
              </div>
              <div className="fld">
                <label>Address / Location</label>
                <input value={iAddr} onChange={e => setIAddr(e.target.value)} placeholder="Street, City" style={inp}/>
              </div>
              <div className="fld">
                <label>Description <span style={{ color:'var(--muted)', fontWeight:400 }}>(max 500 chars — shown to members)</span></label>
                <textarea value={iDesc} onChange={e => setIDesc(e.target.value.slice(0,500))} rows={3}
                  placeholder="Tell members about your institution…" style={{ ...inp, resize:'vertical', lineHeight:1.5 }}/>
                <div style={{ fontSize:'.68rem', color:'var(--muted)', textAlign:'right', marginTop:3 }}>{iDesc.length}/500</div>
              </div>
              <div className="fld">
                <label>Achievements <span style={{ color:'var(--muted)', fontWeight:400 }}>(comma separated)</span></label>
                <input value={iAchievements} onChange={e => setIAchievements(e.target.value)}
                  placeholder="Est. 2005, 500+ members, Award Winner" style={inp}/>
              </div>
              <div className="btn-row">
                <button className="btn g" onClick={() => setInstEditId('')}>Cancel</button>
                <button className="btn p" onClick={saveInstProfile} disabled={iSaving}>{iSaving ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add institution */}
      {addOpen && (
        <div className="mo open" onClick={e => { if(e.target===e.currentTarget) setAddOpen(false); }}>
          <div className="mo-box">
            <div className="mo-handle"/>
            <div className="mo-title">Add Institution</div>
            <div className="fld">
              <label>Type</label>
              <select value={newType} onChange={e => setNewType(e.target.value)} style={inp}>
                {Object.entries(TYPES).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div className="fld">
              <label>Name</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Institution name" style={inp}/>
            </div>
            <div className="btn-row">
              <button className="btn g" onClick={() => setAddOpen(false)}>Cancel</button>
              <button className="btn p" onClick={addInst}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Publish modal */}
      {pubOpen && (() => {
        const inst = institutions.find(i => i.id === pubInstId2); if (!inst) return null;
        return (
          <div className="mo open" onClick={e => { if(e.target===e.currentTarget) setPubOpen(false); }}>
            <div className="mo-box" style={{ maxHeight:'82vh', overflowY:'auto' }}>
              <div className="mo-handle"/>
              <div className="mo-title">📢 Publish to Member Directory</div>
              <div style={{ fontSize:'.78rem', color:'var(--muted)', marginBottom:12 }}>
                Members can find <strong style={{ color:'var(--text)' }}>{inst.name}</strong> using code{' '}
                <strong style={{ letterSpacing:2, color:'var(--accent)' }}>{inst.inviteCode}</strong>
              </div>
              <div className="fld">
                <label>Address</label>
                <input value={pubAddr} onChange={e => setPubAddr(e.target.value)} placeholder="Location" style={inp}/>
              </div>
              <div style={{ fontWeight:700, fontSize:'.78rem', marginBottom:8 }}>FEE PLANS</div>
              {pubPlans.map((p,i) => (
                <div key={i} style={{ display:'flex', gap:6, marginBottom:7, alignItems:'center' }}>
                  <input value={p.name} onChange={e => { const pl=[...pubPlans]; pl[i]={...pl[i],name:e.target.value}; setPubPlans(pl); }} placeholder="Plan name" style={{ ...inp, flex:2 }}/>
                  <input type="number" value={p.fee||''} onChange={e => { const pl=[...pubPlans]; pl[i]={...pl[i],fee:Number(e.target.value)}; setPubPlans(pl); }} placeholder="₹" style={{ ...inp, flex:1, textAlign:'right' }}/>
                  <select value={p.freq} onChange={e => { const pl=[...pubPlans]; pl[i]={...pl[i],freq:e.target.value}; setPubPlans(pl); }} style={{ ...inp, flex:1, padding:'9px 6px' }}>
                    {['monthly','quarterly','half-yearly','yearly','one-time'].map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  {pubPlans.length>1 && <button onClick={() => setPubPlans(pubPlans.filter((_,j) => j!==i))} style={{ background:'none', border:'none', color:'var(--red)', cursor:'pointer', fontSize:'1rem' }}>✕</button>}
                </div>
              ))}
              <button className="btn g" style={{ marginBottom:12, fontSize:'.75rem' }} onClick={() => setPubPlans([...pubPlans,{name:'',fee:0,freq:'monthly'}])}>+ Add Plan</button>
              <div className="btn-row">
                <button className="btn g" onClick={() => setPubOpen(false)}>Cancel</button>
                <button className="btn p" onClick={doPublish} disabled={publishing}>{publishing ? 'Publishing…' : 'Publish →'}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* QR modal */}
      {qrOpen && (
        <div className="mo open" onClick={e => { if(e.target===e.currentTarget) setQrOpen(false); }}>
          <div className="mo-box">
            <div className="mo-handle"/>
            <div className="mo-title">{qrEditId ? 'Edit' : 'Add'} Payment QR</div>
            <div className="fld"><label>Display Name</label>
              <input value={qrName} onChange={e => { setQrName(e.target.value); genQR(qrUpi, e.target.value); }} placeholder="e.g. PhonePe — Admin" style={inp}/>
            </div>
            <div className="fld"><label>UPI ID / VPA</label>
              <input value={qrUpi} onChange={e => { setQrUpi(e.target.value); genQR(e.target.value, qrName); }} placeholder="9876543210@ybl" style={inp}/>
            </div>
            <div className="fld"><label>App</label>
              <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginTop:5 }}>
                {(['PhonePe','Google Pay','Paytm','UPI'] as PayQR['app'][]).map(a => (
                  <label key={a} style={{ display:'flex', alignItems:'center', gap:4, fontSize:'.82rem', cursor:'pointer', padding:'5px 10px', borderRadius:7, border:`1.5px solid ${qrApp===a?'var(--accent)':'var(--border)'}`, background:'var(--s2)' }}>
                    <input type="radio" name="qrApp" checked={qrApp===a} onChange={() => setQrApp(a)} style={{ accentColor:'var(--accent)' }}/>{a}
                  </label>
                ))}
              </div>
            </div>
            {qrPrev && <div style={{ textAlign:'center', margin:'12px 0' }}><img src={qrPrev} style={{ width:120, height:120, borderRadius:8, border:'1px solid var(--border)' }} alt="QR"/></div>}
            <div className="btn-row">
              <button className="btn g" onClick={() => setQrOpen(false)}>Cancel</button>
              <button className="btn p" onClick={saveQR}>Save QR</button>
            </div>
          </div>
        </div>
      )}

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
                    {s.isCurrent && <span style={{ marginLeft:6, fontSize:'.65rem', background:'rgba(79,142,255,.15)', color:'var(--accent)', padding:'2px 7px', borderRadius:99, fontWeight:700 }}>This device</span>}
                  </div>
                  <div style={{ fontSize:'.72rem', color:'var(--muted)', marginTop:3 }}>
                    {new Date(s.lastSeen).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                  </div>
                  {s.ip && <div style={{ fontSize:'.7rem', color:'var(--muted)', marginTop:1 }}>{s.ip}</div>}
                </div>
                {!s.isCurrent && (
                  <button onClick={async () => { if(confirm('Logout this device?')) { await api('DELETE','/auth/sessions/'+s.id); openSessions(); toast('Logged out','ok'); }}} style={{ background:'none', border:'1px solid rgba(255,92,92,.3)', borderRadius:6, color:'var(--red)', padding:'4px 9px', fontSize:'.72rem', cursor:'pointer', fontFamily:'Outfit,sans-serif', flexShrink:0 }}>Logout</button>
                )}
              </div>
            ))}
            <button className="btn g" style={{ color:'var(--red)', borderColor:'rgba(255,92,92,.2)', marginBottom:6 }} onClick={async () => { if(confirm('Logout all other devices?')) { await api('DELETE','/auth/sessions/others'); openSessions(); toast('Done','ok'); }}}>Logout All Others</button>
            <button className="btn g" onClick={() => setSessOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {/* PIN modal */}
      {pinOpen && (
        <div className="mo open" onClick={e => { if(e.target===e.currentTarget) setPinOpen(false); }}>
          <div className="mo-box">
            <div className="mo-handle"/>
            <div className="mo-title">{user?.has_pin ? 'Change PIN' : 'Set PIN'}</div>
            {user?.has_pin && <div className="fld"><label>Current PIN</label><PinInput value={curPin} onChange={setCurPin} disabled={pinSaving}/></div>}
            <div className="fld"><label>New PIN</label><PinInput value={newPin} onChange={setNewPin} disabled={pinSaving}/></div>
            <div className="fld"><label>Confirm PIN</label><PinInput value={cfmPin} onChange={setCfmPin} disabled={pinSaving}/></div>
            <div className="btn-row">
              <button className="btn g" onClick={() => setPinOpen(false)}>Cancel</button>
              <button className="btn p" onClick={savePin} disabled={pinSaving}>{pinSaving ? 'Saving…' : 'Save PIN'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
