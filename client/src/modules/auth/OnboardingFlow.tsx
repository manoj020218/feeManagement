import { useState } from 'react';
import { useAuthStore } from '@/core/store/useAuthStore';
import { useAppStore } from '@/core/store/useAppStore';
import { useUIStore } from '@/core/store/useUIStore';
import PinInput from '@/modules/shared/PinInput';
import { TYPES, TYPE_CATS } from '@/data/institutionTypes';
import { normalizePhone, validatePhone } from '@/utils/phoneNormalizer';
import { todayISO } from '@/utils/dateHelpers';
import { COUNTRIES } from '@/data/countries';

type Step = 'welcome' | 'role' | 'login' | 'register' | 'setup-inst';

interface Props { onDone: () => void; }

export default function OnboardingFlow({ onDone }: Props) {
  const [step, setStep] = useState<Step>('welcome');
  const [chosenRole, setChosenRole] = useState<'admin' | 'member'>('admin');
  const [chosenCat, setChosenCat] = useState('education');
  const [chosenType, setChosenType] = useState('school');
  const [isLogin, setIsLogin] = useState(true);

  // Form state
  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [pin, setPin]           = useState('');
  const [confirmPin, setConfirm] = useState('');
  const [instName, setInstName] = useState('');
  const [country, setCountry]   = useState('IN');

  const { loginWithPin, registerWithPin, error, loading, setError } = useAuthStore();
  const { addInstitution, setActiveInst, setActiveRole, updateSettings } = useAppStore();
  const { toast } = useUIStore();

  async function handleAuth() {
    setError(null);
    const norm = normalizePhone(phone);
    if (!validatePhone(norm, country)) { toast('Invalid phone number', 'warn'); return; }
    if (pin.length < 4) { toast('Enter 4-digit PIN', 'warn'); return; }

    if (isLogin) {
      const ok = await loginWithPin(norm, pin);
      if (ok) {
        updateSettings({ vpsSyncStartDate: new Date().toISOString() });
        // Role comes from stored user — read after login
        const loggedUser = useAppStore.getState().user;
        const role = loggedUser?.primaryRole ?? chosenRole;
        if (role === 'admin' || role === 'both') {
          setActiveRole('admin');
          onDone();
        } else {
          setActiveRole('member');
          onDone();
        }
      }
    } else {
      if (pin !== confirmPin) { toast('PINs do not match', 'warn'); return; }
      if (!name.trim()) { toast('Enter your name', 'warn'); return; }
      const ok = await registerWithPin(name.trim(), norm, pin, chosenRole, country);
      if (ok) {
        updateSettings({ vpsSyncStartDate: new Date().toISOString() });
        if (chosenRole === 'admin') {
          setActiveRole('admin');
          setStep('setup-inst');
        } else {
          setActiveRole('member');
          onDone();
        }
      }
    }
  }

  function handleCreateInst() {
    if (!instName.trim()) { toast('Enter institution name', 'warn'); return; }
    const t = TYPES[chosenType];
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    addInstitution({
      id, name: instName.trim(), type: chosenType, inviteCode: code,
      country, currency: COUNTRIES.find(c => c.code === country)?.currency ?? 'INR',
      accentColor: t.color, template: {}, payQRs: [], createdAt: todayISO(),
    });
    setActiveInst(id);
    setActiveRole('admin');
    onDone();
  }

  // ── Slides ─────────────────────────────────────────────
  if (step === 'welcome') return (
    <div className="ob show">
      <div className="wl-logo">FeeFlow</div>
      <div className="wl-sub">by Jenix</div>
      <div className="wl-card">
        <h2>Privacy-first<br/>Fee Management</h2>
        <p>Manage members, collect fees, send receipts — all data stays on your device.</p>
      </div>
      <div className="wl-features">
        {['Track fees & dues','PDF receipts & reports','Offline-first — no internet needed','Works for gyms, schools, societies & more'].map(f => (
          <div key={f} className="wl-feat"><div className="dot"/>{f}</div>
        ))}
      </div>
      <button className="btn p" style={{width:'100%',maxWidth:360}} onClick={() => setStep('role')}>
        Get Started →
      </button>
    </div>
  );

  if (step === 'role') return (
    <div className="ob show">
      <div className="title" style={{textAlign:'center',marginBottom:24}}>
        <h2 style={{fontSize:'1.4rem',fontWeight:800}}>I want to…</h2>
        <p style={{fontSize:'.8rem',color:'var(--muted2)',marginTop:6}}>You can switch roles anytime later</p>
      </div>
      {[
        { role:'admin' as const, icon:'🏛️', title:'Manage an Institution', desc:'Add members, collect fees, generate receipts' },
        { role:'member' as const, icon:'👤', title:'Join as a Member', desc:'View my fees, check due dates, see receipts' },
      ].map(r => (
        <div key={r.role}
          className={`wl-card${chosenRole===r.role?' sel':''}`}
          style={{cursor:'pointer',maxWidth:360,width:'100%',marginBottom:14,
            border:`2px solid ${chosenRole===r.role?'var(--accent)':'var(--border)'}`}}
          onClick={() => setChosenRole(r.role)}
        >
          <div style={{fontSize:'2rem',marginBottom:8}}>{r.icon}</div>
          <div style={{fontWeight:800,fontSize:'1rem',marginBottom:4}}>{r.title}</div>
          <div style={{fontSize:'.82rem',color:'var(--muted2)'}}>{r.desc}</div>
        </div>
      ))}
      <button className="btn p" style={{width:'100%',maxWidth:360,marginTop:8}}
        onClick={() => { setIsLogin(false); setStep('register'); }}>
        Continue →
      </button>
      <button className="btn g" style={{width:'100%',maxWidth:360,marginTop:8}}
        onClick={() => { setIsLogin(true); setStep('login'); }}>
        Already have an account? Log in
      </button>
    </div>
  );

  if (step === 'login' || step === 'register') return (
    <div className="ob show">
      <div className="title" style={{textAlign:'center',marginBottom:24}}>
        <h2 style={{fontSize:'1.4rem',fontWeight:800}}>{isLogin ? 'Welcome back' : 'Create account'}</h2>
      </div>
      <div style={{width:'100%',maxWidth:360}}>
        {!isLogin && (
          <div className="fld">
            <label>Your Name</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" className="fld-inp"/>
          </div>
        )}
        <div className="fld">
          <label>Mobile Number</label>
          <div style={{display:'flex',gap:8}}>
            <select value={country} onChange={e=>setCountry(e.target.value)}
              style={{background:'var(--s2)',border:'1.5px solid var(--border)',borderRadius:'var(--r2)',padding:'11px 10px',color:'var(--text)',fontFamily:'Outfit,sans-serif',outline:'none'}}>
              {COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.flag} {c.dial}</option>)}
            </select>
            <input value={phone}
              onChange={e=>setPhone(e.target.value)}
              onPaste={e=>{ const t=e.clipboardData.getData('text'); setPhone(normalizePhone(t)); e.preventDefault(); }}
              placeholder="10-digit number" className="fld-inp" type="tel" inputMode="numeric"/>
          </div>
        </div>
        <div className="fld">
          <label>{isLogin ? 'PIN' : 'Create 4-digit PIN'}</label>
          <PinInput value={pin} onChange={setPin} disabled={loading}/>
        </div>
        {!isLogin && (
          <div className="fld">
            <label>Confirm PIN</label>
            <PinInput value={confirmPin} onChange={setConfirm} disabled={loading}/>
          </div>
        )}
        {error && error !== 'ALREADY_REGISTERED' && (
          <div style={{color:'var(--red)',fontSize:'.8rem',marginBottom:12,textAlign:'center'}}>{error}</div>
        )}
        {error === 'ALREADY_REGISTERED' && (
          <div style={{
            background:'rgba(255,92,92,.08)',border:'1px solid rgba(255,92,92,.25)',
            borderRadius:10,padding:'12px 14px',marginBottom:12,textAlign:'center',
          }}>
            <div style={{color:'var(--red)',fontSize:'.82rem',fontWeight:700,marginBottom:8}}>
              This phone number is already registered.
            </div>
            <button className="btn p" style={{width:'100%',marginBottom:0}}
              onClick={() => { setError(null); setIsLogin(true); }}>
              Log In Instead →
            </button>
          </div>
        )}
        {error !== 'ALREADY_REGISTERED' && (
          <button className="btn p" style={{width:'100%',marginBottom:10}} onClick={handleAuth} disabled={loading}>
            {loading ? 'Please wait…' : isLogin ? 'Log In' : 'Create Account'}
          </button>
        )}
        <button className="btn g" style={{width:'100%'}} onClick={() => { setError(null); setStep('role'); }}>← Back</button>
      </div>
    </div>
  );

  if (step === 'setup-inst') return (
    <div className="ob show">
      <div className="title" style={{textAlign:'center',marginBottom:20}}>
        <h2 style={{fontSize:'1.3rem',fontWeight:800}}>Set up your institution</h2>
        <p style={{fontSize:'.8rem',color:'var(--muted2)',marginTop:5}}>You can add more later in Settings</p>
      </div>
      <div style={{width:'100%',maxWidth:440}}>
        {/* Category filter */}
        <div className="cat-bar" style={{marginBottom:12}}>
          {TYPE_CATS.map(c=>(
            <button key={c.id} className={`cat-btn${chosenCat===c.id?' on':''}`} onClick={()=>setChosenCat(c.id)}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
        {/* Type grid */}
        <div className="type-grid" style={{marginBottom:16}}>
          {TYPE_CATS.find(c=>c.id===chosenCat)?.types.map(t=>{
            const cfg = TYPES[t];
            return (
              <div key={t} className={`tc${chosenType===t?' sel':''}`} onClick={()=>setChosenType(t)}>
                <span className="tc-ico">{cfg.icon}</span>
                <div className="tc-name">{cfg.label}</div>
              </div>
            );
          })}
        </div>
        <div className="fld">
          <label>Institution Name</label>
          <input value={instName} onChange={e=>setInstName(e.target.value)}
            placeholder={`e.g. ${TYPES[chosenType]?.label ?? 'My Institution'}`} className="fld-inp"/>
        </div>
        <button className="btn p" style={{width:'100%'}} onClick={handleCreateInst}>
          Create & Launch →
        </button>
      </div>
    </div>
  );

  return null;
}
