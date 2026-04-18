import { useState, useRef, useCallback } from 'react';
import { useAppStore } from '@/core/store/useAppStore';
import { useAuthStore } from '@/core/store/useAuthStore';
import { useUIStore } from '@/core/store/useUIStore';
import { api } from '@/core/services/api';
import { normalizePhone, validatePhone } from '@/utils/phoneNormalizer';
import PinInput from '@/modules/shared/PinInput';
import ShareBanner from '@/modules/member/ShareBanner';

interface Props {
  accentColor?: string;
}

/** Compress image to ≤150px and return base64 data-url */
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
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function ProfilePage({ accentColor = 'var(--accent)' }: Props) {
  const user = useAppStore(s => s.user);
const updateSettings = useAppStore(s => s.updateSettings);
  const { logout } = useAuthStore();
  const { toast } = useUIStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [name,     setName]     = useState(user?.name ?? '');
  const [phone,    setPhone]    = useState(user?.phone ?? '');
  const [address,  setAddress]  = useState(user?.address ?? '');
  const [bio,      setBio]      = useState(user?.bio ?? '');
  const [photo,    setPhoto]    = useState(user?.photo ?? '');

  // PIN change
  const [pinOpen,  setPinOpen]  = useState(false);
  const [curPin,   setCurPin]   = useState('');
  const [newPin,   setNewPin]   = useState('');
  const [cfmPin,   setCfmPin]   = useState('');
  const [pinSaving, setPinSaving] = useState(false);

  const startEdit = () => {
    setName(user?.name ?? '');
    setPhone(user?.phone ?? '');
    setAddress(user?.address ?? '');
    setBio(user?.bio ?? '');
    setPhoto(user?.photo ?? '');
    setEditing(true);
  };

  async function pickPhoto() {
    fileRef.current?.click();
  }
  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
    } catch {
      toast('Could not process image', 'warn');
    }
    e.target.value = '';
  }, [toast]);

  async function saveProfile() {
    if (!name.trim()) { toast('Name is required', 'warn'); return; }
    setSaving(true);

    const norm = normalizePhone(phone);
    if (phone && !validatePhone(norm, user?.defaultCountry ?? 'IN')) {
      toast('Invalid phone number', 'warn'); setSaving(false); return;
    }

    const data = await api<{ user: typeof user }>('PUT', '/users/me', {
      name: name.trim(),
      phone: phone ? norm : null,
      address: address.trim() || null,
      bio: bio.trim() || null,
      photo: photo || null,
    });
    setSaving(false);
    if (!data) { toast('Save failed — check connection', 'err'); return; }
    // Update local store
    useAppStore.getState().setUser({ ...user!, ...data.user } as NonNullable<typeof user>);
    toast('Profile saved ✓', 'ok');
    setEditing(false);
  }

  async function savePin() {
    if (newPin !== cfmPin) { toast('PINs do not match', 'warn'); return; }
    if (newPin.length !== 4) { toast('Enter 4-digit PIN', 'warn'); return; }
    setPinSaving(true);
    const data = await api('PUT', '/users/me', {
      current_pin: curPin || undefined,
      new_pin: newPin,
    });
    setPinSaving(false);
    if (!data) { toast('PIN update failed', 'err'); return; }
    toast('PIN updated ✓', 'ok');
    setPinOpen(false); setCurPin(''); setNewPin(''); setCfmPin('');
  }

  const inp: React.CSSProperties = {
    width: '100%', background: 'var(--s2)', border: '1.5px solid var(--border)',
    borderRadius: 'var(--r2)', padding: '10px 13px', color: 'var(--text)',
    fontFamily: 'Outfit,sans-serif', fontSize: '.88rem', outline: 'none',
  };

  return (
    <div style={{ padding: '16px 16px 0' }}>

      {/* Photo + name card */}
      <div className="card" style={{ marginBottom: 12, padding: '20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: editing ? 20 : 0 }}>
          {/* Avatar */}
          <div
            onClick={editing ? pickPhoto : undefined}
            style={{
              width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
              background: photo ? 'transparent' : `${accentColor}22`,
              border: `2px solid ${accentColor}44`,
              overflow: 'hidden', cursor: editing ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.8rem', position: 'relative',
            }}
          >
            {photo
              ? <img src={photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="profile"/>
              : <span>{user?.name?.[0]?.toUpperCase() ?? '?'}</span>
            }
            {editing && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '.9rem',
              }}>📷</div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange}/>

          {/* Name + role */}
          <div style={{ flex: 1 }}>
            {editing ? (
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Your name" style={{ ...inp, fontSize: '1rem', fontWeight: 700 }}/>
            ) : (
              <>
                <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{user?.name ?? '—'}</div>
                <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 3 }}>
                  {user?.primaryRole === 'admin' ? '🏛 Admin' : '👤 Member'}
                  {user?.email && <> · {user.email}</>}
                </div>
                {user?.bio && (
                  <div style={{ fontSize: '.78rem', color: 'var(--muted2)', marginTop: 4 }}>{user.bio}</div>
                )}
              </>
            )}
          </div>

          {!editing && (
            <button onClick={startEdit} style={{
              background: `${accentColor}18`, border: `1px solid ${accentColor}44`,
              borderRadius: 8, color: accentColor, padding: '6px 12px',
              fontSize: '.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif',
            }}>
              Edit
            </button>
          )}
        </div>

        {editing && (
          <>
            <div className="fld">
              <label>Mobile Number</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="10-digit number" type="tel" style={inp}/>
            </div>
            <div className="fld">
              <label>Address</label>
              <input value={address} onChange={e => setAddress(e.target.value)}
                placeholder="Your address (optional)" style={inp}/>
            </div>
            <div className="fld">
              <label>Bio <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(max 200 chars)</span></label>
              <textarea value={bio} onChange={e => setBio(e.target.value.slice(0, 200))}
                placeholder="Short bio about yourself…" rows={2}
                style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }}/>
              <div style={{ fontSize: '.68rem', color: 'var(--muted)', textAlign: 'right', marginTop: 4 }}>
                {bio.length}/200
              </div>
            </div>
            <div className="btn-row" style={{ marginTop: 8 }}>
              <button className="btn g" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn p" onClick={saveProfile} disabled={saving}
                style={{ background: accentColor }}>
                {saving ? 'Saving…' : 'Save Profile'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Phone & security info when not editing */}
      {!editing && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-hdr">Contact & Security</div>
          <div className="tgl-row">
            <label>Phone</label>
            <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{user?.phone ?? '—'}</span>
          </div>
          <div className="tgl-row">
            <label>Address</label>
            <span style={{ fontSize: '.82rem', color: 'var(--muted)', maxWidth: 180, textAlign: 'right' }}>
              {user?.address ?? '—'}
            </span>
          </div>
          <div className="tgl-row" style={{ border: 'none' }}>
            <label>PIN</label>
            <button onClick={() => setPinOpen(true)} style={{
              background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7,
              color: accentColor, padding: '5px 12px', fontSize: '.75rem',
              fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif',
            }}>
              {user?.has_pin ? 'Change PIN' : 'Set PIN'}
            </button>
          </div>
        </div>
      )}

      {/* Logout */}
      {!editing && (
        <button className="btn g"
          style={{ color: 'var(--red)', borderColor: 'rgba(255,92,92,.2)', marginBottom: 24, width: '100%' }}
          onClick={() => { if (confirm('Log out?')) logout() ; }}>
          Log Out
        </button>
      )}

      {/* PIN modal */}
      {/* Compact share banner */}
      <ShareBanner compact/>

      {pinOpen && (
        <div className="mo open" onClick={e => { if (e.target === e.currentTarget) setPinOpen(false); }}>
          <div className="mo-box">
            <div className="mo-handle"/>
            <div className="mo-title">{user?.has_pin ? 'Change PIN' : 'Set PIN'}</div>
            {user?.has_pin && (
              <div className="fld">
                <label>Current PIN</label>
                <PinInput value={curPin} onChange={setCurPin} disabled={pinSaving}/>
              </div>
            )}
            <div className="fld">
              <label>New PIN</label>
              <PinInput value={newPin} onChange={setNewPin} disabled={pinSaving}/>
            </div>
            <div className="fld">
              <label>Confirm New PIN</label>
              <PinInput value={cfmPin} onChange={setCfmPin} disabled={pinSaving}/>
            </div>
            <div className="btn-row">
              <button className="btn g" onClick={() => setPinOpen(false)}>Cancel</button>
              <button className="btn p" onClick={savePin} disabled={pinSaving}>
                {pinSaving ? 'Saving…' : 'Save PIN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
