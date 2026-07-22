'use client';

import React from 'react';
import { getDeadlineStatus, getPriorityLabel, normalizeTags, getTaskNumber } from '@/lib/utils';

export default function TaskCard({ task, profiles = [], allTasks = [], onClick, draggable = true, onDragStart, onDragEnd, dragging }) {
  const creator = profiles.find(p => p.id === task.created_by);
  const assignee = profiles.find(p => p.id === task.assigned_to);
  const deadlineStatus = getDeadlineStatus(task.deadline);
  const tagsList = normalizeTags(task.tags);
  const taskNum = getTaskNumber(task, allTasks);

  return (
    <div 
      className={`task-card ${task.pinned ? 'pinned' : ''} ${dragging ? 'dragging' : ''}`} 
      draggable={draggable} 
      onClick={() => onClick(task)}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="task-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span className={`task-priority priority-${task.priority}`}>{getPriorityLabel(task.priority)}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {tagsList.length > 0 && (
            <span className="task-tag" style={{ margin: 0, fontSize: '10px', padding: '2px 7px', background: 'rgba(124, 58, 237, 0.2)', color: '#a78bfa', border: '1px solid rgba(124, 58, 237, 0.3)', borderRadius: '10px' }}>
              🏷️ {tagsList[0]} {tagsList.length > 1 ? `+${tagsList.length - 1}` : ''}
            </span>
          )}
          {task.pinned && <span className="task-pin" style={{ fontSize: '12px' }}>📌</span>}
        </div>
      </div>

      <h4 className="task-title">
        <span style={{ color: '#38bdf8', marginRight: '6px', fontWeight: 'bold' }}>№{taskNum}</span>
        {task.title}
      </h4>
      {task.description && <p className="task-description">{task.description}</p>}

      {tagsList.length > 0 && (
        <div className="task-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px', marginBottom: '8px' }}>
          {tagsList.map(tag => (
            <span key={tag} className="task-tag" style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(124, 58, 237, 0.15)', color: '#a78bfa', border: '1px solid rgba(124, 58, 237, 0.25)', borderRadius: '6px' }}>
              🏷️ {tag}
            </span>
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
