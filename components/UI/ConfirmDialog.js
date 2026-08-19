'use client';

import React from 'react';
import { useModalBehavior } from '@/hooks/useModalBehavior';

/**
 * Confirmation for actions that cannot be undone.
 * Deleting a task used to happen on a single tap, with the delete button sitting right next to
 * "Изменить" — easy to hit by accident on a phone, and the task was gone for good.
 */
export default function ConfirmDialog({
  isOpen,
  title = 'Подтвердите действие',
  message,
  confirmLabel = 'Удалить',
  cancelLabel = 'Отмена',
  danger = true,
  onConfirm,
  onClose
}) {
  useModalBehavior(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ color: danger ? '#f85149' : 'var(--text-primary)' }}>
            {danger ? '🗑 ' : ''}{title}
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text-primary)' }}>
            {message}
          </div>
          {danger && (
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '10px' }}>
              Это действие нельзя отменить.
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>{cancelLabel}</button>
          <button
            type="button"
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={() => { onConfirm(); onClose(); }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
