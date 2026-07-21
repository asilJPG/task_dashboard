'use client';

import React, { useState } from 'react';
import { formatRelativeTime, getPriorityLabel, getStatusLabel } from '@/lib/utils';

export default function TaskDetailModal({ 
  isOpen, onClose, task, profiles = [], comments = [], history = [], 
  onEdit, onDelete, onComment, onStatusChange, onProgressChange, onTogglePin 
}) {
  const [commentText, setCommentText] = useState('');

  if (!isOpen || !task) return null;

  const creator = profiles.find(p => p.id === task.created_by);
  const assignee = profiles.find(p => p.id === task.assigned_to);

  const handleCommentSubmit = () => {
    if (commentText.trim()) {
      onComment(task.id, commentText.trim());
      setCommentText('');
    }
  };

  const formatHistoryAction = (action, details) => {
    const map = {
      created: 'создал задачу',
      updated: 'обновил задачу',
      status_changed: details ? `изменил статус: ${details}` : 'изменил статус',
      progress_updated: 'обновил прогресс',
      comment_added: 'добавил комментарий'
    };
    return map[action] || action;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{task.title} {task.pinned && '📌'}</h3>
          <div className="modal-header-actions">
            <button className="btn btn-sm btn-secondary" onClick={() => onTogglePin(task.id)}>
              {task.pinned ? '📍 Открепить' : '📌 Закрепить'}
            </button>
            <button className="btn btn-sm btn-secondary" onClick={() => onEdit(task)}>✏️ Изменить</button>
            <button className="btn btn-sm btn-danger" onClick={() => onDelete(task.id)}>🗑 Удалить</button>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="modal-body">
          <div className="task-detail-meta">
            <div className="detail-row">
              <span className="detail-label">Статус:</span>
              <span className={`status-badge ${task.status}`}>{getStatusLabel(task.status)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Приоритет:</span>
              <span className={`task-priority priority-${task.priority}`} style={{ border: '1px solid currentColor' }}>
                {getPriorityLabel(task.priority)}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Создатель:</span>
              <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="avatar-circle" style={{ background: creator?.color, width: '18px', height: '18px', fontSize: '10px' }}>
                  {creator?.avatar || '👤'}
                </span>
                {creator?.name || 'Заказчик'}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Исполнитель:</span>
              <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="avatar-circle" style={{ background: assignee?.color, width: '18px', height: '18px', fontSize: '10px' }}>
                  {assignee?.avatar || '👤'}
                </span>
                {assignee?.name || 'Не назначен'}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Дедлайн:</span>
              <span className="detail-value">{task.deadline || 'Не указан'}</span>
            </div>
          </div>

          {task.description && (
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Описание</h4>
              <p style={{ fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{task.description}</p>
            </div>
          )}

          <div className="detail-row" style={{ marginBottom: '20px' }}>
            <span className="detail-label">Прогресс ({task.progress || 0}%):</span>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input 
                type="range" 
                min="0" max="100" 
                value={task.progress || 0}
                onChange={(e) => onProgressChange(task.id, Number(e.target.value))}
                className="form-range"
                style={{ flex: 1, margin: 0 }}
              />
            </div>
          </div>

          {task.tags?.length > 0 && (
            <div className="detail-row" style={{ marginBottom: '20px' }}>
              <span className="detail-label">Теги:</span>
              <div className="task-tags">
                {task.tags.map(t => <span key={t} className="task-tag">{t}</span>)}
              </div>
            </div>
          )}

          {task.status === 'stopped' && task.stop_reason && (
            <div className="task-stop-reason" style={{ marginBottom: '20px' }}>
              <strong>Причина остановки:</strong> {task.stop_reason}
            </div>
          )}

          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Быстрая смена статуса</h4>
            <div className="detail-actions-row">
              <button className="btn btn-sm btn-secondary" onClick={() => onStatusChange(task.id, 'new')}>📋 В новые</button>
              <button className="btn btn-sm btn-secondary" onClick={() => onStatusChange(task.id, 'in_progress')}>🔄 В работу</button>
              <button className="btn btn-sm btn-secondary" onClick={() => onStatusChange(task.id, 'stopped')}>🛑 На стоп</button>
              <button className="btn btn-sm btn-secondary" onClick={() => onStatusChange(task.id, 'done')}>✅ Выполнено</button>
            </div>
          </div>

          <div className="comments-section">
            <h3>💬 Комментарии</h3>
            <div className="comments-list">
              {comments.length === 0 && (
                <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                  Нет комментариев. Оставьте первый!
                </div>
              )}
              {comments.map(c => {
                const commenter = profiles.find(p => p.id === c.user_id);
                return (
                  <div key={c.id} className="comment">
                    <span className="comment-avatar" style={{ backgroundColor: commenter?.color || 'var(--accent)' }}>
                      {commenter?.avatar || '👤'}
                    </span>
                    <div className="comment-content">
                      <div className="comment-header">
                        <span className="comment-author">{commenter?.name || 'Пользователь'}</span>
                        <span className="comment-time">{formatRelativeTime(c.created_at)}</span>
                      </div>
                      <div className="comment-text">{c.text}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="comment-input-area" style={{ marginTop: '12px' }}>
              <input 
                className="form-input"
                style={{ flex: 1 }}
                value={commentText} 
                onChange={(e) => setCommentText(e.target.value)} 
                onKeyDown={(e) => { if (e.key === 'Enter') handleCommentSubmit(); }}
                placeholder="Написать комментарий... (Enter)"
              />
              <button className="btn btn-primary" onClick={handleCommentSubmit}>Отправить</button>
            </div>
          </div>

          <div className="history-section">
            <h3>📜 История изменений</h3>
            <div className="history-list">
              {history.length === 0 && (
                <div style={{ padding: '8px', color: 'var(--text-secondary)', fontSize: '11px' }}>
                  История пуста.
                </div>
              )}
              {history.map(h => {
                const actor = profiles.find(p => p.id === h.user_id);
                return (
                  <div key={h.id} className="history-item">
                    <div className="history-dot" style={{ backgroundColor: actor?.color || 'var(--accent)' }}></div>
                    <div className="history-content">
                      <span className="history-text">
                        <strong>{actor?.name || 'Пользователь'}</strong> {formatHistoryAction(h.action, h.details)}
                      </span>
                      <div className="history-time">{formatRelativeTime(h.created_at)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
