'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTasks } from '@/hooks/useTasks';
import TaskDetailModal from '@/components/TaskModal/TaskDetailModal';
import TaskCard from '@/components/TaskCard/TaskCard';
import { supabase } from '@/lib/supabase';

export default function AssignedTasksPage() {
  const { user } = useAuth();
  const { tasks, updateTask, changeStatus, deleteTask, addComment } = useTasks(user?.id);
  
  const [profiles, setProfiles] = useState([]);
  const [detailTask, setDetailTask] = useState(null);
  const [comments, setComments] = useState({});
  const [histories, setHistories] = useState({});

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase.from('tb_profiles').select('*');
      if (data) setProfiles(data);
    };
    fetchProfiles();
  }, []);

  useEffect(() => {
    if (detailTask) {
      const fetchDetails = async () => {
        const [commentsRes, historyRes] = await Promise.all([
          supabase.from('tb_comments').select('*').eq('task_id', detailTask.id).order('created_at', { ascending: true }),
          supabase.from('tb_task_history').select('*').eq('task_id', detailTask.id).order('created_at', { ascending: false })
        ]);
        if (commentsRes.data) {
          setComments(prev => ({ ...prev, [detailTask.id]: commentsRes.data }));
        }
        if (historyRes.data) {
          setHistories(prev => ({ ...prev, [detailTask.id]: historyRes.data }));
        }
      };
      fetchDetails();
    }
  }, [detailTask]);

  useEffect(() => {
    if (!detailTask) return;

    const commentsChannel = supabase.channel(`realtime-comments-${detailTask.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'tb_comments',
        filter: `task_id=eq.${detailTask.id}` 
      }, payload => {
        setComments(prev => {
          const list = prev[detailTask.id] || [];
          if (list.some(c => c.id === payload.new.id)) return prev;
          return { ...prev, [detailTask.id]: [...list, payload.new] };
        });
      })
      .subscribe();

    const historyChannel = supabase.channel(`realtime-history-${detailTask.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'tb_task_history',
        filter: `task_id=eq.${detailTask.id}` 
      }, payload => {
        setHistories(prev => {
          const list = prev[detailTask.id] || [];
          if (list.some(h => h.id === payload.new.id)) return prev;
          return { ...prev, [detailTask.id]: [payload.new, ...list] };
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(commentsChannel);
      supabase.removeChannel(historyChannel);
    };
  }, [detailTask]);

  if (!user) return null;

  const assignedTasks = tasks.filter(t => t.created_by === user.id);

  const stats = {
    total: assignedTasks.length,
    in_progress: assignedTasks.filter(t => t.status === 'in_progress').length,
    stopped: assignedTasks.filter(t => t.status === 'stopped').length,
    done: assignedTasks.filter(t => t.status === 'done').length,
  };

  const groupedTasks = assignedTasks.reduce((acc, task) => {
    const assigneeId = task.assigned_to;
    if (!acc[assigneeId]) acc[assigneeId] = [];
    acc[assigneeId].push(task);
    return acc;
  }, {});

  const handleAddComment = async (taskId, content) => {
    const { data, error } = await addComment(taskId, content);
    if (data && !error) {
      setComments(prev => ({
        ...prev,
        [taskId]: [...(prev[taskId] || []), data]
      }));
      
      const historyRes = await supabase.from('tb_task_history').select('*').eq('task_id', taskId).order('created_at', { ascending: false });
      if (historyRes.data) {
        setHistories(prev => ({ ...prev, [taskId]: historyRes.data }));
      }
    }
  };

  const handleProgressChange = async (taskId, progress) => {
    await updateTask(taskId, { progress });
    if (detailTask && detailTask.id === taskId) {
      setDetailTask(prev => ({ ...prev, progress }));
    }
  };

  const handleTogglePin = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    await updateTask(taskId, { pinned: !task.pinned });
    if (detailTask && detailTask.id === taskId) {
      setDetailTask(prev => ({ ...prev, pinned: !task.pinned }));
    }
  };

  return (
    <div className="dashboard-view">
      <h2>📤 Я назначил</h2>
      
      <div className="stats-grid">
        <div className="stat-card stat-total">
          <div className="stat-icon">📋</div>
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Всего назначено</div>
        </div>
        <div className="stat-card stat-progress">
          <div className="stat-icon">🔄</div>
          <div className="stat-number">{stats.in_progress}</div>
          <div className="stat-label">В работе</div>
        </div>
        <div className="stat-card stat-stopped">
          <div className="stat-icon">🛑</div>
          <div className="stat-number">{stats.stopped}</div>
          <div className="stat-label">На стопе</div>
        </div>
        <div className="stat-card stat-done">
          <div className="stat-icon">✅</div>
          <div className="stat-number">{stats.done}</div>
          <div className="stat-label">Выполнено</div>
        </div>
      </div>

      <div className="dashboard-tasks">
        {Object.entries(groupedTasks).map(([assigneeId, tks]) => {
          const assignee = profiles.find(p => p.id === assigneeId);
          const doneCount = tks.filter(t => t.status === 'done').length;
          const progressPercent = tks.length > 0 ? Math.round((doneCount / tks.length) * 100) : 0;
          
          return (
            <div key={assigneeId} className="assignee-group">
              <div className="assignee-header">
                <div className="avatar-circle" style={{ backgroundColor: assignee?.color || 'var(--accent)', width: '28px', height: '28px', fontSize: '14px' }}>
                  {assignee?.avatar || '👤'}
                </div>
                <h3>Кому: {assignee?.name || 'Неизвестный исполнитель'}</h3>
                <span style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {doneCount} / {tks.length} выполнено ({progressPercent}%)
                </span>
              </div>
              <div className="task-progress-bar" style={{ marginBottom: '16px' }}>
                <div className="task-progress-fill" style={{ width: `${progressPercent}%` }}></div>
              </div>
              
              <div className="group-tasks-grid">
                {tks.map(task => (
                  <TaskCard 
                    key={task.id}
                    task={task}
                    profiles={profiles}
                    onClick={setDetailTask}
                    draggable={false}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {assignedTasks.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📤</div>
            <div className="empty-state-text">Вы пока не назначили ни одной задачи другим пользователям</div>
          </div>
        )}
      </div>

      {detailTask && (
        <TaskDetailModal
          isOpen={!!detailTask}
          task={tasks.find(t => t.id === detailTask.id) || detailTask}
          profiles={profiles}
          comments={comments[detailTask.id] || []}
          history={histories[detailTask.id] || []}
          onEdit={() => {}}
          onDelete={async () => { await deleteTask(detailTask.id); setDetailTask(null); }}
          onComment={handleAddComment}
          onStatusChange={(status) => changeStatus(detailTask.id, status)}
          onProgressChange={(progress) => handleProgressChange(detailTask.id, progress)}
          onTogglePin={() => handleTogglePin(detailTask.id)}
          onClose={() => setDetailTask(null)}
          currentUserId={user?.id}
        />
      )}
    </div>
  );
}
