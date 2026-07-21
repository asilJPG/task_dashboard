'use client';

import React from 'react';
import { getDeadlineStatus, getPriorityLabel } from '@/lib/utils';

export default function TaskCard({ task, profiles = [], onClick, draggable = true, onDragStart, onDragEnd, dragging }) {
  const creator = profiles.find(p => p.id === task.created_by);
  const assignee = profiles.find(p => p.id === task.assigned_to);
  const deadlineStatus = getDeadlineStatus(task.deadline);

  return (
    <div 
      className={`task-card ${task.pinned ? 'pinned' : ''} ${dragging ? 'dragging' : ''}`} 
      draggable={draggable} 
      onClick={() => onClick(task)}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="task-card-header">
        <span className={`task-priority priority-${task.priority}`}>{getPriorityLabel(task.priority)}</span>
        {task.pinned && <span className="task-pin">📌</span>}
      </div>
      <h4 className="task-title">{task.title}</h4>
      {task.description && <p className="task-description">{task.description}</p>}
      
      {task.tags?.length > 0 && (
        <div className="task-tags">
          {task.tags.map(tag => (
            <span key={tag} className="task-tag">{tag}</span>
          ))}
        </div>
      )}

      <div className="task-progress">
        <div className="task-progress-bar">
          <div className="task-progress-fill" style={{ width: `${task.progress || 0}%` }}></div>
        </div>
        <span className="task-progress-text">{task.progress || 0}%</span>
      </div>

      {deadlineStatus && (
        <div className={`task-deadline ${deadlineStatus.class}`}>
          📅 {deadlineStatus.text}
        </div>
      )}
      
      {task.status === 'stopped' && task.stop_reason && (
        <div className="task-stop-reason">🛑 {task.stop_reason}</div>
      )}

      <div className="task-footer">
        <div className="task-avatars">
          <span className="avatar-circle" style={{ background: creator?.color || 'var(--accent)' }} title={`Создал: ${creator?.name || 'Автор'}`}>
            {creator?.avatar || '👤'}
          </span>
          <span className="avatar-arrow">→</span>
          <span className="avatar-circle" style={{ background: assignee?.color || 'var(--accent)' }} title={`Исполнитель: ${assignee?.name || 'Исполнитель'}`}>
            {assignee?.avatar || '👤'}
          </span>
        </div>
        <span className="task-comments-count">💬 {task.comments_count || 0}</span>
      </div>
    </div>
  );
}
