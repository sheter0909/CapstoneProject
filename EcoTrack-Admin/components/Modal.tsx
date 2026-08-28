'use client';

import React from 'react';

interface Action {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'danger' | 'default';
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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black opacity-40" onClick={onClose} />

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
              className={
                'px-4 py-2 rounded-md font-semibold ' +
                (a.variant === 'primary'
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : a.variant === 'danger'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200')
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
