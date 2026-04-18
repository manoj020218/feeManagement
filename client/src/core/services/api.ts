// In Vite dev mode (npm run client:dev), VITE_API_BASE is unset → empty string
// so /api/* requests go through Vite's proxy → localhost:3001.
// In production build, VITE_API_BASE = 'https://feeflow.iotsoft.in'.
export const API_BASE: string = import.meta.env.VITE_API_BASE ?? '';
export const APP_VERSION = '1.0.0';
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem('ff_refresh');
  if (!refreshToken) return false;
  try {
    const r = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!r.ok) return false;
    const data = await r.json();
    localStorage.setItem('ff_token', data.accessToken);
    localStorage.setItem('ff_refresh', data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export async function api<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T | null> {
  const token = localStorage.getItem('ff_token');
  try {
    const r = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (r.status === 401 && path !== '/auth/refresh' && path !== '/auth/login') {
      const refreshed = await tryRefreshToken();
      if (refreshed) return api(method, path, body);
      return null;
    }

    if (!r.ok) return null;
    return r.json() as Promise<T>;
  } catch {
    return null;
  }
}

export async function checkVersion(): Promise<{ version: string; apkUrl: string; changelog: string } | null> {
  return api('GET', '/version');
}
