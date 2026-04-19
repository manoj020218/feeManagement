// client/src/core/services/driveService.ts
// Supports both Capacitor (Android/iOS) and web (Google Identity Services fallback)

import { GOOGLE_CLIENT_ID } from '@/core/services/api';

const DRIVE_SCOPE = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

interface CachedDriveAuth {
  accessToken: string;
  email: string;
  expiresAt: number;
}

let cachedDriveAuth: CachedDriveAuth | null = null;

function hasValidCachedAuth() {
  return !!cachedDriveAuth && cachedDriveAuth.expiresAt > Date.now();
}

export interface DriveBackupResult {
  email: string;
}

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}

// ── Web: load GSI script once ─────────────────────────────────────────────
function loadGSIScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

// ── Web: OAuth popup → access token + email ───────────────────────────────
function getWebTokenAndEmail(): Promise<{ accessToken: string; email: string }> {
  return new Promise(async (resolve, reject) => {
    try {
      if (hasValidCachedAuth()) {
        resolve({
          accessToken: cachedDriveAuth!.accessToken,
          email: cachedDriveAuth!.email,
        });
        return;
      }
      const clientId = GOOGLE_CLIENT_ID;
      if (!clientId) {
        reject(new Error('Google Client ID not configured. Add VITE_GOOGLE_CLIENT_ID to client/.env.local'));
        return;
      }
      await loadGSIScript();
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        callback: async (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description ?? response.error));
            return;
          }
          const accessToken = response.access_token as string;
          const expiresInSec = Number(response.expires_in ?? 3600);
          try {
            const info = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            const userData = await info.json();
            cachedDriveAuth = {
              accessToken,
              email: userData.email ?? 'unknown',
              // Refresh one minute before token expiry
              expiresAt: Date.now() + Math.max(60, expiresInSec - 60) * 1000,
            };
            resolve({ accessToken, email: userData.email ?? 'unknown' });
          } catch {
            cachedDriveAuth = {
              accessToken,
              email: 'unknown',
              expiresAt: Date.now() + Math.max(60, expiresInSec - 60) * 1000,
            };
            resolve({ accessToken, email: 'unknown' });
          }
        },
      });
      client.requestAccessToken();
    } catch (err) {
      reject(err);
    }
  });
}

// ── Shared: get token + email (native or web) ─────────────────────────────
async function getTokenAndEmail(): Promise<{ accessToken: string; email: string }> {
  if (hasValidCachedAuth()) {
    return {
      accessToken: cachedDriveAuth!.accessToken,
      email: cachedDriveAuth!.email,
    };
  }

  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
  if (isNative) {
    const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
    await GoogleAuth.initialize();
    const googleUser = await GoogleAuth.signIn();
    const accessToken = googleUser.authentication?.accessToken;
    const email = googleUser.email ?? 'unknown';
    if (!accessToken) throw new Error('Could not obtain Google access token');
    cachedDriveAuth = {
      accessToken,
      email,
      // Native plugin doesn't expose expiry reliably; keep short cache window.
      expiresAt: Date.now() + 45 * 60 * 1000,
    };
    return { accessToken, email };
  }
  return getWebTokenAndEmail();
}

// ── Shared: multipart upload ──────────────────────────────────────────────
async function uploadJsonToDrive(accessToken: string, content: string, fileName: string): Promise<void> {
  const blob = new Blob([content], { type: 'application/json' });
  const metadata = { name: fileName, mimeType: 'application/json', parents: ['root'] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Drive upload failed: ${JSON.stringify(err)}`);
  }
}

// ── Backup ────────────────────────────────────────────────────────────────
export async function performDriveBackup(
  backupData: object,
  fileName: string,
): Promise<DriveBackupResult> {
  const content = JSON.stringify(backupData, null, 2);
  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();

  if (isNative) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { accessToken, email } = await getTokenAndEmail();

    const filePath = `feeflow_backup_${Date.now()}.json`;
    await Filesystem.writeFile({ path: filePath, data: content, directory: Directory.Cache });
    const fileInfo = await Filesystem.readFile({ path: filePath, directory: Directory.Cache });
    const blob = new Blob([fileInfo.data as string], { type: 'application/json' });

    const metadata = { name: fileName, mimeType: 'application/json', parents: ['root'] };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    await Filesystem.deleteFile({ path: filePath, directory: Directory.Cache }).catch(() => {});
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Drive upload failed: ${JSON.stringify(err)}`);
    }
    return { email };
  } else {
    const { accessToken, email } = await getTokenAndEmail();
    await uploadJsonToDrive(accessToken, content, fileName);
    return { email };
  }
}

// ── List backups from Drive ───────────────────────────────────────────────
// Returns the access token too so the caller can reuse it for download
// without triggering a second OAuth popup.
export async function listDriveBackups(): Promise<{
  files: DriveFile[];
  email: string;
  accessToken: string;
}> {
  const { accessToken, email } = await getTokenAndEmail();

  // drive.file scope only sees files this app created — no extra filter needed,
  // but we add name filter to be safe and to sort cleanly.
  const q = encodeURIComponent(
    "mimeType='application/json' and trashed=false",
  );
  const fields = encodeURIComponent('files(id,name,modifiedTime,size)');
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=modifiedTime+desc&pageSize=50`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Could not list Drive files: ${JSON.stringify(err)}`);
  }
  const data = await res.json();
  // Keep only files whose name starts with FeeFlow_ (created by us)
  const files: DriveFile[] = (data.files ?? []).filter((f: DriveFile) =>
    f.name.startsWith('FeeFlow_'),
  );
  return { files, email, accessToken };
}

// ── Download a single file from Drive (reuses token from list) ────────────
export async function downloadDriveFile(fileId: string, accessToken: string): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error('Could not download file from Google Drive');
  return res.text();
}
