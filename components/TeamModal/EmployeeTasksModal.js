'use client';

import React from 'react';
import TaskCard from '../TaskCard/TaskCard';

// Same order and colours as the analytics donut, so the two read as one picture.
const STATUS_SECTIONS = [
  { id: 'new', label: 'Новые', icon: '📋', color: '#6e7681' },
  { id: 'in_progress', label: 'В работе', icon: '🔄', color: '#1f6feb' },
  { id: 'stopped', label: 'На стопе', icon: '🛑', color: '#da3633' },
  { id: 'review', label: 'На рассмотрении', icon: '🔍', color: '#eab308' },
  { id: 'done', label: 'Готово', icon: '✅', color: '#238636' }
];

export default function EmployeeTasksModal({ isOpen, onClose, employee, tasks = [], profiles = [], periodLabel }) {
  if (!isOpen || !employee) return null;

  const done = tasks.filter(t => t.status === 'done').length;
  const percent = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
  const overdue = tasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < new Date()).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="avatar-circle" style={{ background: employee.color || 'var(--accent)', width: '26px', height: '26px', fontSize: '13px' }}>
              {employee.avatar || '👤'}
            </span>
            {employee.name}
            {periodLabel && (
              <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-secondary)' }}>— {periodLabel}</span>
            )}
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Headline numbers */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <div style={{ flex: 1, minWidth: '104px', background: '#0d1117', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#2ea043', lineHeight: 1.1 }}>{percent}%</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>выполнено</div>
            </div>
            <div style={{ flex: 1, minWidth: '104px', background: '#0d1117', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#e6edf3', lineHeight: 1.1 }}>{tasks.length}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>всего задач</div>
            </div>
            <div style={{ flex: 1, minWidth: '104px', background: '#0d1117', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#db6d28', lineHeight: 1.1 }}>{tasks.length - done}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>не выполнено</div>
            </div>
            <div style={{ flex: 1, minWidth: '104px', background: '#0d1117', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: overdue > 0 ? '#f85149' : '#8d96a0', lineHeight: 1.1 }}>{overdue}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>просрочено</div>
            </div>
          </div>

          {tasks.length === 0 && (
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
              У сотрудника нет задач за этот период.
            </div>
          )}

          {/* One section per status; empty ones are skipped */}
          {STATUS_SECTIONS.map(section => {
            const sectionTasks = tasks.filter(t => t.status === section.id);
            if (sectionTasks.length === 0) return null;

            return (
              <div key={section.id} style={{ marginBottom: '22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', paddingBottom: '6px', borderBottom: `1px solid ${section.color}40` }}>
                  <span>{section.icon}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: section.color }}>{section.label}</span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '1px 8px',
                    borderRadius: '10px',
                    background: `${section.color}25`,
                    color: section.color,
                    border: `1px solid ${section.color}50`
                  }}>
                    {sectionTasks.length}
                  </span>
                </div>

                <div className="group-tasks-grid">
                  {sectionTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      profiles={profiles}
                      allTasks={tasks}
                      onClick={() => {}}
                      draggable={false}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary btn-full" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}
