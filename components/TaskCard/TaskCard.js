'use client';

import React from 'react';
import { getDeadlineStatus, getPriorityLabel, normalizeTags, getTaskNumber, getTaskTiming } from '@/lib/utils';

export default function TaskCard({ task, profiles = [], allTasks = [], onClick, draggable = true, onDragStart, onDragEnd, dragging }) {
  const creator = profiles.find(p => p.id === task.created_by);
  const assignee = profiles.find(p => p.id === task.assigned_to);
  const isDone = task.status === 'done';
  const deadlineStatus = !isDone ? getDeadlineStatus(task.deadline) : null;
  // How long the task was given vs how long it took — measured from the hand-in, so that a
  // slow acceptance never inflates the numbers.
  const timing = getTaskTiming(task);
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
      {/* Priority reads as a coloured dot rather than a filled pill: with difficulty, tags and
          the pin all competing for the top row, four badges made every card look alarming. */}
      <div className="task-card-header">
        <span className={`task-priority-dot priority-${task.priority}`} title={`Приоритет: ${getPriorityLabel(task.priority)}`}></span>
        <span className="task-card-number">№{taskNum}</span>
        {task.difficulty > 0 && (
          <span className="task-difficulty" title={`Сложность: ${task.difficulty} из 10`}>⚡{task.difficulty}</span>
        )}
        <span style={{ flex: 1 }}></span>
        {task.pinned && <span className="task-pin">📌</span>}
      </div>

      <h4 className="task-title">{task.title}</h4>
      {task.description && <p className="task-description">{task.description}</p>}

      {/* Tags appear once, here — they used to be repeated in the header as well. */}
      {tagsList.length > 0 && (
        <div className="task-tags">
          {tagsList.map(tag => (
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
        <div className={`task-timing ${deadlineStatus.class}`}>
          <span>{deadlineStatus.text}</span>
          {timing?.planned ? <span className="task-timing-muted">дано {timing.planned} дн</span> : null}
        </div>
      )}

      {isDone && timing?.actual && (
        <div className={`task-timing ${timing.overdue > 0 ? 'overdue' : 'safe'}`}>
          <span>Выполнено за {timing.actual} дн</span>
          {timing.planned ? <span className="task-timing-muted">из {timing.planned} дн</span> : null}
          {timing.overdue > 0 ? <span className="task-timing-late">просрочка {timing.overdue} дн</span> : null}
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
