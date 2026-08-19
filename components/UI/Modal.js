'use client';

import React from 'react';
import { useModalBehavior } from '@/hooks/useModalBehavior';

export default function Modal({ isOpen, onClose, children, size = 'md' }) {
  useModalBehavior(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal modal-${size} fadeIn`} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
