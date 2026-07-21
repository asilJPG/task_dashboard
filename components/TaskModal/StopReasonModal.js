'use client';

import React, { useState } from 'react';

export default function StopReasonModal({ isOpen, onClose, onConfirm }) {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm(reason.trim());
      setReason('');
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🛑 Причина остановки</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p>Укажите причину, почему задача заблокирована:</p>
          <textarea 
            className="form-textarea" 
            value={reason} 
            onChange={(e) => setReason(e.target.value)}
            placeholder="Опишите причину..."
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-danger" onClick={handleConfirm}>Остановить задачу</button>
        </div>
      </div>
    </div>
  );
}
