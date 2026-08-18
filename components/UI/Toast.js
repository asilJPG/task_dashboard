'use client';

import React, { useEffect, useState, useCallback } from 'react';

/**
 * Non-blocking feedback, replacing alert().
 *
 * Fired through a window event rather than a context provider so any component — including
 * hooks and plain functions — can report a result without threading props through the tree.
 */
export function showToast(message, type = 'info') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('tb-toast', { detail: { message, type } }));
}

const STYLES = {
  success: { icon: '✅', color: '#2ea043', bg: 'rgba(46, 160, 67, 0.12)' },
  error:   { icon: '⚠️', color: '#f85149', bg: 'rgba(248, 81, 73, 0.12)' },
  info:    { icon: 'ℹ️', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)' }
};

const VISIBLE_MS = 3600;

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const handle = (e) => {
      const { message, type } = e.detail || {};
      if (!message) return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts(prev => [...prev.slice(-2), { id, message, type: type || 'info' }]);
      setTimeout(() => dismiss(id), VISIBLE_MS);
    };

    window.addEventListener('tb-toast', handle);
    return () => window.removeEventListener('tb-toast', handle);
  }, [dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-host">
      {toasts.map(t => {
        const s = STYLES[t.type] || STYLES.info;
        return (
          <div
            key={t.id}
            className="toast"
            style={{ borderColor: s.color, background: s.bg }}
            onClick={() => dismiss(t.id)}
            role="status"
          >
            <span style={{ flexShrink: 0 }}>{s.icon}</span>
            <span style={{ flex: 1 }}>{t.message}</span>
            <span className="toast-close">×</span>
          </div>
        );
      })}
    </div>
  );
}
