'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTasks } from '@/hooks/useTasks';
import Board from '@/components/Board/Board';
import TaskFormModal from '@/components/TaskModal/TaskFormModal';
import TaskDetailModal from '@/components/TaskModal/TaskDetailModal';
import StopReasonModal from '@/components/TaskModal/StopReasonModal';
import TeamModal from '@/components/TeamModal/TeamModal';
import { supabase } from '@/lib/supabase';
import { normalizeTags } from '@/lib/utils';

export default function KanbanPage() {
  const { user, profile } = useAuth();
  const { tasks, createTask, updateTask, changeStatus, deleteTask, addComment } = useTasks(user?.id, profile);
  const searchParams = useSearchParams();
  const taskIdParam = searchParams.get('task');
  
  const [profiles, setProfiles] = useState([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [stopTask, setStopTask] = useState(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');
  
  const [comments, setComments] = useState({});
  const [histories, setHistories] = useState({});

  const teamMembers = profiles.filter(p => p.username !== 'admin' && !p.is_admin && p.role !== 'admin' && p.id !== user?.id);
  const allTags = Array.from(new Set(tasks.flatMap(t => normalizeTags(t.tags)))).filter(Boolean);

  let displayedTasks = tasks;
  if (selectedEmployee !== 'all') {
    displayedTasks = displayedTasks.filter(t => t.assigned_to === selectedEmployee || (Array.isArray(t.assignees) && t.assignees.includes(selectedEmployee)) || t.responsible_id === selectedEmployee);
  }
  if (selectedTag !== 'all') {
    displayedTasks = displayedTasks.filter(t => normalizeTags(t.tags).includes(selectedTag));
  }

  useEffect(() => {
    if (taskIdParam && tasks.length > 0) {
      const task = tasks.find(t => t.id === taskIdParam);
      if (task) {
        setDetailTask(task);
      }
    }
  }, [taskIdParam, tasks]);

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

  const handleTaskClick = (task) => {
    setDetailTask(task);
  };

  const handleStatusChange = (taskId, newStatus) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const isResponsibleOrAdmin = user?.id === (task.responsible_id || task.assigned_to) || 
                                 user?.id === task.created_by || 
                                 profile?.is_admin || 
                                 profile?.role === 'admin' || 
                                 profile?.role === 'manager';

    if (!isResponsibleOrAdmin) {
      alert('🔒 Изменять статус этой задачи может только ответственный сотрудник!');
      return;
    }

    if (newStatus === 'stopped') {
      setStopTask(task);
    } else {
      changeStatus(taskId, newStatus);
    }
  };

  const handleStopConfirm = async (reason) => {
    if (stopTask) {
      await changeStatus(stopTask.id, 'stopped', reason);
      setStopTask(null);
    }
  };

  const handleSaveTask = async (taskData) => {
    if (editingTask) {
      await updateTask(editingTask.id, taskData);
    } else {
      await createTask(taskData);
    }
    setShowTaskForm(false);
    setEditingTask(null);
  };

  const handleAddComment = async (taskId, content) => {
    const { data, error } = await addComment(taskId, content);
    if (data && !error) {
      setComments(prev => ({
        ...prev,
        [taskId]: [...(prev[taskId] || []), data]
      }));
      
      // Update histories for this task
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
    <div className="dashboard-container">
      <div className="board-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2>📋 Доска задач</h2>
          
          {/* Employee Filter Select for Managers and Team */}
          {teamMembers.length > 0 && (
            <select
              className="form-select"
              style={{ padding: '6px 12px', fontSize: '12px', width: 'auto', background: '#161b22', borderColor: 'var(--border-color)', borderRadius: '8px' }}
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
            >
              <option value="all">👥 Все сотрудники ({teamMembers.length})</option>
              {teamMembers.map(m => (
                <option key={m.id} value={m.id}>
                  👨‍💻 {m.name} (@{m.username})
                </option>
              ))}
            </select>
          )}

          {/* Tag Filter Select */}
          {allTags.length > 0 && (
            <select
              className="form-select"
              style={{ padding: '6px 12px', fontSize: '12px', width: 'auto', background: '#161b22', borderColor: 'var(--border-color)', borderRadius: '8px' }}
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
            >
              <option value="all">🏷️ Все теги ({allTags.length})</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>
                  🏷️ {tag}
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            type="button"
            className="btn btn-secondary" 
            style={{ padding: '6px 14px', fontSize: '13px' }}
            onClick={() => setShowTeamModal(true)}
          >
            👥 Команда ({teamMembers.length})
          </button>
          
          <button className="btn btn-primary" onClick={() => { setEditingTask(null); setShowTaskForm(true); }}>
            + Новая задача
          </button>
        </div>
      </div>

      <Board 
        tasks={displayedTasks}
        profiles={profiles}
        onTaskClick={handleTaskClick}
        onStatusChange={handleStatusChange}
        currentUserId={user?.id}
      />

      <TeamModal
        isOpen={showTeamModal}
        onClose={() => setShowTeamModal(false)}
        profiles={profiles}
        tasks={tasks}
        currentUserId={user?.id}
        onSelectEmployee={(empId) => setSelectedEmployee(empId)}
      />

      {/* Mobile Floating Action Button */}
      <button 
        type="button" 
        className="mobile-fab-btn" 
        onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
        title="Создать новую задачу"
      >
        <span>+</span>
        <span className="fab-label">Задача</span>
      </button>

      {showTaskForm && (
        <TaskFormModal
          isOpen={showTaskForm}
          task={editingTask}
          profiles={profiles}
          currentUser={user}
          onSave={handleSaveTask}
          onClose={() => { setShowTaskForm(false); setEditingTask(null); }}
        />
      )}

      {detailTask && (
        <TaskDetailModal
          isOpen={!!detailTask}
          task={tasks.find(t => t.id === detailTask.id) || detailTask}
          profiles={profiles}
          comments={comments[detailTask.id] || []}
          history={histories[detailTask.id] || []}
          onEdit={() => { setEditingTask(detailTask); setShowTaskForm(true); setDetailTask(null); }}
          onDelete={async () => { await deleteTask(detailTask.id); setDetailTask(null); }}
          onComment={handleAddComment}
          onStatusChange={(status) => handleStatusChange(detailTask.id, status)}
          onProgressChange={(progress) => handleProgressChange(detailTask.id, progress)}
          onTogglePin={() => handleTogglePin(detailTask.id)}
          onClose={() => setDetailTask(null)}
          currentUserId={user?.id}
        />
      )}

      {stopTask && (
        <StopReasonModal
          isOpen={!!stopTask}
          onConfirm={handleStopConfirm}
          onClose={() => setStopTask(null)}
        />
      )}
    </div>
  );
}
