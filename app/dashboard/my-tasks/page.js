'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTasks } from '@/hooks/useTasks';
import TaskDetailModal from '@/components/TaskModal/TaskDetailModal';
import TaskCard from '@/components/TaskCard/TaskCard';
import { supabase } from '@/lib/supabase';

export default function MyTasksPage() {
  const { user } = useAuth();
  const { tasks, updateTask, changeStatus, deleteTask, addComment } = useTasks(user?.id);
  
  const [activeFilter, setActiveFilter] = useState('all');
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

  const myTasks = tasks.filter(t => t.assigned_to === user.id);
  
  const filteredTasks = activeFilter === 'all' 
    ? myTasks 
    : myTasks.filter(t => t.status === activeFilter);

  const stats = {
    total: myTasks.length,
    in_progress: myTasks.filter(t => t.status === 'in_progress').length,
    stopped: myTasks.filter(t => t.status === 'stopped').length,
    done: myTasks.filter(t => t.status === 'done').length,
  };

  // Group by created_by
  const groupedTasks = filteredTasks.reduce((acc, task) => {
    const creatorId = task.created_by;
    if (!acc[creatorId]) acc[creatorId] = [];
    acc[creatorId].push(task);
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
      <h2>📥 Мои задачи</h2>
      
      <div className="stats-grid">
        <div className="stat-card stat-total">
          <div className="stat-icon">📋</div>
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Всего задач</div>
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

      <div className="filter-bar">
        {[
          { id: 'all', label: 'Все' },
          { id: 'new', label: 'Новые' },
          { id: 'in_progress', label: 'В работе' },
          { id: 'stopped', label: 'На стопе' },
          { id: 'done', label: 'Готово' }
        ].map(filter => (
          <button 
            key={filter.id}
            className={`filter-chip ${activeFilter === filter.id ? 'active' : ''}`}
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="dashboard-tasks">
        {Object.entries(groupedTasks).map(([creatorId, tks]) => {
          const creator = profiles.find(p => p.id === creatorId);
          return (
            <div key={creatorId} className="assignee-group">
              <div className="assignee-header">
                <div className="avatar-circle" style={{ backgroundColor: creator?.color || 'var(--accent)', width: '28px', height: '28px', fontSize: '14px' }}>
                  {creator?.avatar || '👤'}
                </div>
                <h3>От: {creator?.name || 'Заказчик'}</h3>
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
        {myTasks.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📥</div>
            <div className="empty-state-text">Вам пока не назначили ни одной задачи</div>
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
