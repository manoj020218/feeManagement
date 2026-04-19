import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '@/core/store/useAppStore';
import { useAuthStore } from '@/core/store/useAuthStore';
import { useUIStore } from '@/core/store/useUIStore';
import { api, APP_VERSION, API_BASE, checkVersion } from '@/core/services/api';
import { th, TYPES } from '@/data/institutionTypes';
import { COUNTRIES } from '@/data/countries';
import { normalizePhone, validatePhone } from '@/utils/phoneNormalizer';
import { todayISO } from '@/utils/dateHelpers';
import PinInput from '@/modules/shared/PinInput';
import MemberImportModal from '@/modules/admin/Members/MemberImportModal';
import { exportMembers, downloadTemplate } from '@/core/services/excelService';
import { exportInstBackup, parseInstBackup } from '@/core/services/jsonService';
import { performDriveBackup, listDriveBackups, downloadDriveFile, type DriveFile } from '@/core/services/driveService';
import type { PayQR, Institution } from '@/core/types';
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

// ------------------------------------------------------------------
// Dropdown menu component (three dots)
// ------------------------------------------------------------------
function DropdownMenu({ actions }: { actions: { label: string; icon: string; onClick: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'rgba(79, 142, 255, 0.12)',
          border: `1.5px solid var(--accent)`,
          borderRadius: '40px',
          width: '38px',
          height: '38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(79, 142, 255, 0.25)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(79, 142, 255, 0.12)')}
      >
        {open ? (
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent)', lineHeight: 1 }}>✕</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '5px', height: '5px', background: 'var(--accent)', borderRadius: '50%' }} />
            <div style={{ width: '5px', height: '5px', background: 'var(--accent)', borderRadius: '50%' }} />
            <div style={{ width: '5px', height: '5px', background: 'var(--accent)', borderRadius: '50%' }} />
          </div>
        )}
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', background: 'var(--s2)',
          border: '1px solid var(--border)', borderRadius: 10, zIndex: 10,
          minWidth: '180px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {actions.map((act, idx) => (
            <div key={idx}
              onClick={() => { act.onClick(); setOpen(false); }}
              style={{
                padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center',
                cursor: 'pointer', borderBottom: idx !== actions.length-1 ? '1px solid var(--border)' : 'none',
                color: act.danger ? 'var(--red)' : 'inherit',
              }}>
              <span>{act.icon}</span> {act.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Fee Rules inline panel (unchanged)
// ------------------------------------------------------------------
function FeeRulesPanel({ inst, onUpdate }: { inst: Institution; onUpdate: (patch: Partial<Institution>) => void }) {
  const s: React.CSSProperties = {
    marginTop: 12, padding: '12px 14px', borderRadius: 10,
    background: 'rgba(255,200,0,.06)', border: '1px solid rgba(255,200,0,.2)',
  };
  const row: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.06)',
  };
  const lbl: React.CSSProperties = { fontSize: '.82rem', fontWeight: 600 };
  const sub: React.CSSProperties = { fontSize: '.68rem', color: 'var(--muted)', marginTop: 2 };

  return (
    <div style={s}>
      <div style={{ fontSize: '.72rem', fontWeight: 800, color: 'var(--yellow)', marginBottom: 10, letterSpacing: .5, textTransform: 'uppercase' }}>
        Fee Rules
      </div>
      <div style={{ ...row }}>
        <div><div style={lbl}>Grace Period</div><div style={sub}>Days after due date before marking overdue</div></div>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <input type="number" min={0} max={60}
            value={inst.gracePeriod ?? 0}
            onChange={e => onUpdate({ gracePeriod: Math.max(0, parseInt(e.target.value) || 0) })}
            style={{ width:50, background:'var(--s2)', border:'1.5px solid var(--border)', borderRadius:8, padding:'5px 8px', color:'var(--text)', fontFamily:'Outfit,sans-serif', fontSize:'.88rem', outline:'none', textAlign:'center' }}/>
          <span style={{ fontSize:'.75rem', color:'var(--muted)' }}>days</span>
        </div>
      </div>
      <div style={{ ...row }}>
        <div><div style={lbl}>Track Advance & Arrears</div><div style={sub}>Carry forward overpayments and short payments</div></div>
        <label className="tgl-switch">
          <input type="checkbox" checked={inst.trackBalance !== false} onChange={e => onUpdate({ trackBalance: e.target.checked })}/>
          <span className="tgl-track"/>
        </label>
      </div>
      {inst.trackBalance !== false && (
        <div style={{ ...row }}>
          <div><div style={lbl}>Auto-advance Next Due</div><div style={sub}>Push due date forward when bulk payment covers extra cycle(s)</div></div>
          <label className="tgl-switch">
            <input type="checkbox" checked={inst.autoAdvanceDue !== false} onChange={e => onUpdate({ autoAdvanceDue: e.target.checked })}/>
            <span className="tgl-track"/>
          </label>
        </div>
      )}
      <div style={{ ...row, borderBottom: 'none' }}>
        <div><div style={lbl}>Require Approval for New Members</div><div style={sub}>Members must request to join; you approve or reject</div></div>
        <label className="tgl-switch">
          <input type="checkbox" checked={inst.requireApproval === true}
            onChange={e => { const val = e.target.checked; onUpdate({ requireApproval: val }); api('PUT', `/institutions/${inst.inviteCode}`, { requireApproval: val }); }}/>
          <span className="tgl-track"/>
        </label>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Data & Backup inline panel
// ------------------------------------------------------------------
interface DriveBackupStatus { email: string; at: string; }
const DRV_KEY = (id: string) => `ff_drive_bk_${id}`;

function DataBackupPanel({
  inst,
  onImportMembers,
}: {
  inst: Institution;
  onImportMembers: () => void;
}) {
  const members         = useAppStore(s => s.members[inst.id] ?? []);
  const transactions    = useAppStore(s => s.transactions[inst.id] ?? []);
  const institutions    = useAppStore(s => s.institutions);
  const importMembersStore  = useAppStore(s => s.importMembers);
  const addTransaction      = useAppStore(s => s.addTransaction);
  const addInstitutionStore = useAppStore(s => s.addInstitution);
  const { toast } = useUIStore();

  const [driveLoading,   setDriveLoading]   = useState(false);
  const [driveStatus,    setDriveStatus]    = useState<DriveBackupStatus | null>(() => {
    try { return JSON.parse(localStorage.getItem(DRV_KEY(inst.id)) ?? 'null'); } catch { return null; }
  });
  // Drive restore picker state
  const [pickerOpen,     setPickerOpen]     = useState(false);
  const [pickerLoading,  setPickerLoading]  = useState(false);
  const [pickerFiles,    setPickerFiles]    = useState<DriveFile[]>([]);
  const [pickerEmail,    setPickerEmail]    = useState('');
  const [pickerToken,    setPickerToken]    = useState('');
  const [restoringId,    setRestoringId]    = useState<string | null>(null);
  // Restore confirm modal
  type RestoreIntent =
    | { type: 'drive'; file: DriveFile }
    | { type: 'json';  parsed: any; srcName: string };
  const [restoreIntent,  setRestoreIntent]  = useState<RestoreIntent | null>(null);
  const [restoring,      setRestoring]      = useState(false);

  const jsonRestoreRef = useRef<HTMLInputElement>(null);
  const t = th(inst.type);

  // safety filename computed at the moment of showing the confirm modal
  const safetyFileName = `${inst.name.replace(/[^a-z0-9]/gi, '_')}_PRE_RESTORE_${new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-')}.json`;

  // ── shared: apply a parsed backup object (merge strategy) ──────────────
  function applyBackup(backup: any): string {
    const raw = backup as { institution?: any; members?: any[]; transactions?: any[] };
    if (!raw.institution || !Array.isArray(raw.members) || !Array.isArray(raw.transactions)) {
      throw new Error('Invalid backup format');
    }
    const existingInst = institutions.find(
      i => i.id === raw.institution.id || i.inviteCode === raw.institution.inviteCode,
    );
    if (!existingInst) {
      addInstitutionStore(raw.institution);
      if (raw.members.length) importMembersStore(raw.institution.id, raw.members);
      raw.transactions.forEach((tx: any) => addTransaction(tx));
      return `Restored "${raw.institution.name}" with ${raw.members.length} members`;
    }
    const existingMemberIds = new Set((useAppStore.getState().members[existingInst.id] ?? []).map(m => m.id));
    const existingTxIds     = new Set((useAppStore.getState().transactions[existingInst.id] ?? []).map(tx => tx.id));
    const newMembers = raw.members.filter((m: any) => !existingMemberIds.has(m.id)).map((m: any) => ({ ...m, instId: existingInst.id }));
    const newTxs     = raw.transactions.filter((tx: any) => !existingTxIds.has(tx.id)).map((tx: any) => ({ ...tx, instId: existingInst.id }));
    if (newMembers.length) importMembersStore(existingInst.id, newMembers);
    newTxs.forEach((tx: any) => addTransaction(tx));
    return `Merged: +${newMembers.length} members, +${newTxs.length} transactions`;
  }

  // ── backup to Drive ────────────────────────────────────────────────────
  async function handleDriveBackup() {
    setDriveLoading(true);
    try {
      const backup   = { version: 1, exportedAt: new Date().toISOString(), institution: inst, members, transactions };
      const fileName = `FeeFlow_${inst.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
      const result   = await performDriveBackup(backup, fileName);
      const status: DriveBackupStatus = { email: result.email, at: new Date().toISOString() };
      localStorage.setItem(DRV_KEY(inst.id), JSON.stringify(status));
      setDriveStatus(status);
      toast('Backup uploaded to Google Drive ✓', 'ok');
    } catch (err: any) {
      toast(err?.message ?? 'Drive backup failed', 'err');
    }
    setDriveLoading(false);
  }

  // ── auto-backup current data before any restore ────────────────────────
  function autoBackupCurrent() {
    if (!members.length && !transactions.length) return; // nothing to back up
    // Export with a "pre_restore" tag so the user can identify it
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      institution: inst,
      members,
      transactions,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${inst.name.replace(/[^a-z0-9]/gi, '_')}_PRE_RESTORE_${new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── open Drive restore picker ──────────────────────────────────────────
  async function openDrivePicker() {
    setPickerLoading(true);
    try {
      const { files, email, accessToken } = await listDriveBackups();
      setPickerFiles(files);
      setPickerEmail(email);
      setPickerToken(accessToken);
      setPickerOpen(true);
    } catch (err: any) {
      toast(err?.message ?? 'Could not connect to Drive', 'err');
    }
    setPickerLoading(false);
  }

  // ── stage Drive file for restore (shows confirm modal) ─────────────────
  function stageRestoreFromDrive(file: DriveFile) {
    setRestoreIntent({ type: 'drive', file });
  }

  // ── stage JSON file for restore (validate first, then show modal) ───────
  async function stageRestoreFromJson(file: File) {
    try {
      const parsed = await parseInstBackup(file);
      setRestoreIntent({ type: 'json', parsed, srcName: file.name });
    } catch (err) {
      toast(typeof err === 'string' ? err : 'Invalid backup file', 'err');
    }
  }

  // ── execute the staged restore (called from confirm modal) ──────────────
  async function executeRestore() {
    if (!restoreIntent) return;
    setRestoring(true);
    try {
      // 1. Download safety copy of current data
      autoBackupCurrent();

      // 2. Fetch / use already-parsed backup
      let backup: any;
      if (restoreIntent.type === 'drive') {
        setRestoringId(restoreIntent.file.id);
        const content = await downloadDriveFile(restoreIntent.file.id, pickerToken);
        backup = JSON.parse(content);
      } else {
        backup = restoreIntent.parsed;
      }

      // 3. Merge into local data
      const msg = applyBackup(backup);
      toast(`${msg} ✓`, 'ok');
      setRestoreIntent(null);
      setPickerOpen(false);
    } catch (err: any) {
      toast(err?.message ?? 'Restore failed', 'err');
    }
    setRestoringId(null);
    setRestoring(false);
  }

  // ── styles ─────────────────────────────────────────────────────────────
  const s: React.CSSProperties = {
    marginTop: 12, padding: '12px 14px', borderRadius: 10,
    background: 'rgba(79,142,255,.05)', border: '1px solid rgba(79,142,255,.2)',
  };
  const sectionLabel: React.CSSProperties = {
    fontSize: '.65rem', fontWeight: 800, color: 'var(--muted)', letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 6, marginTop: 12,
  };
  const btnStyle: React.CSSProperties = {
    flex: 1, background: 'var(--s2)', border: '1px solid var(--border)',
    borderRadius: 7, color: 'var(--text)', padding: '7px 8px',
    fontSize: '.72rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit,sans-serif',
    textAlign: 'center' as const,
  };

  return (
    <>
      <div style={s}>
        <div style={{ fontSize: '.72rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: .5, textTransform: 'uppercase' }}>
          Data &amp; Backup
        </div>

        {/* Excel */}
        <div style={sectionLabel}>Excel</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={btnStyle} onClick={() => downloadTemplate(inst.name, t.plans, t.fees)}>↓ Template</button>
          <button style={btnStyle} onClick={() => exportMembers(members, inst.name)}>↓ Export</button>
          <button style={btnStyle} onClick={onImportMembers}>↑ Import</button>
        </div>

        {/* JSON */}
        <div style={sectionLabel}>JSON Backup</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={btnStyle} onClick={() => exportInstBackup(inst, members, transactions)}>↓ Full Backup</button>
          <button style={btnStyle} onClick={() => jsonRestoreRef.current?.click()}>↑ Restore JSON</button>
          <input ref={jsonRestoreRef} type="file" accept=".json" style={{ display: 'none' }}
            onChange={async e => { const f = e.target.files?.[0]; if (f) await stageRestoreFromJson(f); e.target.value = ''; }}
          />
        </div>

        {/* Google Drive */}
        <div style={sectionLabel}>Google Drive</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <button
            onClick={handleDriveBackup} disabled={driveLoading}
            style={{ ...btnStyle, color: driveLoading ? 'var(--muted)' : 'var(--accent)', borderColor: 'rgba(79,142,255,.3)' }}>
            {driveLoading ? '⏳ Uploading…' : '☁ Backup'}
          </button>
          <button
            onClick={openDrivePicker} disabled={pickerLoading}
            style={{ ...btnStyle, color: pickerLoading ? 'var(--muted)' : 'var(--green)', borderColor: 'rgba(52,199,89,.3)' }}>
            {pickerLoading ? '⏳ Connecting…' : '↺ Restore'}
          </button>
        </div>

        {/* Last backup status */}
        {driveStatus ? (
          <div style={{ padding: '7px 10px', borderRadius: 7, background: 'rgba(52,199,89,.08)', border: '1px solid rgba(52,199,89,.2)' }}>
            <div style={{ fontSize: '.68rem', color: 'var(--green)', fontWeight: 700, marginBottom: 2 }}>✓ Last backup successful</div>
            <div style={{ fontSize: '.65rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              📧 {driveStatus.email}<br/>
              🕐 {new Date(driveStatus.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '.65rem', color: 'var(--muted)' }}>
            No backup yet · files saved to your Google Drive root
          </div>
        )}
      </div>

      {/* ── Restore confirm + instructions modal ── */}
      {restoreIntent && (
        <div className="mo open" onClick={e => { if (e.target === e.currentTarget && !restoring) setRestoreIntent(null); }}>
          <div className="mo-box">
            <div className="mo-handle"/>
            <div className="mo-title">Restore Data</div>

            {/* What will be restored */}
            <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: 12 }}>
              Restoring from:{' '}
              <strong style={{ color: 'var(--text)' }}>
                {restoreIntent.type === 'drive' ? restoreIntent.file.name : restoreIntent.srcName}
              </strong>
            </div>

            {/* Safety backup notice */}
            <div style={{ borderRadius: 9, background: 'rgba(79,142,255,.07)', border: '1px solid rgba(79,142,255,.2)', padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: '.78rem', color: 'var(--accent)', marginBottom: 6 }}>
                📥 We will first download your current data
              </div>
              <div style={{ fontSize: '.74rem', color: 'var(--muted)', lineHeight: 1.65 }}>
                Before restoring, your existing data will be automatically saved to your device as:
              </div>
              <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--text)', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', marginTop: 6, wordBreak: 'break-all', fontFamily: 'monospace' }}>
                {safetyFileName}
              </div>
              <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 6 }}>
                Save this file safely — it is your rollback point.
              </div>
            </div>

            {/* How to recover */}
            <div style={{ borderRadius: 9, background: 'rgba(255,200,0,.06)', border: '1px solid rgba(255,200,0,.2)', padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: '.78rem', color: 'var(--yellow)', marginBottom: 8 }}>
                🔄 How to go back to your existing data if needed
              </div>
              {[
                'Open Admin Profile → tap the institution',
                'Tap the ⋯ menu → choose "Data & Backup"',
                'Under JSON Backup, tap "↑ Restore JSON"',
                `Select the file named "${safetyFileName.slice(0, 30)}…"`,
                'Your previous data will be merged back instantly',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, alignItems: 'flex-start' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,200,0,.2)', color: 'var(--yellow)', fontSize: '.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    {i + 1}
                  </div>
                  <div style={{ fontSize: '.73rem', color: 'var(--muted)', lineHeight: 1.5 }}>{step}</div>
                </div>
              ))}
            </div>

            <div className="btn-row">
              <button className="btn g" onClick={() => setRestoreIntent(null)} disabled={restoring}>
                Cancel
              </button>
              <button className="btn p" onClick={executeRestore} disabled={restoring}>
                {restoring ? '⏳ Restoring…' : '✓ Download Safety Backup & Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Drive file picker modal ── */}
      {pickerOpen && (
        <div className="mo open" onClick={e => { if (e.target === e.currentTarget) setPickerOpen(false); }}>
          <div className="mo-box" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="mo-handle"/>
            <div className="mo-title">Restore from Google Drive</div>
            <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginBottom: 10 }}>
              Signed in as <strong style={{ color: 'var(--text)' }}>{pickerEmail}</strong>
            </div>

            {pickerFiles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)', fontSize: '.82rem' }}>
                No FeeFlow backup files found in your Drive.
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', marginBottom: 10 }}>
                {pickerFiles.map(f => {
                  const isRestoring = restoringId === f.id;
                  const date = new Date(f.modifiedTime).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  });
                  const sizeKB = f.size ? `${Math.round(parseInt(f.size) / 1024)} KB` : '';
                  return (
                    <div key={f.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 0', borderBottom: '1px solid var(--border)',
                    }}>
                      <div style={{ fontSize: '1.4rem', flexShrink: 0 }}>📄</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.name}
                        </div>
                        <div style={{ fontSize: '.68rem', color: 'var(--muted)', marginTop: 2 }}>
                          {date}{sizeKB ? ` · ${sizeKB}` : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => stageRestoreFromDrive(f)}
                        disabled={restoringId !== null}
                        style={{
                          background: 'rgba(52,199,89,.12)', border: '1px solid rgba(52,199,89,.3)',
                          borderRadius: 7, color: 'var(--green)', padding: '6px 12px',
                          fontSize: '.72rem', fontWeight: 700, cursor: restoringId ? 'default' : 'pointer',
                          fontFamily: 'Outfit,sans-serif', flexShrink: 0, opacity: restoringId && !isRestoring ? 0.5 : 1,
                        }}>
                        {isRestoring ? '⏳…' : '↺ Restore'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <button className="btn g" onClick={() => setPickerOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------
// Main component
// ------------------------------------------------------------------
export default function AdminProfile() {
  // ----- Store selectors (individual) -----
  const user = useAppStore(s => s.user);
  const institutions = useAppStore(s => s.institutions);
  const activeInstId = useAppStore(s => s.activeInstId);
  const defaultCountry = useAppStore(s => s.defaultCountry);
  const addInstitution = useAppStore(s => s.addInstitution);
  const updateInstitution = useAppStore(s => s.updateInstitution);
  const setActiveInst = useAppStore(s => s.setActiveInst);
  const settings = useAppStore(s => s.settings);
  const updateSettings = useAppStore(s => s.updateSettings);

  // Archive / restore actions – you must add these to your store
  const archiveInstitution = useAppStore(s => s.archiveInstitution);
  const restoreInstitution = useAppStore(s => s.restoreInstitution);
  const permanentlyDeleteInstitution = useAppStore(s => s.permanentlyDeleteInstitution);

  const { logout } = useAuthStore();
  const { toast } = useUIStore();

  // Fee rules + data backup expanded state
  const [feeRulesFor,    setFeeRulesFor]    = useState<string | null>(null);
  const [dataBackupFor,  setDataBackupFor]  = useState<string | null>(null);
  // Import members modal
  const [importMembersInstId, setImportMembersInstId] = useState<string | null>(null);

  const inp: React.CSSProperties = {
    width: '100%', background: 'var(--s2)', border: '1.5px solid var(--border)',
    borderRadius: 'var(--r2)', padding: '10px 13px', color: 'var(--text)',
    fontFamily: 'Outfit,sans-serif', fontSize: '.88rem', outline: 'none',
  };

  // ----- User profile state & handlers (unchanged) -----
  const [editUser, setEditUser] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [uName, setUName] = useState(user?.name ?? '');
  const [uPhone, setUPhone] = useState(user?.phone ?? '');
  const [uAddress, setUAddress] = useState(user?.address ?? '');
  const [uBio, setUBio] = useState(user?.bio ?? '');
  const [uPhoto, setUPhoto] = useState(user?.photo ?? '');
  const userFileRef = useRef<HTMLInputElement>(null);

  const [pinOpen, setPinOpen] = useState(false);
  const [curPin, setCurPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [cfmPin, setCfmPin] = useState('');
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

  // ----- Institution profile edit (unchanged) -----
  const [instEditId, setInstEditId] = useState('');
  const [iName, setIName] = useState('');
  const [iDesc, setIDesc] = useState('');
  const [iAddr, setIAddr] = useState('');
  const [iAchievements, setIAchievements] = useState('');
  const [iLogo, setILogo] = useState('');
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

  // ----- Add institution (unchanged) -----
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('school');

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

  // ----- QR codes (unchanged) -----
  const [qrInstId, setQrInstId] = useState('');
  const [qrOpen, setQrOpen] = useState(false);
  const [qrEditId, setQrEditId] = useState('');
  const [qrName, setQrName] = useState('');
  const [qrUpi, setQrUpi] = useState('');
  const [qrApp, setQrApp] = useState<PayQR['app']>('PhonePe');
  const [qrPrev, setQrPrev] = useState('');

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

  // ----- Sessions (unchanged) -----
  const [sessions, setSessions] = useState<{ id:string; deviceLabel:string; ip:string; lastSeen:string; isCurrent:boolean }[]>([]);
  const [sessOpen, setSessOpen] = useState(false);

  async function openSessions() {
    setSessOpen(true);
    const d = await api<{ sessions: typeof sessions }>('GET', '/auth/sessions');
    if (d?.sessions) setSessions(d.sessions);
  }

  // ----- OTA (unchanged) -----
  const [updStatus, setUpdStatus] = useState('');
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

  // ----- Publish (unchanged) -----
  const [pubOpen, setPubOpen] = useState(false);
  const [pubInstId2, setPubInstId2] = useState('');
  const [pubAddr, setPubAddr] = useState('');
  const [pubPlans, setPubPlans] = useState<{name:string;fee:number;freq:string}[]>([{name:'Standard',fee:0,freq:'monthly'}]);
  const [publishing, setPublishing] = useState(false);

  function openPub(id: string) {
    const inst = institutions.find(i => i.id === id); if (!inst) return;
    setPubInstId2(id); setPubAddr('');

    // Initialize plans from inst.plans (previously saved) if available;
    // otherwise derive from existing members (unique plan+fee combos);
    // fall back to type config defaults.
    if (inst.plans && inst.plans.length > 0) {
      setPubPlans(inst.plans.map(p => ({ name: p.name, fee: p.fee, freq: p.freq ?? 'monthly' })));
    } else {
      const instMembers = useAppStore.getState().members[id] ?? [];
      const seen = new Set<string>();
      const derivedPlans: { name: string; fee: number; freq: string }[] = [];
      instMembers.forEach(m => {
        if (m.plan && !seen.has(m.plan)) {
          seen.add(m.plan);
          derivedPlans.push({ name: m.plan, fee: m.fee ?? 0, freq: m.freq ?? 'monthly' });
        }
      });
      if (derivedPlans.length > 0) {
        setPubPlans(derivedPlans);
      } else {
        setPubPlans(th(inst.type).plans.map((p, i) => ({ name: p, fee: th(inst.type).fees[i] ?? 0, freq: 'monthly' })));
      }
    }
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
    // Save plans to local institution so MemberForm can use them
    const savedPlans = pubPlans.filter(p => p.name.trim());
    updateInstitution(pubInstId2, { isPublished: true, plans: savedPlans });

    // Fire-and-forget: pre-register all existing members with phone numbers
    // so their plans are locked when they join via invite code
    const existingMembers = useAppStore.getState().members[pubInstId2] ?? [];
    existingMembers.filter(m => m.phone).forEach(m => {
      api('PUT', `/institutions/${inst.inviteCode}/pre-members`, {
        phone: m.phone, plan: m.plan, fee: m.fee, freq: m.freq,
      });
    });

    toast(`"${inst.name}" published ✓`, 'ok'); setPubOpen(false);
  }

  // ----- Helper: days since archived -----
  const getDaysArchived = (inst: Institution) => {
    if (inst.status !== 'archived' || !inst.archivedAt) return 0;
    return Math.floor((Date.now() - new Date(inst.archivedAt).getTime()) / (1000 * 3600 * 24));
  };

  // Filter institutions by status
  const activeInsts = institutions.filter(i => i.status !== 'archived');
  const archivedInsts = institutions.filter(i => i.status === 'archived');

  // ----- JSX -----
  return (
    <div style={{ padding: '16px 16px 0' }}>
      {/* ========== USER PROFILE (unchanged) ========== */}
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
            <div className="fld" style={{ marginTop: 10 }}><label>Phone</label><input value={uPhone} onChange={e => setUPhone(e.target.value)} type="tel" style={inp}/></div>
            <div className="fld"><label>Address</label><input value={uAddress} onChange={e => setUAddress(e.target.value)} style={inp}/></div>
            <div className="fld"><label>Bio <span style={{ color:'var(--muted)', fontWeight:400 }}>(max 200 chars)</span></label><textarea value={uBio} onChange={e => setUBio(e.target.value.slice(0,200))} rows={2} style={{ ...inp, resize:'vertical' }}/><div style={{ fontSize:'.68rem', color:'var(--muted)', textAlign:'right', marginTop:3 }}>{uBio.length}/200</div></div>
            <div className="btn-row"><button className="btn g" onClick={() => setEditUser(false)}>Cancel</button><button className="btn p" onClick={saveUser} disabled={savingUser}>{savingUser ? 'Saving…' : 'Save'}</button></div>
          </>
        )}
      </div>

      {/* Security */}
      {!editUser && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-hdr">Security</div>
          <div className="tgl-row"><label>Phone</label><span style={{ fontSize:'.82rem', color:'var(--muted)' }}>{user?.phone ?? '—'}</span></div>
          <div className="tgl-row" style={{ border:'none' }}><label>PIN</label><button onClick={() => setPinOpen(true)} style={{ background:'var(--s2)', border:'1px solid var(--border)', borderRadius:7, color:'var(--accent)', padding:'5px 12px', fontSize:'.75rem', fontWeight:700, cursor:'pointer' }}>{user?.has_pin ? 'Change PIN' : 'Set PIN'}</button></div>
        </div>
      )}

      {/* ========== ACTIVE INSTITUTIONS ========== */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-hdr">Active Institutions ({activeInsts.length})</div>
        {activeInsts.map(inst => {
          const isActive = inst.id === activeInstId;
          const actions = [
            { label: 'Edit Profile', icon: '✏️', onClick: () => openInstEdit(inst.id) },
            { label: 'Publish to Directory', icon: '📢', onClick: () => openPub(inst.id) },
            { label: 'Payment QR Codes', icon: '🔗', onClick: () => openQR(inst.id) },
            { label: 'Fee Rules', icon: '⚙️', onClick: () => { setDataBackupFor(null); setFeeRulesFor(feeRulesFor === inst.id ? null : inst.id); } },
            { label: 'Data & Backup', icon: '📊', onClick: () => { setFeeRulesFor(null); setDataBackupFor(dataBackupFor === inst.id ? null : inst.id); } },
            { label: 'Archive Institution', icon: '📦', onClick: () => { if(confirm(`Archive ${inst.name}? You can restore it later.`)) archiveInstitution(inst.id); } }
          ];
          return (
            <div key={inst.id} style={{ borderBottom:'1px solid var(--border)', padding:'10px 0' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                {inst.logo ? <img src={inst.logo} style={{ width:36, height:36, borderRadius:9, objectFit:'cover' }} alt=""/> : <div style={{ width:36, height:36, borderRadius:9, background:`${th(inst.type).color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem' }}>{th(inst.type).icon}</div>}
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:'.88rem', display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    {inst.name}
                    {isActive && <span style={{ fontSize:'.6rem', fontWeight:800, padding:'2px 7px', borderRadius:99, background:'rgba(79,142,255,.15)', color:'var(--accent)' }}>ACTIVE</span>}
                    {!inst.isPublished && (
                      <span
                        onClick={() => openPub(inst.id)}
                        style={{ fontSize:'.6rem', fontWeight:800, padding:'2px 7px', borderRadius:99, background:'rgba(255,150,0,.15)', color:'var(--yellow)', cursor:'pointer', border:'1px solid rgba(255,150,0,.3)' }}
                        title="Tap to publish">
                        UNPUBLISHED
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize:'.7rem', color:'var(--muted)' }}>{th(inst.type).label}<span style={{ marginLeft:8, letterSpacing:2, background:'var(--s2)', border:'1px solid var(--border)', borderRadius:5, padding:'1px 6px', fontSize:'.67rem', userSelect:'all' }}>{inst.inviteCode}</span></div>
                </div>
                {!isActive && <button onClick={() => { setActiveInst(inst.id); toast(`Switched to ${inst.name}`, 'ok'); }} style={{ background:'rgba(79,142,255,.12)', border:'1px solid rgba(79,142,255,.3)', borderRadius:8, color:'var(--accent)', padding:'5px 12px', fontSize:'.72rem', fontWeight:700, cursor:'pointer', flexShrink:0 }}>Switch →</button>}
                <DropdownMenu actions={actions} />
              </div>
              {/* Unpublished helper banner */}
              {!inst.isPublished && (
                <div style={{ marginBottom: 8, borderRadius: 8, background: 'rgba(255,150,0,.07)', border: '1px solid rgba(255,150,0,.25)', padding: '10px 12px' }}>
                  <div style={{ fontSize: '.74rem', fontWeight: 700, color: 'var(--yellow)', marginBottom: 4 }}>
                    ⚠ Members cannot find this institution yet
                  </div>
                  <div style={{ fontSize: '.7rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                    Publishing adds <strong style={{ color: 'var(--text)' }}>{inst.name}</strong> to the member directory so members can search and join using code <strong style={{ color: 'var(--text)', letterSpacing: 1 }}>{inst.inviteCode}</strong>. Without publishing, the invite code shows "Institution not found".
                  </div>
                  <button
                    onClick={() => openPub(inst.id)}
                    style={{ marginTop: 8, background: 'rgba(255,150,0,.15)', border: '1px solid rgba(255,150,0,.35)', borderRadius: 7, color: 'var(--yellow)', padding: '6px 14px', fontSize: '.73rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>
                    📢 Publish Now →
                  </button>
                </div>
              )}

              {/* QR list (unchanged) */}
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
              {feeRulesFor   === inst.id && <FeeRulesPanel inst={inst} onUpdate={(patch) => updateInstitution(inst.id, patch)}/>}
              {dataBackupFor === inst.id && (
                <DataBackupPanel
                  inst={inst}
                  onImportMembers={() => setImportMembersInstId(inst.id)}
                />
              )}
            </div>
          );
        })}
        <button className="btn g" style={{ margin:'10px 0 0' }} onClick={() => setAddOpen(true)}>+ Add Institution</button>
      </div>

      {/* ========== ARCHIVED INSTITUTIONS ========== */}
      {archivedInsts.length > 0 && (
        <div className="card" style={{ marginBottom: 12, opacity: 0.75 }}>
          <div className="card-hdr">Archived Institutions ({archivedInsts.length})</div>
          {archivedInsts.map(inst => {
            const daysArchived = getDaysArchived(inst);
            const canDeletePermanently = daysArchived >= 30;
            return (
              <div key={inst.id} style={{ borderBottom:'1px solid var(--border)', padding:'10px 0' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                  {inst.logo ? <img src={inst.logo} style={{ width:36, height:36, borderRadius:9 }} alt=""/> : <div style={{ width:36, height:36, borderRadius:9, background:`${th(inst.type).color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem' }}>{th(inst.type).icon}</div>}
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:'.88rem' }}>{inst.name}</div>
                    <div style={{ fontSize:'.7rem', color:'var(--muted)' }}>
                      Archived on {new Date(inst.archivedAt!).toLocaleDateString()}
                      {!canDeletePermanently && ` · ${30 - daysArchived} days left before permanent deletion`}
                      {canDeletePermanently && <span style={{ color:'var(--red)', marginLeft:6 }}>Ready for deletion</span>}
                    </div>
                  </div>
                  <button onClick={() => restoreInstitution(inst.id)} style={{ background:'rgba(52,199,89,.1)', border:'1px solid rgba(52,199,89,.3)', borderRadius:8, color:'var(--green)', padding:'5px 12px', fontSize:'.72rem', fontWeight:700, cursor:'pointer' }}>↺ Restore</button>
                  <button
                    onClick={() => {
                      if (!canDeletePermanently) { toast(`Cannot delete yet. ${30 - daysArchived} days remaining.`, 'warn'); return; }
                      if (confirm(`Permanently delete ${inst.name}? All data will be lost.`)) {
                        permanentlyDeleteInstitution(inst.id);
                        toast('Institution deleted permanently', 'ok');
                      }
                    }}
                    style={{ background:'none', border:'1px solid rgba(255,92,92,.3)', borderRadius:8, color:'var(--red)', padding:'5px 12px', fontSize:'.72rem', fontWeight:700, cursor: canDeletePermanently ? 'pointer' : 'not-allowed', opacity: canDeletePermanently ? 1 : 0.5 }}
                    disabled={!canDeletePermanently}
                  >🗑 Delete Permanently</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========== REST OF THE PAGE (unchanged) ========== */}
      {API_BASE && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-hdr">Cloud & Devices</div>
          <div className="tgl-row"><div><div style={{ fontSize:'.85rem', fontWeight:600 }}>VPS Sync</div><div style={{ fontSize:'.7rem', color:'var(--muted)', marginTop:2 }}>Sync login & profile · 1 year free</div></div><label className="tgl-switch"><input type="checkbox" checked={settings.vpsSyncEnabled !== false} onChange={e => updateSettings({ vpsSyncEnabled: e.target.checked })}/><span className="tgl-track"/></label></div>
          <div className="tgl-row" style={{ cursor:'pointer', border:'none' }} onClick={openSessions}><div><div style={{ fontSize:'.85rem', fontWeight:600 }}>Active Devices</div><div style={{ fontSize:'.7rem', color:'var(--muted)', marginTop:2 }}>View logged-in devices</div></div><span style={{ color:'var(--muted)' }}>›</span></div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-hdr">App Info</div>
        <div className="tgl-row"><label>Version</label><span style={{ color:'var(--muted)', fontSize:'.82rem' }}>v{APP_VERSION}</span></div>
        <div className="tgl-row" style={{ border:'none' }}><label>Updates</label><button onClick={checkUpd} disabled={updChecking} style={{ background:'var(--s2)', border:'1px solid var(--border)', borderRadius:7, color:'var(--accent)', fontSize:'.75rem', fontWeight:700, padding:'5px 12px', cursor:'pointer' }}>{updChecking ? 'Checking…' : 'Check'}</button></div>
        {updStatus && <div style={{ fontSize:'.75rem', color:'var(--yellow)', padding:'4px 0 2px' }}>{updStatus}</div>}
      </div>

      <div className="pnote" style={{ padding:'10px 0' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width={14} height={14}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        No financial data stored on servers
      </div>

      <button className="btn g" style={{ color:'var(--red)', borderColor:'rgba(255,92,92,.2)', marginBottom:24, width:'100%' }}
        onClick={() => { if(confirm('Log out?')) logout(); }}>Log Out</button>

      {/* ========== MODALS (unchanged) ========== */}
      {/* Edit institution profile */}
      {instEditId && (() => {
        const inst = institutions.find(i => i.id === instEditId);
        if (!inst) return null;
        return (
          <div className="mo open" onClick={e => { if(e.target===e.currentTarget) setInstEditId(''); }}>
            <div className="mo-box" style={{ maxHeight:'85vh', overflowY:'auto' }}>
              <div className="mo-handle"/><div className="mo-title">Edit Institution Profile</div>
              <input ref={instFileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={onInstPhoto}/>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                <div onClick={() => instFileRef.current?.click()} style={{ width:56, height:56, borderRadius:13, background:`${th(inst.type).color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem', cursor:'pointer', overflow:'hidden', border:'2px dashed var(--border)', position:'relative' }}>
                  {iLogo ? <img src={iLogo} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/> : th(inst.type).icon}
                  <div style={{ position:'absolute',inset:0,background:'rgba(0,0,0,.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.75rem' }}>📷</div>
                </div>
                <div style={{ fontSize:'.78rem', color:'var(--muted)' }}>Tap to change logo</div>
              </div>
              <div className="fld"><label>Name</label><input value={iName} onChange={e => setIName(e.target.value)} style={inp}/></div>
              <div className="fld"><label>Address / Location</label><input value={iAddr} onChange={e => setIAddr(e.target.value)} style={inp}/></div>
              <div className="fld"><label>Description <span style={{ color:'var(--muted)', fontWeight:400 }}>(max 500 chars — shown to members)</span></label><textarea value={iDesc} onChange={e => setIDesc(e.target.value.slice(0,500))} rows={3} style={{ ...inp, resize:'vertical' }}/><div style={{ fontSize:'.68rem', color:'var(--muted)', textAlign:'right', marginTop:3 }}>{iDesc.length}/500</div></div>
              <div className="fld"><label>Achievements <span style={{ color:'var(--muted)', fontWeight:400 }}>(comma separated)</span></label><input value={iAchievements} onChange={e => setIAchievements(e.target.value)} placeholder="Est. 2005, 500+ members, Award Winner" style={inp}/></div>
              <div className="btn-row"><button className="btn g" onClick={() => setInstEditId('')}>Cancel</button><button className="btn p" onClick={saveInstProfile} disabled={iSaving}>{iSaving ? 'Saving…' : 'Save'}</button></div>
            </div>
          </div>
        );
      })()}

      {/* Add institution modal */}
      {addOpen && (
        <div className="mo open" onClick={e => { if(e.target===e.currentTarget) setAddOpen(false); }}>
          <div className="mo-box"><div className="mo-handle"/><div className="mo-title">Add Institution</div>
            <div className="fld"><label>Type</label><select value={newType} onChange={e => setNewType(e.target.value)} style={inp}>{Object.entries(TYPES).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}</select></div>
            <div className="fld"><label>Name</label><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Institution name" style={inp}/></div>
            <div className="btn-row"><button className="btn g" onClick={() => setAddOpen(false)}>Cancel</button><button className="btn p" onClick={addInst}>Add</button></div>
          </div>
        </div>
      )}

      {/* Publish modal */}
      {pubOpen && (() => {
        const inst = institutions.find(i => i.id === pubInstId2); if (!inst) return null;
        return (
          <div className="mo open" onClick={e => { if(e.target===e.currentTarget) setPubOpen(false); }}>
            <div className="mo-box" style={{ maxHeight:'82vh', overflowY:'auto' }}>
              <div className="mo-handle"/><div className="mo-title">📢 Publish to Member Directory</div>
              <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(79,142,255,.07)', border: '1px solid rgba(79,142,255,.2)', fontSize: '.73rem', color: 'var(--muted)', lineHeight: 1.65 }}>
                Publishing lets members search and join <strong style={{ color: 'var(--text)' }}>{inst.name}</strong> using invite code <strong style={{ color: 'var(--accent)', letterSpacing: 1 }}>{inst.inviteCode}</strong>. Share this code via WhatsApp or SMS — members enter it in the app to find and join your institution.
              </div>
              <div className="fld"><label>Address</label><input value={pubAddr} onChange={e => setPubAddr(e.target.value)} placeholder="Location" style={inp}/></div>
              <div style={{ fontWeight:700, fontSize:'.78rem', marginBottom:8 }}>FEE PLANS</div>
              {pubPlans.map((p,i) => (
                <div key={i} style={{ display:'flex', gap:6, marginBottom:7, alignItems:'center' }}>
                  <input value={p.name} onChange={e => { const pl=[...pubPlans]; pl[i]={...pl[i],name:e.target.value}; setPubPlans(pl); }} placeholder="Plan name" style={{ ...inp, flex:2 }}/>
                  <input type="number" value={p.fee||''} onChange={e => { const pl=[...pubPlans]; pl[i]={...pl[i],fee:Number(e.target.value)}; setPubPlans(pl); }} placeholder="₹" style={{ ...inp, flex:1, textAlign:'right' }}/>
                  <select value={p.freq} onChange={e => { const pl=[...pubPlans]; pl[i]={...pl[i],freq:e.target.value}; setPubPlans(pl); }} style={{ ...inp, flex:1, padding:'9px 6px' }}>{['monthly','quarterly','half-yearly','yearly','one-time'].map(f => <option key={f} value={f}>{f}</option>)}</select>
                  {pubPlans.length>1 && <button onClick={() => setPubPlans(pubPlans.filter((_,j) => j!==i))} style={{ background:'none', border:'none', color:'var(--red)', cursor:'pointer', fontSize:'1rem' }}>✕</button>}
                </div>
              ))}
              <button className="btn g" style={{ marginBottom:12, fontSize:'.75rem' }} onClick={() => setPubPlans([...pubPlans,{name:'',fee:0,freq:'monthly'}])}>+ Add Plan</button>
              <div className="btn-row"><button className="btn g" onClick={() => setPubOpen(false)}>Cancel</button><button className="btn p" onClick={doPublish} disabled={publishing}>{publishing ? 'Publishing…' : 'Publish →'}</button></div>
            </div>
          </div>
        );
      })()}

      {/* QR modal */}
      {qrOpen && (
        <div className="mo open" onClick={e => { if(e.target===e.currentTarget) setQrOpen(false); }}>
          <div className="mo-box"><div className="mo-handle"/><div className="mo-title">{qrEditId ? 'Edit' : 'Add'} Payment QR</div>
            <div className="fld"><label>Display Name</label><input value={qrName} onChange={e => { setQrName(e.target.value); genQR(qrUpi, e.target.value); }} placeholder="e.g. PhonePe — Admin" style={inp}/></div>
            <div className="fld"><label>UPI ID / VPA</label><input value={qrUpi} onChange={e => { setQrUpi(e.target.value); genQR(e.target.value, qrName); }} placeholder="9876543210@ybl" style={inp}/></div>
            <div className="fld"><label>App</label><div style={{ display:'flex', gap:7, flexWrap:'wrap', marginTop:5 }}>{(['PhonePe','Google Pay','Paytm','UPI'] as PayQR['app'][]).map(a => (<label key={a} style={{ display:'flex', alignItems:'center', gap:4, fontSize:'.82rem', cursor:'pointer', padding:'5px 10px', borderRadius:7, border:`1.5px solid ${qrApp===a?'var(--accent)':'var(--border)'}`, background:'var(--s2)' }}><input type="radio" name="qrApp" checked={qrApp===a} onChange={() => setQrApp(a)} style={{ accentColor:'var(--accent)' }}/>{a}</label>))}</div></div>
            {qrPrev && <div style={{ textAlign:'center', margin:'12px 0' }}><img src={qrPrev} style={{ width:120, height:120, borderRadius:8, border:'1px solid var(--border)' }} alt="QR"/></div>}
            <div className="btn-row"><button className="btn g" onClick={() => setQrOpen(false)}>Cancel</button><button className="btn p" onClick={saveQR}>Save QR</button></div>
          </div>
        </div>
      )}

      {/* Sessions modal */}
      {sessOpen && (
        <div className="mo open" onClick={e => { if(e.target===e.currentTarget) setSessOpen(false); }}>
          <div className="mo-box" style={{ maxHeight:'75vh', overflowY:'auto' }}>
            <div className="mo-handle"/><div className="mo-title">Active Devices</div>
            {sessions.length === 0 && <div style={{ color:'var(--muted)', textAlign:'center', padding:16, fontSize:'.82rem' }}>Loading…</div>}
            {sessions.map(s => (
              <div key={s.id} style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                <div><div style={{ fontSize:'.85rem', fontWeight:600 }}>{s.deviceLabel}{s.isCurrent && <span style={{ marginLeft:6, fontSize:'.65rem', background:'rgba(79,142,255,.15)', color:'var(--accent)', padding:'2px 7px', borderRadius:99, fontWeight:700 }}>This device</span>}</div><div style={{ fontSize:'.72rem', color:'var(--muted)', marginTop:3 }}>{new Date(s.lastSeen).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div>{s.ip && <div style={{ fontSize:'.7rem', color:'var(--muted)', marginTop:1 }}>{s.ip}</div>}</div>
                {!s.isCurrent && <button onClick={async () => { if(confirm('Logout this device?')) { await api('DELETE','/auth/sessions/'+s.id); openSessions(); toast('Logged out','ok'); }}} style={{ background:'none', border:'1px solid rgba(255,92,92,.3)', borderRadius:6, color:'var(--red)', padding:'4px 9px', fontSize:'.72rem', cursor:'pointer', flexShrink:0 }}>Logout</button>}
              </div>
            ))}
            <button className="btn g" style={{ color:'var(--red)', borderColor:'rgba(255,92,92,.2)', marginBottom:6 }} onClick={async () => { if(confirm('Logout all other devices?')) { await api('DELETE','/auth/sessions/others'); openSessions(); toast('Done','ok'); }}}>Logout All Others</button>
            <button className="btn g" onClick={() => setSessOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Member Import modal (triggered from Data & Backup panel) */}
      {importMembersInstId && (() => {
        const inst = institutions.find(i => i.id === importMembersInstId);
        if (!inst) return null;
        return <MemberImportModal inst={inst} onClose={() => setImportMembersInstId(null)}/>;
      })()}

      {/* PIN modal */}
      {pinOpen && (
        <div className="mo open" onClick={e => { if(e.target===e.currentTarget) setPinOpen(false); }}>
          <div className="mo-box"><div className="mo-handle"/><div className="mo-title">{user?.has_pin ? 'Change PIN' : 'Set PIN'}</div>
            {user?.has_pin && <div className="fld"><label>Current PIN</label><PinInput value={curPin} onChange={setCurPin} disabled={pinSaving}/></div>}
            <div className="fld"><label>New PIN</label><PinInput value={newPin} onChange={setNewPin} disabled={pinSaving}/></div>
            <div className="fld"><label>Confirm PIN</label><PinInput value={cfmPin} onChange={setCfmPin} disabled={pinSaving}/></div>
            <div className="btn-row"><button className="btn g" onClick={() => setPinOpen(false)}>Cancel</button><button className="btn p" onClick={savePin} disabled={pinSaving}>{pinSaving ? 'Saving…' : 'Save PIN'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}