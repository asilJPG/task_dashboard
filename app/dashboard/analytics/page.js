'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTasks } from '@/hooks/useTasks';
import { supabase } from '@/lib/supabase';
import { MONTH_NAMES, getEffectiveDate } from '@/lib/rating';

const ALL_TIME = 'all';

// Every status the donut and its legend cover, in display order.
const STATUS_META = [
  { id: 'new', label: 'Новые', color: '#6e7681' },
  { id: 'in_progress', label: 'В работе', color: '#1f6feb' },
  { id: 'stopped', label: 'На стопе', color: '#da3633' },
  { id: 'review', label: 'На рассмотрении', color: '#eab308' },
  { id: 'done', label: 'Готово', color: '#238636' }
];

export default function AnalyticsPage() {
  const { user, profile } = useAuth();
  const { tasks: allTasks } = useTasks(user?.id, profile);
  const canvasRef = useRef(null);
  const [profiles, setProfiles] = useState([]);

  const now = new Date();
  const [period, setPeriod] = useState({ mode: ALL_TIME, year: now.getFullYear(), month: now.getMonth() });

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase.from('tb_profiles').select('*');
      if (data) setProfiles(data);
    };
    fetchProfiles();
  }, []);

  // A task belongs to a month if it was created in it or finished in it, so the picture covers
  // both what came in and what was cleared — carry-over tasks included.
  const tasks = useMemo(() => {
    if (period.mode === ALL_TIME) return allTasks;
    const start = new Date(period.year, period.month, 1).getTime();
    const end = new Date(period.year, period.month + 1, 1).getTime();
    return allTasks.filter(t => {
      const created = t.created_at ? new Date(t.created_at).getTime() : null;
      const finishedDate = getEffectiveDate(t);
      const finished = finishedDate ? finishedDate.getTime() : null;
      const createdIn = created !== null && created >= start && created < end;
      const finishedIn = finished !== null && finished >= start && finished < end;
      return createdIn || finishedIn;
    });
  }, [allTasks, period]);

  // Months that actually have data, newest first — no empty periods in the picker.
  const availableMonths = useMemo(() => {
    const keys = new Set();
    allTasks.forEach(t => {
      [t.created_at, t.completed_at, t.submitted_at].forEach(raw => {
        if (!raw) return;
        const d = new Date(raw);
        if (!isNaN(d)) keys.add(`${d.getFullYear()}-${d.getMonth()}`);
      });
    });
    return [...keys]
      .map(k => { const [y, m] = k.split('-').map(Number); return { year: y, month: m }; })
      .sort((a, b) => b.year - a.year || b.month - a.month);
  }, [allTasks]);

  useEffect(() => {
    if (!canvasRef.current || tasks.length === 0) return;
    
    const ctx = canvasRef.current.getContext('2d');
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    ctx.clearRect(0, 0, width, height);

    const counts = STATUS_META.reduce((acc, s) => {
      acc[s.id] = tasks.filter(t => t.status === s.id).length;
      return acc;
    }, {});

    const colors = STATUS_META.reduce((acc, s) => {
      acc[s.id] = s.color;
      return acc;
    }, {});

    const total = tasks.length;
    let startAngle = -Math.PI / 2;

    Object.keys(counts).forEach(key => {
      const sliceAngle = (counts[key] / total) * 2 * Math.PI;
      if (sliceAngle > 0) {
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = colors[key];
        ctx.fill();
        startAngle += sliceAngle;
      }
    });

    // Draw inner circle for donut - matches card background
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.6, 0, 2 * Math.PI);
    ctx.fillStyle = '#161b22';
    ctx.fill();

    // Center text - light theme text for Dark Background
    ctx.fillStyle = '#e6edf3';
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(total.toString(), centerX, centerY - 10);
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#8d96a0';
    ctx.fillText('Задач', centerX, centerY + 15);

  }, [tasks]);

  const doneTasks = tasks.filter(t => t.status === 'done').length;
  const totalTasks = tasks.length;
  const overallProgress = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

  // Share of each status, shown next to its colour in the legend.
  const statusBreakdown = STATUS_META.map(s => {
    const count = tasks.filter(t => t.status === s.id).length;
    return { ...s, count, percent: totalTasks === 0 ? 0 : Math.round((count / totalTasks) * 100) };
  });

  const getOverdueTasks = () => {
    return tasks.filter(t => {
      if (t.status === 'done' || !t.deadline) return false;
      return new Date(t.deadline) < new Date();
    });
  };

  const overdueTasks = getOverdueTasks();

  const assigneeStats = profiles
    .filter(p => p.username !== 'admin' && !p.is_admin && p.role !== 'admin')
    .map(profile => {
      const assignedTasks = tasks.filter(t => t.assigned_to === profile.id || (Array.isArray(t.assignees) && t.assignees.includes(profile.id)));
      const completed = assignedTasks.filter(t => t.status === 'done').length;
      const progress = assignedTasks.length > 0 ? Math.round((completed / assignedTasks.length) * 100) : 0;

      const byStatus = STATUS_META.reduce((acc, s) => {
        acc[s.id] = assignedTasks.filter(t => t.status === s.id).length;
        return acc;
      }, {});
      const overdue = assignedTasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < new Date()).length;

      return { ...profile, assignedTasks, completed, progress, byStatus, overdue, unfinished: assignedTasks.length - completed };
    }).filter(p => p.assignedTasks.length > 0);

  // Weakest performer: lowest completion rate, and with equal rates the one sitting on more
  // unfinished work. Needs a couple of tasks to judge, otherwise a single open task wins it.
  const worstPerformer = [...assigneeStats]
    .filter(p => p.assignedTasks.length >= 2)
    .sort((a, b) => a.progress - b.progress || b.unfinished - a.unfinished)[0] || null;

  return (
    <div className="analytics-view">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>📊 Аналитика</h2>
        <select
          className="form-select"
          style={{ width: 'auto', padding: '8px 12px', fontSize: '13px', background: '#161b22' }}
          value={period.mode === ALL_TIME ? ALL_TIME : `${period.year}-${period.month}`}
          onChange={(e) => {
            if (e.target.value === ALL_TIME) {
              setPeriod(p => ({ ...p, mode: ALL_TIME }));
            } else {
              const [year, month] = e.target.value.split('-').map(Number);
              setPeriod({ mode: 'month', year, month });
            }
          }}
        >
          <option value={ALL_TIME}>📅 За всё время</option>
          {availableMonths.map(m => (
            <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
              {MONTH_NAMES[m.month]} {m.year}
            </option>
          ))}
        </select>
      </div>

      {period.mode !== ALL_TIME && (
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
          Показаны задачи, созданные или завершённые в этом месяце — {tasks.length} шт.
        </div>
      )}

      <div className="analytics-grid">
        <div className="analytics-card">
          <h3>Статусы задач</h3>
          <div className="analytics-chart-container">
            <canvas ref={canvasRef} width={200} height={200}></canvas>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px', fontSize: '12px' }}>
            {statusBreakdown.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: s.color, flexShrink: 0 }}></span>
                <span style={{ flex: 1 }}>{s.label}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{s.count}</span>
                <strong style={{ minWidth: '42px', textAlign: 'right', color: s.color }}>{s.percent}%</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="analytics-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h3 style={{ alignSelf: 'flex-start', width: '100%' }}>Общий прогресс</h3>
          <div style={{ width: '140px', height: '140px', borderRadius: '50%', background: `conic-gradient(#2ea043 ${overallProgress}%, #30363d ${overallProgress}%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '20px 0' }}>
            <div style={{ width: '110px', height: '110px', backgroundColor: '#161b22', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 'bold', color: '#e6edf3' }}>
              {overallProgress}%
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Выполнено {doneTasks} из {totalTasks} задач
          </div>
        </div>

        {worstPerformer && (
          <div className="analytics-card">
            <h3 style={{ color: '#db6d28', borderColor: 'rgba(219, 109, 40, 0.15)' }}>⚠️ Требует внимания</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div className="avatar-circle" style={{ backgroundColor: worstPerformer.color || 'var(--accent)', width: 36, height: 36, fontSize: 18 }}>
                {worstPerformer.avatar || '👤'}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{worstPerformer.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Самый низкий процент выполнения: {worstPerformer.progress}%
                </div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#db6d28', lineHeight: 1.1 }}>{worstPerformer.unfinished}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>не выполнено</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', fontSize: 12 }}>
              {STATUS_META.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: s.color, flexShrink: 0 }}></span>
                  <span style={{ flex: 1 }}>{s.label}</span>
                  <strong style={{ color: s.color }}>{worstPerformer.byStatus[s.id]}</strong>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '7px', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ width: 10, height: 10, flexShrink: 0 }}>🔴</span>
                <span style={{ flex: 1 }}>Из них просрочено</span>
                <strong style={{ color: '#f85149' }}>{worstPerformer.overdue}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: 10, height: 10, flexShrink: 0 }}>📋</span>
                <span style={{ flex: 1 }}>Всего назначено</span>
                <strong>{worstPerformer.assignedTasks.length}</strong>
              </div>
            </div>
          </div>
        )}

        <div className="analytics-card">
          <h3>Продуктивность команды</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {assigneeStats.map(stat => (
              <div key={stat.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <div className="avatar-circle" style={{ width: 22, height: 22, backgroundColor: stat.color, fontSize: 11 }}>{stat.avatar}</div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{stat.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)' }}>{stat.progress}% ({stat.completed}/{stat.assignedTasks.length})</span>
                </div>
                <div className="task-progress-bar">
                  <div className="task-progress-fill" style={{ width: `${stat.progress}%`, backgroundColor: '#2ea043' }}></div>
                </div>
              </div>
            ))}
            {assigneeStats.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Нет данных</div>}
          </div>
        </div>

        <div className="analytics-card">
          <h3 style={{ color: '#f85149', borderColor: 'rgba(248, 81, 73, 0.15)' }}>Просроченные задачи ({overdueTasks.length})</h3>
          <div className="overdue-tasks-list">
            {overdueTasks.map(task => {
              const daysOverdue = Math.max(1, Math.floor((new Date() - new Date(task.deadline)) / (1000 * 60 * 60 * 24)));
              return (
                <div key={task.id} className="overdue-item">
                  <div className="overdue-item-title">{task.title}</div>
                  <div className="overdue-item-badge">{daysOverdue} дн. просрочено</div>
                </div>
              );
            })}
            {overdueTasks.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Нет просроченных задач</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
