import { create } from 'zustand';

export type ToastType = 'ok' | 'warn' | 'err' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface UIStore {
  toasts: Toast[];
  toast: (message: string, type?: ToastType) => void;
  dismissToast: (id: number) => void;

  // Active modal stack
  openModals: string[];
  openModal: (id: string) => void;
  closeModal: (id: string) => void;
  closeAllModals: () => void;
  isModalOpen: (id: string) => boolean;
}

let _toastId = 0;

export const useUIStore = create<UIStore>((set, get) => ({
  toasts: [],

  toast: (message, type = 'info') => {
    const id = ++_toastId;
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => get().dismissToast(id), 3000);
  },

  dismissToast: (id) => {
    set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
  },

  openModals: [],

  openModal: (id) => {
    set(s => ({
      openModals: s.openModals.includes(id) ? s.openModals : [...s.openModals, id],
    }));
  },

  closeModal: (id) => {
    set(s => ({ openModals: s.openModals.filter(m => m !== id) }));
  },

  closeAllModals: () => set({ openModals: [] }),

  isModalOpen: (id) => get().openModals.includes(id),
}));

// Convenience singleton outside React (for use in non-hook contexts)
export const toast = (message: string, type?: ToastType) =>
  useUIStore.getState().toast(message, type);
