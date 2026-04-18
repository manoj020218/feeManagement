import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { loadState, saveState } from '@/core/services/storage';
import type {
  AppState, User, Institution, Member, Transaction,
  Membership, AppSettings,
} from '@/core/types';

interface AppStore extends AppState {
  // Setters
  setUser: (user: User | null) => void;
  setActiveRole: (role: 'admin' | 'member') => void;
  setActiveInst: (id: string | null) => void;
  setDefaultCountry: (code: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;

  // Institution CRUD
  addInstitution: (inst: Institution) => void;
  updateInstitution: (id: string, patch: Partial<Institution>) => void;
  deleteInstitution: (id: string) => void;

  // NEW: Archive / Restore / Permanent Delete
  archiveInstitution: (id: string) => void;
  restoreInstitution: (id: string) => void;
  permanentlyDeleteInstitution: (id: string) => void;

  // Member CRUD
  getMembers: (instId: string) => Member[];
  addMember: (member: Member) => void;
  updateMember: (instId: string, memberId: string, patch: Partial<Member>) => void;
  deleteMember: (instId: string, memberId: string) => void;
  importMembers: (instId: string, members: Member[]) => void;

  // Transaction CRUD
  getTransactions: (instId: string) => Transaction[];
  addTransaction: (tx: Transaction) => void;
  deleteTransaction: (instId: string, txId: string) => void;

  // Memberships (member joined institutions)
  addMembership: (ms: Membership) => void;
  updateMembership: (id: string, patch: Partial<Membership>) => void;
  removeMembership: (id: string) => void;

  // Persistence
  persist: () => void;
  hydrate: () => void;
  reset: () => void;
}

export const useAppStore = create<AppStore>()(
  subscribeWithSelector((set, get) => {
    const initial = loadState();

    const persist = () => {
      const s = get();
      saveState({
        user: s.user,
        institutions: s.institutions,
        members: s.members,
        transactions: s.transactions,
        memberships: s.memberships,
        activeInstId: s.activeInstId,
        activeRole: s.activeRole,
        defaultCountry: s.defaultCountry,
        settings: s.settings,
      });
    };

    return {
      ...initial,
      persist,

      hydrate: () => {
        set(loadState());
      },

      reset: () => {
        set({
          user: null,
          institutions: [],
          members: {},
          transactions: {},
          memberships: [],
          activeInstId: null,
          activeRole: 'admin',
          settings: { vpsSyncEnabled: true, vpsSyncStartDate: null },
        });
      },

      setUser: (user) => { set({ user }); persist(); },

      setActiveRole: (activeRole) => { set({ activeRole }); persist(); },

      setActiveInst: (activeInstId) => { set({ activeInstId }); persist(); },

      setDefaultCountry: (defaultCountry) => { set({ defaultCountry }); persist(); },

      updateSettings: (patch) => {
        set(s => ({ settings: { ...s.settings, ...patch } }));
        persist();
      },

      // ── Institutions ────────────────────────────────────
      addInstitution: (inst) => {
        // Ensure new institution has status = 'active'
        const newInst = { ...inst, status: 'active' as const, archivedAt: undefined };
        set(s => ({ institutions: [...s.institutions, newInst] }));
        persist();
      },

      updateInstitution: (id, patch) => {
        set(s => ({
          institutions: s.institutions.map(i => i.id === id ? { ...i, ...patch } : i),
        }));
        persist();
      },

      deleteInstitution: (id) => {
        set(s => {
          const { [id]: _m, ...members } = s.members;
          const { [id]: _t, ...transactions } = s.transactions;
          return {
            institutions: s.institutions.filter(i => i.id !== id),
            members,
            transactions,
            activeInstId: s.activeInstId === id ? (s.institutions.find(i => i.id !== id)?.id ?? null) : s.activeInstId,
          };
        });
        persist();
      },

      // ── NEW: Archive / Restore / Permanent Delete ────────
      archiveInstitution: (id) => {
        set(s => ({
          institutions: s.institutions.map(i =>
            i.id === id
              ? { ...i, status: 'archived', archivedAt: new Date().toISOString() }
              : i
          ),
        }));
        persist();
      },

      restoreInstitution: (id) => {
        set(s => ({
          institutions: s.institutions.map(i =>
            i.id === id
              ? { ...i, status: 'active', archivedAt: undefined }
              : i
          ),
        }));
        persist();
      },

      permanentlyDeleteInstitution: (id) => {
        set(s => {
          // Remove members and transactions for this institution
          const { [id]: _m, ...restMembers } = s.members;
          const { [id]: _t, ...restTransactions } = s.transactions;
          return {
            institutions: s.institutions.filter(i => i.id !== id),
            members: restMembers,
            transactions: restTransactions,
            activeInstId: s.activeInstId === id ? (s.institutions.find(i => i.id !== id)?.id ?? null) : s.activeInstId,
          };
        });
        persist();
      },

      // ── Members ─────────────────────────────────────────
      getMembers: (instId) => get().members[instId] ?? [],

      addMember: (member) => {
        set(s => ({
          members: {
            ...s.members,
            [member.instId]: [...(s.members[member.instId] ?? []), member],
          },
        }));
        persist();
      },

      updateMember: (instId, memberId, patch) => {
        set(s => ({
          members: {
            ...s.members,
            [instId]: (s.members[instId] ?? []).map(m => m.id === memberId ? { ...m, ...patch } : m),
          },
        }));
        persist();
      },

      deleteMember: (instId, memberId) => {
        set(s => ({
          members: {
            ...s.members,
            [instId]: (s.members[instId] ?? []).filter(m => m.id !== memberId),
          },
          transactions: {
            ...s.transactions,
            [instId]: (s.transactions[instId] ?? []).filter(t => t.memberId !== memberId),
          },
        }));
        persist();
      },

      importMembers: (instId, members) => {
        set(s => ({
          members: {
            ...s.members,
            [instId]: [...(s.members[instId] ?? []), ...members],
          },
        }));
        persist();
      },

      // ── Transactions ─────────────────────────────────────
      getTransactions: (instId) => get().transactions[instId] ?? [],

      addTransaction: (tx) => {
        set(s => ({
          transactions: {
            ...s.transactions,
            [tx.instId]: [...(s.transactions[tx.instId] ?? []), tx],
          },
        }));
        persist();
      },

      deleteTransaction: (instId, txId) => {
        set(s => ({
          transactions: {
            ...s.transactions,
            [instId]: (s.transactions[instId] ?? []).filter(t => t.id !== txId),
          },
        }));
        persist();
      },

      // ── Memberships ──────────────────────────────────────
      addMembership: (ms) => {
        set(s => ({ memberships: [...s.memberships, ms] }));
        persist();
      },

      updateMembership: (id, patch) => {
        set(s => ({
          memberships: s.memberships.map(m => m.id === id ? { ...m, ...patch } : m),
        }));
        persist();
      },

      removeMembership: (id) => {
        set(s => ({ memberships: s.memberships.filter(m => m.id !== id) }));
        persist();
      },
    };
  }),
);