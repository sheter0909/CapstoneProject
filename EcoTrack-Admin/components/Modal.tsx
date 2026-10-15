'use client';

import React, { useEffect } from 'react';

interface Action {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'danger' | 'default';
  disabled?: boolean;
}

interface ModalProps {
  open: boolean;
  title: string;
  message?: string;
  children?: React.ReactNode;
  actions?: Action[];
  onClose?: () => void;
}

export default function Modal({ open, title, message, children, actions = [], onClose }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="fixed inset-0 cursor-pointer bg-black opacity-40" onClick={onClose} />

      <div className="bg-white w-full max-w-lg rounded-lg shadow-lg p-6 z-10">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          {message && <p className="text-sm text-gray-600 mt-2">{message}</p>}
        </div>

        {children}

        <div className="mt-6 flex justify-end space-x-3">
          {actions.map((a, idx) => (
            <button
              key={idx}
              onClick={a.onClick}
              disabled={a.disabled}
              className={
                'px-4 py-2 rounded-md font-semibold transition ' +
                (a.variant === 'primary'
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : a.variant === 'danger'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200') +
                (a.disabled ? ' opacity-50 cursor-not-allowed' : '')
              }
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
