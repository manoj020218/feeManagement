import { create } from 'zustand';
import { api, API_BASE, GOOGLE_CLIENT_ID } from '@/core/services/api';
import { useAppStore } from './useAppStore';
import type { User } from '@/core/types';

/** POST/GET directly so we can read the error body on failure */
async function authFetch(path: string, body: object): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  try {
    const r = await fetch(`${API_BASE}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}

interface AuthStore {
  loading: boolean;
  error: string | null;
  setError: (err: string | null) => void;

  loginWithPin: (phone: string, pin: string) => Promise<boolean>;
  registerWithPin: (name: string, phone: string, pin: string, primaryRole: string, country: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  hydrateFromAPI: () => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  loading: false,
  error: null,

  setError: (error) => set({ error }),

  loginWithPin: async (phone, pin) => {
    set({ loading: true, error: null });
    const res = await authFetch('/auth/login', { phone, pin });
    if (!res.ok) {
      const msg = res.status === 0
        ? 'Cannot connect — check internet'
        : res.status === 401
          ? 'Phone number not found or incorrect PIN'
          : (res.data.error as string) || 'Login failed';
      set({ loading: false, error: msg });
      return false;
    }
    const data = res.data as { accessToken: string; refreshToken: string; user: User };
    localStorage.setItem('ff_token', data.accessToken);
    localStorage.setItem('ff_refresh', data.refreshToken);
    useAppStore.getState().setUser(_mapUser(data.user));
    set({ loading: false });
    return true;
  },

  registerWithPin: async (name, phone, pin, primaryRole, country) => {
    set({ loading: true, error: null });
    const res = await authFetch('/auth/register', { name, phone, pin, primaryRole, country });
    if (!res.ok) {
      const msg = res.status === 0
        ? 'Cannot connect — check internet'
        : res.status === 409
          ? 'ALREADY_REGISTERED'          // special sentinel → OnboardingFlow shows login button
          : (res.data.error as string) || 'Registration failed';
      set({ loading: false, error: msg });
      return false;
    }
    const data = res.data as { accessToken: string; refreshToken: string; user: User };
    localStorage.setItem('ff_token', data.accessToken);
    localStorage.setItem('ff_refresh', data.refreshToken);
    useAppStore.getState().setUser(_mapUser(data.user));
    set({ loading: false });
    return true;
  },

  loginWithGoogle: async () => {
    set({ loading: true, error: null });
    try {
      const isNative = window.Capacitor?.isNativePlatform?.();
      let idToken: string | null = null;

      if (isNative && window.Capacitor?.Plugins?.GoogleAuth) {
        // Native Capacitor Google Auth
        const result = await window.Capacitor.Plugins.GoogleAuth.signIn();
        idToken = result?.authentication?.idToken ?? null;
      } else {
        // Web GSI prompt
        idToken = await _webGoogleSignIn();
      }

      if (!idToken) { set({ loading: false, error: 'Google sign-in cancelled' }); return false; }

      const data = await api<{ accessToken: string; refreshToken: string; user: User }>(
        'POST', '/auth/google', { id_token: idToken }
      );
      if (!data) { set({ loading: false, error: 'Google login failed' }); return false; }

      localStorage.setItem('ff_token', data.accessToken);
      localStorage.setItem('ff_refresh', data.refreshToken);
      useAppStore.getState().setUser(_mapUser(data.user));
      set({ loading: false });
      return true;
    } catch (e) {
      set({ loading: false, error: 'Google sign-in error' });
      return false;
    }
  },

  hydrateFromAPI: async () => {
    const token = localStorage.getItem('ff_token');
    if (!token) return false;
    const data = await api<{ user: User }>('GET', '/auth/me');
    if (!data) return false;
    useAppStore.getState().setUser(_mapUser(data.user));
    return true;
  },

  logout: () => {
    api('POST', '/auth/logout');
    // Remove auth tokens only — do NOT touch ff3 (institutions / members / transactions stay on device)
    localStorage.removeItem('ff_token');
    localStorage.removeItem('ff_refresh');
    // Clear user from store so the app returns to login screen; preserve all other state
    useAppStore.getState().setUser(null);
  },
}));

// ── Helpers ──────────────────────────────────────────────
function _mapUser(raw: User): User {
  return {
    id: (raw as unknown as Record<string, unknown>)._id as string ?? raw.id,
    name: raw.name,
    phone: raw.phone,
    email: raw.email,
    primaryRole: (raw as unknown as Record<string, unknown>).primary_role as User['primaryRole'] ?? raw.primaryRole ?? 'admin',
    defaultCountry: (raw as unknown as Record<string, unknown>).default_country as string ?? raw.defaultCountry ?? 'IN',
    has_pin: raw.has_pin,
  };
}

function _webGoogleSignIn(): Promise<string | null> {
  return new Promise((resolve) => {
    const w = window as unknown as Record<string, unknown>;
    if (!w.google) { resolve(null); return; }
    const google = w.google as { accounts: { id: { initialize: (o: unknown) => void; prompt: () => void } } };
    let resolved = false;
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (resp: { credential: string }) => {
        if (!resolved) { resolved = true; resolve(resp.credential); }
      },
    });
    google.accounts.id.prompt();
    setTimeout(() => { if (!resolved) { resolved = true; resolve(null); } }, 60000);
  });
}
