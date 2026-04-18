import type { AppState } from '@/core/types';

const KEY = 'ff3';

const DEFAULT_STATE: AppState = {
  user: null,
  institutions: [],
  members: {},
  transactions: {},
  memberships: [],
  activeInstId: null,
  activeRole: 'admin',
  defaultCountry: 'IN',
  settings: {
    vpsSyncEnabled: true,
    vpsSyncStartDate: null,
  },
};

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<AppState>;
    // Merge with defaults to handle new fields added in updates
    return {
      ...DEFAULT_STATE,
      ...parsed,
      settings: { ...DEFAULT_STATE.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveState(state: Partial<AppState>): void {
  try {
    const current = loadState();
    localStorage.setItem(KEY, JSON.stringify({ ...current, ...state }));
  } catch {
    // Storage full — silently ignore
  }
}

export function clearState(): void {
  localStorage.removeItem(KEY);
  localStorage.removeItem('ff_token');
  localStorage.removeItem('ff_refresh');
}
