'use client';

import React, { useState, useEffect } from 'react';
import { formatRelativeTime, getPriorityLabel, getStatusLabel } from '@/lib/utils';

export default function TaskDetailModal({
  isOpen, onClose, task, profiles = [], comments = [], history = [],
  onEdit, onDelete, onComment, onStatusChange, onProgressChange, onTogglePin,
  onDifficultyChange, onQualityChange, onSharesChange,
  currentUserId
}) {
  const [commentText, setCommentText] = useState('');
  const [localProgress, setLocalProgress] = useState(task?.progress || 0);

  useEffect(() => {
    if (task) {
      setLocalProgress(task.progress || 0);
    }
  }, [task?.progress]);

  if (!isOpen || !task) return null;

  const creator = profiles.find(p => p.id === task.created_by);
  const assignee = profiles.find(p => p.id === task.assigned_to);
  const responsibleUser = profiles.find(p => p.id === (task.responsible_id || task.assigned_to));

  const assigneesList = Array.isArray(task.assignees) && task.assignees.length > 0
    ? task.assignees.map(id => profiles.find(p => p.id === id)).filter(Boolean)
    : (assignee ? [assignee] : []);

  const currentUserProfile = profiles.find(p => p.id === currentUserId);
  const canEditOrDelete = task.created_by === currentUserId || currentUserProfile?.is_admin || currentUserProfile?.role === 'admin';
  const canChangeStatusOrProgress = currentUserId === (task.responsible_id || task.assigned_to) || currentUserId === task.created_by || currentUserProfile?.is_admin || currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'manager';
  // Difficulty drives the monthly rating, so only managers/admins may set it — at any time,
  // including on tasks that are already closed.
  const canSetDifficulty = currentUserProfile?.is_admin || currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'manager';
  // Only a manager closes a task: the assignee hands it in for review instead.
  const canAcceptTask = canSetDifficulty;

  // Shown percentages: the manager's split when set, an even division otherwise.
  const sharePercents = {};
  if (task.assignee_shares && typeof task.assignee_shares === 'object') {
    assigneesList.forEach(a => { sharePercents[a.id] = Number(task.assignee_shares[a.id]) || 0; });
  } else {
    const even = assigneesList.length > 0 ? Math.round(100 / assigneesList.length) : 0;
    assigneesList.forEach(a => { sharePercents[a.id] = even; });
  }
  const sharesTotal = Object.values(sharePercents).reduce((sum, v) => sum + v, 0);

  const handleShareChange = (userId, rawValue) => {
    const next = { ...sharePercents, [userId]: Math.max(0, Math.min(100, Number(rawValue) || 0)) };
    onSharesChange(next);
  };

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
          <h3>
            <span style={{ color: '#38bdf8', marginRight: '6px' }}>№{task.task_number || task.id?.slice(0, 5)} —</span>
            {task.title} {task.pinned && '📌'}
          </h3>
          <div className="modal-header-actions">
            <button className="btn btn-sm btn-secondary" onClick={() => onTogglePin(task.id)}>
              {task.pinned ? '📍 Открепить' : '📌 Закрепить'}
            </button>
            {canEditOrDelete && (
              <>
                <button className="btn btn-sm btn-secondary" onClick={() => onEdit(task)}>✏️ Изменить</button>
                <button className="btn btn-sm btn-danger" onClick={() => onDelete(task.id)}>🗑 Удалить</button>
              </>
            )}
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
              <span className="detail-label">Исполнители ({assigneesList.length}):</span>
              <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {assigneesList.map(a => (
                  <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#161b22', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>
                    <span className="avatar-circle" style={{ background: a.color, width: '16px', height: '16px', fontSize: '9px' }}>
                      {a.avatar || '👤'}
                    </span>
                    {a.name}
                    {a.id === responsibleUser?.id && <span style={{ color: '#f59e0b', fontSize: '10px', marginLeft: '2px' }}>👑</span>}
                  </span>
                ))}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Ответственный:</span>
              <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', color: '#38bdf8' }}>
                <span className="avatar-circle" style={{ background: responsibleUser?.color, width: '18px', height: '18px', fontSize: '10px' }}>
                  {responsibleUser?.avatar || '👑'}
                </span>
                {responsibleUser?.name || 'Не назначен'} (Отвечает за прогресс)
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

          {!canChangeStatusOrProgress && (
            <div style={{ background: 'rgba(219, 109, 40, 0.1)', border: '1px solid rgba(219, 109, 40, 0.2)', color: '#db6d28', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🔒</span>
              <span>Изменять статус и прогресс этой задачи может только ответственный: <strong>{responsibleUser?.name || 'Загрузка...'}</strong>. Вы можете оставлять комментарии и общаться в чате задачи ниже!</span>
            </div>
          )}

          <div className="detail-row" style={{ marginBottom: '20px', opacity: canChangeStatusOrProgress ? 1 : 0.5, pointerEvents: canChangeStatusOrProgress ? 'auto' : 'none' }}>
            <span className="detail-label">Прогресс ({localProgress}%):</span>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {[0, 25, 50, 75, 100].map(val => (
                <button
                  type="button"
                  key={val}
                  className={`btn btn-sm ${localProgress === val ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 12px', fontSize: '12px' }}
                  onClick={() => {
                    setLocalProgress(val);
                    onProgressChange(val);
                  }}
                  disabled={!canChangeStatusOrProgress}
                >
                  {val}%
                </button>
              ))}
            </div>
          </div>

          {canSetDifficulty && onDifficultyChange ? (
            <div className="detail-row" style={{ marginBottom: '20px', flexWrap: 'wrap' }}>
              <span className="detail-label">
                Сложность {task.difficulty ? `(${task.difficulty}/10)` : '(не оценена)'}:
              </span>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => (
                  <button
                    type="button"
                    key={val}
                    className={`btn btn-sm ${task.difficulty === val ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                    onClick={() => onDifficultyChange(val)}
                  >
                    {val}
                  </button>
                ))}
                {task.difficulty > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '11px', marginLeft: '4px' }}
                    onClick={() => onDifficultyChange(null)}
                  >
                    Сбросить
                  </button>
                )}
              </div>
              <div style={{ width: '100%', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                ⚡ Влияет на рейтинг сотрудника. Без оценки задача не приносит баллов.
              </div>
            </div>
          ) : (
            <div className="detail-row" style={{ marginBottom: '20px' }}>
              <span className="detail-label">Сложность:</span>
              <span className="detail-value">
                {task.difficulty > 0 ? `⚡ ${task.difficulty} из 10` : 'Не оценена руководителем'}
              </span>
            </div>
          )}

          {/* Team split: how the task's points are divided between assignees */}
          {assigneesList.length > 1 && (
            <div className="detail-row" style={{ marginBottom: '20px', flexWrap: 'wrap' }}>
              <span className="detail-label">Вклад в команде:</span>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px' }}>
                {assigneesList.map(a => {
                  const percent = sharePercents[a.id];
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="avatar-circle" style={{ background: a.color, width: '18px', height: '18px', fontSize: '10px', flexShrink: 0 }}>
                        {a.avatar || '👤'}
                      </span>
                      <span style={{ fontSize: '12px', flex: 1, minWidth: '70px' }}>{a.name}</span>
                      {canSetDifficulty && onSharesChange ? (
                        <>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="form-input"
                            style={{ width: '70px', padding: '4px 8px', fontSize: '12px' }}
                            value={percent}
                            onChange={(e) => handleShareChange(a.id, e.target.value)}
                          />
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>%</span>
                        </>
                      ) : (
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8' }}>{percent}%</span>
                      )}
                    </div>
                  );
                })}
                <div style={{ fontSize: '11px', color: sharesTotal === 100 ? 'var(--text-secondary)' : '#db6d28' }}>
                  {task.assignee_shares
                    ? `Сумма: ${sharesTotal}%${sharesTotal === 100 ? '' : ' — доли пересчитываются пропорционально'}`
                    : 'Проценты не заданы — баллы делятся поровну.'}
                </div>
              </div>
            </div>
          )}

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

          <div style={{ marginBottom: '24px', opacity: canChangeStatusOrProgress ? 1 : 0.5, pointerEvents: canChangeStatusOrProgress ? 'auto' : 'none' }}>
            <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Быстрая смена статуса</h4>
            <div className="detail-actions-row">
              <button 
                type="button"
                className={`btn btn-sm ${task.status === 'new' ? 'btn-primary' : 'btn-secondary'}`} 
                onClick={() => onStatusChange('new')}
                disabled={!canChangeStatusOrProgress}
              >
                📋 В новые
              </button>
              <button 
                type="button"
                className={`btn btn-sm ${task.status === 'in_progress' ? 'btn-primary' : 'btn-secondary'}`} 
                onClick={() => onStatusChange('in_progress')}
                disabled={!canChangeStatusOrProgress}
              >
                🔄 В работу
              </button>
              <button
                type="button"
                className={`btn btn-sm ${task.status === 'stopped' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => onStatusChange('stopped')}
                disabled={!canChangeStatusOrProgress}
              >
                🛑 На стоп
              </button>
              <button
                type="button"
                className={`btn btn-sm ${task.status === 'review' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => onStatusChange('review')}
                disabled={!canChangeStatusOrProgress}
                title="Сдать выполненную работу руководителю на проверку"
              >
                🔍 Сдать на проверку
              </button>
              <button
                type="button"
                className={`btn btn-sm ${task.status === 'done' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => onStatusChange('done')}
                disabled={!canChangeStatusOrProgress || !canAcceptTask}
                title={canAcceptTask ? 'Принять работу' : 'Принимать задачу может только руководитель'}
              >
                ✅ Принять
              </button>
            </div>
            {!canAcceptTask && (
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                Закончив работу, нажмите «🔍 Сдать на проверку» — принять задачу может только руководитель.
              </div>
            )}
          </div>

          {/* Review queue: accept the work and score its quality, or send it back */}
          {task.status === 'review' && canAcceptTask && (
            <div style={{ background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '10px', padding: '14px', marginBottom: '24px' }}>
              <h4 style={{ fontSize: '13px', color: '#eab308', marginBottom: '10px' }}>🔍 Задача ждёт вашей приёмки</h4>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Оцените качество работы, затем примите задачу или верните её на доработку.
              </div>
              <div className="detail-actions-row">
                <button type="button" className="btn btn-sm btn-primary" onClick={() => onStatusChange('done')}>
                  ✅ Принять работу
                </button>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => onStatusChange('in_progress')}>
                  ↩️ Вернуть на доработку
                </button>
              </div>
            </div>
          )}

          {/* Quality 1-5, judged by a manager */}
          {canSetDifficulty && onQualityChange ? (
            <div className="detail-row" style={{ marginBottom: '20px', flexWrap: 'wrap' }}>
              <span className="detail-label">
                Качество {task.quality ? `(${task.quality}/5)` : '(не оценено)'}:
              </span>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                {[1, 2, 3, 4, 5].map(val => (
                  <button
                    type="button"
                    key={val}
                    className={`btn btn-sm ${task.quality === val ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '4px 12px', fontSize: '12px' }}
                    onClick={() => onQualityChange(val)}
                  >
                    {val}
                  </button>
                ))}
                {task.quality > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '11px', marginLeft: '4px' }}
                    onClick={() => onQualityChange(null)}
                  >
                    Сбросить
                  </button>
                )}
              </div>
              <div style={{ width: '100%', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                ⭐ Добавляется к баллам сотрудника вместе со сложностью.
              </div>
            </div>
          ) : (
            <div className="detail-row" style={{ marginBottom: '20px' }}>
              <span className="detail-label">Качество:</span>
              <span className="detail-value">
                {task.quality > 0 ? `⭐ ${task.quality} из 5` : 'Не оценено руководителем'}
              </span>
            </div>
          )}

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
