'use client';

import React from 'react';

export default function TeamModal({ isOpen, onClose, profiles = [], tasks = [], currentUserId, onSelectEmployee }) {
  if (!isOpen) return null;

  // Filter out admin and current user
  const teamMembers = profiles.filter(p => 
    p.username !== 'admin' && 
    !p.is_admin && 
    p.role !== 'admin' && 
    p.id !== currentUserId
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>👥 Команда компании ({teamMembers.length})</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {teamMembers.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Сотрудники не найдены.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {teamMembers.map(member => {
                const memberTasks = tasks.filter(t => 
                  t.assigned_to === member.id || 
                  (Array.isArray(t.assignees) && t.assignees.includes(member.id)) ||
                  t.responsible_id === member.id
                );
                const inProgressCount = memberTasks.filter(t => t.status === 'in_progress').length;
                const doneCount = memberTasks.filter(t => t.status === 'done').length;

                return (
                  <div 
                    key={member.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      background: '#0d1117',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px'
                    }}
                  >
                    <div 
                      className="avatar-circle" 
                      style={{ 
                        backgroundColor: member.color || 'var(--accent)', 
                        width: '36px', 
                        height: '36px', 
                        fontSize: '18px',
                        flexShrink: 0
                      }}
                    >
                      {member.avatar || '👤'}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-primary)' }}>
                        {member.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        @{member.username || member.email?.split('@')[0]}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '8px' }}>
                        <span>🔄 В работе: <strong style={{ color: '#a78bfa' }}>{inProgressCount}</strong></span>
                        <span>✅ Готово: <strong style={{ color: '#34d399' }}>{doneCount}</strong></span>
                      </div>
                    </div>

                    {onSelectEmployee && (
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        style={{ fontSize: '11px', padding: '6px 12px' }}
                        onClick={() => {
                          onSelectEmployee(member.id);
                          onClose();
                        }}
                      >
                        Задачи →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary btn-full" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
