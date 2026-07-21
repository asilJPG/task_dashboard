'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTasks } from '@/hooks/useTasks';
import { supabase } from '@/lib/supabase';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { tasks } = useTasks(user?.id);
  const canvasRef = useRef(null);
  const [profiles, setProfiles] = useState([]);

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase.from('tb_profiles').select('*');
      if (data) setProfiles(data);
    };
    fetchProfiles();
  }, []);

  useEffect(() => {
    if (!canvasRef.current || tasks.length === 0) return;
    
    const ctx = canvasRef.current.getContext('2d');
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    ctx.clearRect(0, 0, width, height);

    const counts = {
      new: tasks.filter(t => t.status === 'new').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      stopped: tasks.filter(t => t.status === 'stopped').length,
      done: tasks.filter(t => t.status === 'done').length,
    };

    const colors = {
      new: '#6e7681',
      in_progress: '#1f6feb',
      stopped: '#da3633',
      done: '#238636'
    };

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

  const getOverdueTasks = () => {
    return tasks.filter(t => {
      if (t.status === 'done' || !t.deadline) return false;
      return new Date(t.deadline) < new Date();
    });
  };

  const overdueTasks = getOverdueTasks();

  const assigneeStats = profiles.map(profile => {
    const assignedTasks = tasks.filter(t => t.assigned_to === profile.id);
    const completed = assignedTasks.filter(t => t.status === 'done').length;
    const progress = assignedTasks.length > 0 ? Math.round((completed / assignedTasks.length) * 100) : 0;
    return { ...profile, assignedTasks, completed, progress };
  }).filter(p => p.assignedTasks.length > 0);

  return (
    <div className="analytics-view">
      <h2>📊 Аналитика</h2>

      <div className="analytics-grid">
        <div className="analytics-card">
          <h3>Статусы задач</h3>
          <div className="analytics-chart-container">
            <canvas ref={canvasRef} width={200} height={200}></canvas>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '16px', flexWrap: 'wrap', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#6e7681' }}></span>Новые</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#1f6feb' }}></span>В работе</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#da3633' }}></span>На стопе</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#238636' }}></span>Готово</div>
          </div>
        </div>

        <div className="analytics-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h3 style={{ alignSelf: 'flex-start', width: '100%' }}>Общий прогресс</h3>
          <div style={{ width: '140px', height: '140px', borderRadius: '50%', background: `conic-gradient(#2ea043 ${overallProgress}%, #30363d ${overallProgress}%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '20px 0' }}>
            <div style={{ width: '110px', height: '110px', backgroundColor: '#161b22', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 'bold', color: '#e6edf3' }}>
              {overallProgress}%
            </div>
          </div>
        </div>

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
