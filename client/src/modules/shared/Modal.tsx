import React, { useEffect } from 'react';
import { useUIStore } from '@/core/store/useUIStore';

interface ModalProps {
  id: string;
  title?: string;
  maxHeight?: string;
  isOpen?: boolean;
  open?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function Modal({  isOpen, onClose, id, title, children, maxHeight = '85vh' }: ModalProps) {
  const { isModalOpen, closeModal } = useUIStore();
  const open = isModalOpen(id);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(id); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [id, closeModal]);

  if (!open) return null;

  return (
    <div
      className="mo open"
      onClick={(e) => { if (e.target === e.currentTarget) closeModal(id); }}
    >
      <div className="mo-box" style={{ maxHeight, overflowY: 'auto' }}>
        <div className="mo-handle" />
        {title && <div className="mo-title">{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function useModal(id: string) {
  const { openModal, closeModal, isModalOpen } = useUIStore();
  return {
    open: () => openModal(id),
    close: () => closeModal(id),
    isOpen: isModalOpen(id),
  };
}
