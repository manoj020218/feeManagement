// client/src/core/services/jsonService.ts
// Full institution backup: export to JSON / parse for restore

import type { Institution, Member, Transaction } from '@/core/types';

export interface InstBackup {
  version: 1;
  exportedAt: string;
  institution: Institution;
  members: Member[];
  transactions: Transaction[];
}

// ── Export ────────────────────────────────────────────────────────────────
export function exportInstBackup(
  inst: Institution,
  members: Member[],
  transactions: Transaction[],
): void {
  const backup: InstBackup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    institution: inst,
    members,
    transactions,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${inst.name.replace(/[^a-z0-9]/gi, '_')}_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Parse (file → object) ─────────────────────────────────────────────────
export function parseInstBackup(file: File): Promise<InstBackup> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target?.result as string) as InstBackup;
        if (
          !data.institution ||
          typeof data.institution.id !== 'string' ||
          !Array.isArray(data.members) ||
          !Array.isArray(data.transactions)
        ) {
          reject('Invalid backup file — missing or malformed institution data');
          return;
        }
        resolve(data);
      } catch {
        reject('Could not parse file — make sure it is a valid FeeFlow JSON backup');
      }
    };
    reader.onerror = () => reject('File read error');
    reader.readAsText(file);
  });
}
