// client/src/core/services/excelService.ts
import * as XLSX from 'xlsx';

// ----------------------------------------------------------------------
// 1. Types
// ----------------------------------------------------------------------
export interface MemberImportRow {
  name: string;
  phone: string;
  plan: string;
  fee: number;
  joinDate?: string;
  notes?: string;
  _rowNum: number;
  _errors: Record<string, string>;
  _warnings: Record<string, string>;
  _status: 'ok' | 'err' | 'warn' | 'dup';
  _norm: {
    name: string;
    phone: string;
    fee: number;
    joinDate?: string;
    plan: string;
    notes: string;
  };
}

// ----------------------------------------------------------------------
// 2. Helper: phone normaliser (Indian 10-digit)
// ----------------------------------------------------------------------
function normalizePhone(raw: string, digits: number = 10): string {
  let n = raw.replace(/\D/g, '');
  if (n.length === digits && /^[6-9]/.test(n)) return n;
  if (n.length > digits && n.startsWith('91')) n = n.slice(2);
  if (n.length === digits && /^\d+$/.test(n)) return n;
  return '';
}

// ----------------------------------------------------------------------
// 3. Download template Excel file
// ----------------------------------------------------------------------
export function downloadTemplate(instName: string, plans: string[], fees: number[]) {
  const wsData = [
    ['Name', 'Mobile', 'Plan/Class', 'Fee (₹)', 'Join Date', 'Notes'],
    [
      'John Doe',
      '9876543210',
      plans[0] || 'Monthly',
      fees[0] || 500,
      '2025-04-01',
      '',
    ],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, instName.slice(0, 28));
  XLSX.writeFile(wb, `FeeFlow_template_${instName}.xlsx`);
}

// ----------------------------------------------------------------------
// 4. Export members to Excel
// ----------------------------------------------------------------------
export function exportMembers(members: any[], instName: string) {
  const rows = members.map((m) => [
    m.name,
    m.phone || '',
    m.plan || '',
    m.fee || 0,
    m.joinDate || '',
    m.notes || '',
  ]);
  const ws = XLSX.utils.aoa_to_sheet([
    ['Name', 'Mobile', 'Plan/Class', 'Fee (₹)', 'Join Date', 'Notes'],
    ...rows,
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Members');
  XLSX.writeFile(wb, `${instName}_members_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ----------------------------------------------------------------------
// 5. Parse uploaded Excel file with validation
// ----------------------------------------------------------------------
export function parseExcelFile(file: File): Promise<MemberImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (rows.length < 2) {
          return reject('File has no data rows');
        }

        const firstRow = rows[0];
        if (!firstRow || !Array.isArray(firstRow)) {
          return reject('Excel file has no header row');
        }

        // Convert headers to lowercase strings
        const headers: string[] = firstRow.map((cell: unknown) =>
          String(cell ?? '').toLowerCase().trim()
        );

        // Helper to find column index by keywords
        const findCol = (keywords: string[]): number => {
          return headers.findIndex((h) => keywords.some((kw) => h.includes(kw)));
        };

        const colMap = {
          name: findCol(['name']),
          phone: findCol(['mobile', 'phone']),
          plan: findCol(['plan', 'class', 'batch', 'package']),
          fee: findCol(['fee', 'amount', 'price']),
          joinDate: findCol(['join', 'date', 'joining', 'start']),
          notes: findCol(['notes', 'remark', 'comments']),
        };

        // Required columns
        if (colMap.name === -1 || colMap.phone === -1) {
          return reject('Missing required columns: "Name" and/or "Mobile"');
        }

        // Filter out rows where name is empty
        const dataRows = rows.slice(1).filter((row: any[]) => {
          const nameCell = row[colMap.name];
          return nameCell && String(nameCell).trim() !== '';
        });

        const parsed = dataRows.map((row, idx) =>
          validateImportRow(row, colMap, idx + 2)
        );
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ----------------------------------------------------------------------
// 6. Validate a single row
// ----------------------------------------------------------------------
function validateImportRow(
  row: any[],
  colMap: {
    name: number;
    phone: number;
    plan: number;
    fee: number;
    joinDate: number;
    notes: number;
  },
  rowNum: number
): MemberImportRow {
  const name = (row[colMap.name] || '').toString().trim();
  const rawPhone = (row[colMap.phone] || '').toString().trim();
  const plan = colMap.plan !== -1 ? (row[colMap.plan] || '').toString().trim() : '';
  const feeStr = colMap.fee !== -1
    ? (row[colMap.fee] || '').toString().replace(/[₹,\s]/g, '')
    : '';
  const fee = parseFloat(feeStr) || 0;
  const joinDate = colMap.joinDate !== -1
    ? (row[colMap.joinDate] || '').toString().trim()
    : '';
  const notes = colMap.notes !== -1
    ? (row[colMap.notes] || '').toString().trim()
    : '';

  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  // Name validation
  if (!name) {
    errors.name = 'Name is required';
  }

  // Phone validation (Indian 10-digit)
  const normPhone = normalizePhone(rawPhone, 10);
  if (!normPhone || !/^[6-9]\d{9}$/.test(normPhone)) {
    errors.phone = 'Valid 10-digit Indian mobile number required (starts with 6-9)';
  }

  // Fee validation
  if (fee < 0) {
    errors.fee = 'Fee cannot be negative';
  } else if (fee > 100000) {
    warnings.fee = 'Unusually high fee – please verify';
  }

  // Join date validation (optional)
  let joinDateValid = joinDate;
  if (joinDate) {
    const datePattern = /^\d{4}-\d{2}-\d{2}$|^\d{2}-\d{2}-\d{4}$|^\d{2}\/\d{2}\/\d{4}$/;
    if (!datePattern.test(joinDate)) {
      warnings.joinDate = 'Date format may be invalid. Use YYYY-MM-DD or DD-MM-YYYY.';
    }
  }

  const hasError = Object.keys(errors).length > 0;
  const hasWarning = !hasError && Object.keys(warnings).length > 0;

  return {
    name,
    phone: rawPhone,
    plan,
    fee,
    joinDate: joinDateValid,
    notes,
    _rowNum: rowNum,
    _errors: errors,
    _warnings: warnings,
    _status: hasError ? 'err' : hasWarning ? 'warn' : 'ok',
    _norm: {
      name,
      phone: normPhone,
      fee,
      joinDate: joinDateValid || undefined,
      plan,
      notes,
    },
  };
}