'use client';

import React from 'react';
import { formatDate } from '@/lib/utils';
import { RATING_CONFIG } from '@/lib/rating';

/** Human label + colour for a task's deadline outcome. */
function deadlineLabel(bucket, daysLate) {
  if (bucket === 'in_time') return { text: '🎯 В срок', color: '#34d399' };
  if (bucket === 'grace') return { text: `⏳ Просрочка ${daysLate} дн`, color: '#8d96a0' };
  if (bucket === 'late') return { text: `🔴 Просрочка ${daysLate} дн`, color: '#f85149' };
  return { text: '— без дедлайна', color: '#8d96a0' };
}

export default function EmployeeRatingModal({ isOpen, onClose, row, monthLabel }) {
  if (!isOpen || !row) return null;

  const { profile, breakdown = [], openTasks = [] } = row;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="avatar-circle" style={{ background: profile.color || 'var(--accent)', width: '26px', height: '26px', fontSize: '13px' }}>
              {profile.avatar || '👤'}
            </span>
            {profile.name}
            <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-secondary)' }}>— {monthLabel}</span>
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Totals */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <div style={{ flex: 1, minWidth: '110px', background: '#0d1117', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#38bdf8', lineHeight: 1.1 }}>{row.score}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>баллов за месяц</div>
            </div>
            <div style={{ flex: 1, minWidth: '110px', background: '#0d1117', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#f59e0b', lineHeight: 1.1 }}>{row.difficultySum}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>сумма сложности</div>
            </div>
            <div style={{ flex: 1, minWidth: '110px', background: '#0d1117', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, lineHeight: 1.1, color: row.timeBonusSum > 0 ? '#34d399' : row.timeBonusSum < 0 ? '#f85149' : '#8d96a0' }}>
                {row.timeBonusSum > 0 ? `+${row.timeBonusSum}` : row.timeBonusSum}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>баллов за сроки</div>
            </div>
            <div style={{ flex: 1, minWidth: '110px', background: '#0d1117', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#38bdf8', lineHeight: 1.1 }}>{row.qualitySum}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>баллов за качество</div>
            </div>
            <div style={{ flex: 1, minWidth: '110px', background: '#0d1117', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#34d399', lineHeight: 1.1 }}>{row.closedCount}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>принято из {row.totalTasks}</div>
            </div>
          </div>

          {/* Closed tasks: where every point came from */}
          <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            ✅ Закрытые задачи ({breakdown.length})
          </h4>

          {breakdown.length === 0 && (
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, padding: '12px 0' }}>
              В этом месяце нет закрытых задач.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '22px' }}>
            {breakdown.map(item => {
              const dl = deadlineLabel(item.bucket, item.daysLate);
              return (
                <div
                  key={item.task.id}
                  style={{
                    padding: '10px 12px',
                    background: '#0d1117',
                    border: `1px solid ${item.rated ? 'var(--border-color)' : 'rgba(219, 109, 40, 0.35)'}`,
                    borderRadius: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '11px' }}>№{item.task.task_number}</span>
                    <span style={{ flex: 1, minWidth: '120px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.task.title}
                    </span>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: item.rated ? '#38bdf8' : '#db6d28' }}>
                      {item.rated ? `${item.points} балл.` : '0 балл.'}
                    </span>
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {item.rated ? (
                      <span>
                        ⚡ Сложность <strong style={{ color: '#f59e0b' }}>{item.difficulty}</strong>
                        {' '}{item.bonus >= 0 ? '+' : '−'} срок <strong style={{ color: item.bonus > 0 ? '#34d399' : item.bonus < 0 ? '#f85149' : '#8d96a0' }}>{Math.abs(item.bonus)}</strong>
                        {item.quality > 0 && <> + качество <strong style={{ color: '#38bdf8' }}>{item.quality}</strong></>}
                        {' = '}<strong>{item.points}</strong>
                      </span>
                    ) : (
                      <span style={{ color: '#db6d28' }}>⚠️ Сложность не выставлена — задача не приносит баллов</span>
                    )}
                    {item.sharePercent < 100 && (
                      <span style={{ color: '#a78bfa' }}>👥 Доля в команде: {item.sharePercent}%</span>
                    )}
                    <span style={{ color: dl.color }}>{dl.text}</span>
                    {item.task.deadline && <span>📅 Дедлайн: {formatDate(item.task.deadline)}</span>}
                    <span>🏁 Закрыта: {formatDate(item.completedAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Still open — they do not cost points, but explain the closed/total figure */}
          <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            ⏳ Незакрытые на конец месяца ({openTasks.length})
          </h4>

          {openTasks.length === 0 && (
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, padding: '4px 0 12px' }}>
              Незакрытых задач нет.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {openTasks.map(task => (
              <div
                key={task.id}
                style={{ padding: '8px 12px', background: '#0d1117', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}
              >
                <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '11px' }}>№{task.task_number}</span>
                <span style={{ flex: 1, minWidth: '120px', fontSize: '12px', color: 'var(--text-primary)' }}>{task.title}</span>
                <span className={`status-badge ${task.status}`} style={{ fontSize: '10px', margin: 0 }}>
                  {task.status === 'new' ? 'Новая' : task.status === 'in_progress' ? 'В работе' : task.status === 'stopped' ? 'Стоп' : 'Готово'}
                </span>
                {task.difficulty > 0 && (
                  <span style={{ fontSize: '11px', color: '#f59e0b' }}>⚡ {task.difficulty}</span>
                )}
              </div>
            ))}
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '18px', lineHeight: 1.6 }}>
            Баллы за задачу = сложность + балл за срок + качество. Срок: в срок <strong>+{RATING_CONFIG.IN_TIME_BONUS}</strong>,
            просрочка до {RATING_CONFIG.GRACE_DAYS} дней <strong>{RATING_CONFIG.GRACE_BONUS}</strong>,
            больше {RATING_CONFIG.GRACE_DAYS} дней <strong>{RATING_CONFIG.LATE_PENALTY}</strong>.
            Срок считается по дате сдачи на проверку, а не по дате приёмки.
            В командных задачах баллы делятся по долям. Незакрытые задачи баллы не отнимают.
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary btn-full" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}
