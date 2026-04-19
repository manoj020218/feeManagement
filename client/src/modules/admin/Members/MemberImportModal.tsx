// client/src/modules/admin/Members/MemberImportModal.tsx
import { useState, useRef } from 'react';
import { useAppStore } from '@/core/store/useAppStore';
import { useUIStore } from '@/core/store/useUIStore';
import { parseExcelFile, downloadTemplate, type MemberImportRow } from '@/core/services/excelService';
import { todayISO, addFreq } from '@/utils/dateHelpers';
import { th } from '@/data/institutionTypes';
import type { Institution } from '@/core/types';

interface Props {
  inst: Institution;
  onClose: () => void;
}

const STATUS_META = {
  ok:   { bg: 'rgba(52,199,89,.12)',   color: 'var(--green)',  label: '✓' },
  warn: { bg: 'rgba(255,200,0,.12)',   color: 'var(--yellow)', label: '⚠' },
  err:  { bg: 'rgba(255,92,92,.12)',   color: 'var(--red)',    label: '✕' },
  dup:  { bg: 'rgba(120,120,120,.1)',  color: 'var(--muted)',  label: '~' },
} as const;

export default function MemberImportModal({ inst, onClose }: Props) {
  const importMembers = useAppStore(s => s.importMembers);
  const existingMembers = useAppStore(s => s.members[inst.id] ?? []);
  const { toast } = useUIStore();

  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<MemberImportRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [done, setDone] = useState(false);

  const t = th(inst.type);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setParsing(true);
    try {
      const parsed = await parseExcelFile(file);
      // Mark duplicates (same normalised phone already in this institution)
      const existingPhones = new Set(existingMembers.map(m => m.phone).filter(Boolean));
      const marked = parsed.map(r => {
        if (r._status !== 'err' && r._norm.phone && existingPhones.has(r._norm.phone)) {
          return { ...r, _status: 'dup' as const };
        }
        return r;
      });
      setRows(marked);
    } catch (err) {
      toast(typeof err === 'string' ? err : 'Could not read file', 'err');
    }
    setParsing(false);
    e.target.value = '';
  }

  function confirmImport() {
    const valid = rows.filter(r => r._status === 'ok' || r._status === 'warn');
    if (!valid.length) { toast('No valid rows to import', 'warn'); return; }

    const today = todayISO();
    const toAdd = valid.map((r, i) => ({
      id: (Date.now() + i).toString(36) + Math.random().toString(36).slice(2, 7),
      instId: inst.id,
      name: r._norm.name,
      phone: r._norm.phone || undefined,
      plan: r._norm.plan || t.plans[0] || 'Standard',
      fee: r._norm.fee,
      freq: 'monthly' as const,
      joinDate: r._norm.joinDate || today,
      nextDue: addFreq(r._norm.joinDate || today, 'monthly'),
      status: 'due' as const,
      note: r._norm.notes || undefined,
    }));

    importMembers(inst.id, toAdd);
    toast(`${toAdd.length} members imported ✓`, 'ok');
    setDone(true);
  }

  const okCount   = rows.filter(r => r._status === 'ok').length;
  const warnCount = rows.filter(r => r._status === 'warn').length;
  const errCount  = rows.filter(r => r._status === 'err').length;
  const dupCount  = rows.filter(r => r._status === 'dup').length;
  const importable = okCount + warnCount;

  const inp: React.CSSProperties = {
    width: '100%', background: 'var(--s2)', border: '1.5px solid var(--border)',
    borderRadius: 'var(--r2)', padding: '10px 13px', color: 'var(--text)',
    fontFamily: 'Outfit,sans-serif', fontSize: '.88rem', outline: 'none',
  };

  return (
    <div className="mo open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mo-box" style={{ maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div className="mo-handle"/>
        <div className="mo-title">Import Members · {inst.name}</div>

        {/* ── Done state ── */}
        {done ? (
          <div style={{ textAlign: 'center', padding: '28px 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>✅</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Import complete!</div>
            <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: 20 }}>
              Members added to {inst.name}
            </div>
            <button className="btn p" onClick={onClose}>Done</button>
          </div>

        /* ── Pick file ── */
        ) : rows.length === 0 ? (
          <div style={{ padding: '8px 0 4px' }}>
            <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: 14, lineHeight: 1.7 }}>
              Upload an Excel file (.xlsx) with columns:<br/>
              <strong style={{ color: 'var(--text)' }}>Name, Mobile, Plan/Class, Fee, Join Date</strong>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile}/>
            <button className="btn p" style={{ width: '100%', marginBottom: 8 }}
              onClick={() => fileRef.current?.click()} disabled={parsing}>
              {parsing ? '⏳ Reading…' : '📂 Choose Excel File'}
            </button>
            <button className="btn g" style={{ width: '100%', marginBottom: 10 }}
              onClick={() => downloadTemplate(inst.name, t.plans, t.fees)}>
              ↓ Download Template
            </button>
            <button className="btn g" onClick={onClose}>Cancel</button>
          </div>

        /* ── Preview table ── */
        ) : (
          <>
            {/* Summary chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {okCount   > 0 && <span style={{ padding: '3px 10px', borderRadius: 99, background: 'rgba(52,199,89,.15)',   color: 'var(--green)',  fontSize: '.7rem', fontWeight: 700 }}>✓ {okCount} Ready</span>}
              {warnCount > 0 && <span style={{ padding: '3px 10px', borderRadius: 99, background: 'rgba(255,200,0,.15)',   color: 'var(--yellow)', fontSize: '.7rem', fontWeight: 700 }}>⚠ {warnCount} Warnings</span>}
              {dupCount  > 0 && <span style={{ padding: '3px 10px', borderRadius: 99, background: 'rgba(120,120,120,.12)', color: 'var(--muted)',  fontSize: '.7rem', fontWeight: 700 }}>~ {dupCount} Duplicate</span>}
              {errCount  > 0 && <span style={{ padding: '3px 10px', borderRadius: 99, background: 'rgba(255,92,92,.15)',   color: 'var(--red)',    fontSize: '.7rem', fontWeight: 700 }}>✕ {errCount} Errors</span>}
            </div>
            {(errCount > 0 || dupCount > 0) && (
              <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginBottom: 8 }}>
                Error and duplicate rows will be skipped on import.
              </div>
            )}

            {/* Preview table */}
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.72rem' }}>
                <thead>
                  <tr style={{ background: 'var(--s2)', position: 'sticky', top: 0, zIndex: 1 }}>
                    <th style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 700, color: 'var(--muted)', width: 22 }}>#</th>
                    <th style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 700, color: 'var(--muted)' }}>Name</th>
                    <th style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 700, color: 'var(--muted)' }}>Phone</th>
                    <th style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 700, color: 'var(--muted)' }}>Plan</th>
                    <th style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--muted)' }}>Fee</th>
                    <th style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 700, color: 'var(--muted)', width: 26 }}>St</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const s = STATUS_META[r._status];
                    const issues = [...Object.values(r._errors), ...Object.values(r._warnings)].join('; ');
                    return (
                      <tr key={r._rowNum} style={{ borderTop: '1px solid var(--border)', opacity: r._status === 'err' || r._status === 'dup' ? 0.5 : 1 }}>
                        <td style={{ padding: '6px 8px', color: 'var(--muted)' }}>{r._rowNum}</td>
                        <td style={{ padding: '6px 8px' }}>
                          <div>{r.name || <span style={{ color: 'var(--red)' }}>—</span>}</div>
                          {issues && <div style={{ fontSize: '.63rem', color: 'var(--yellow)', marginTop: 2 }}>{issues}</div>}
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          {r._norm.phone
                            ? r._norm.phone
                            : <span style={{ color: 'var(--red)', fontSize: '.65rem' }}>{r.phone || '—'}</span>}
                        </td>
                        <td style={{ padding: '6px 8px', color: 'var(--muted2)' }}>{r.plan || '—'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>₹{r.fee}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <span style={{ fontWeight: 800, fontSize: '.8rem', color: s.color }}>{s.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="btn-row">
              <button className="btn g" onClick={() => setRows([])}>← Back</button>
              <button className="btn p" onClick={confirmImport} disabled={importable === 0}>
                Import {importable} {importable === 1 ? 'Member' : 'Members'} →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
