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
import ConfirmDialog from '@/components/UI/ConfirmDialog';
import { showToast } from '@/components/UI/Toast';
import { supabase } from '@/lib/supabase';
import { normalizeTags } from '@/lib/utils';

export default function KanbanPage() {
  const { user, profile } = useAuth();
  const { tasks, createTask, updateTask, changeStatus, updateProgress, deleteTask, addComment, setDifficulty, setQuality, setAssigneeShares, setDeadline } = useTasks(user?.id, profile);
  const searchParams = useSearchParams();
  const taskIdParam = searchParams.get('task');
  
  const [profiles, setProfiles] = useState([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [stopTask, setStopTask] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');
  const [sortBy, setSortBy] = useState('created_desc');
  // Filters are collapsed on phones by default: three full-width selects pushed the actual
  // task list below the fold. On desktop CSS keeps them always visible.
  const [filtersOpen, setFiltersOpen] = useState(false);
  
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

  const handleStatusChange = async (taskId, newStatus) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const isResponsibleOrAdmin = user?.id === (task.responsible_id || task.assigned_to) || 
                                 user?.id === task.created_by || 
                                 profile?.is_admin || 
                                 profile?.role === 'admin' || 
                                 profile?.role === 'manager';

    if (!isResponsibleOrAdmin) {
      showToast('Изменять статус этой задачи может только ответственный сотрудник', 'error');
      return;
    }

    if (newStatus === 'stopped') {
      setStopTask(task);
      return;
    }

    if (newStatus === 'done' && !(profile?.is_admin || profile?.role === 'admin' || profile?.role === 'manager')) {
      showToast('Принять задачу может только руководитель — отправьте её на проверку', 'error');
      return;
    }

    const res = await changeStatus(taskId, newStatus);
    if (res?.error) {
      showToast(`Не удалось изменить статус: ${res.error.message || res.error}`, 'error');
    } else if (newStatus === 'review') {
      showToast('Задача отправлена на проверку руководителю', 'success');
    } else if (newStatus === 'done') {
      showToast('Задача принята', 'success');
    }
  };

  const handleStopConfirm = async (reason) => {
    if (stopTask) {
      await changeStatus(stopTask.id, 'stopped', reason);
      setStopTask(null);
    }
  };

  const handleSaveTask = async (taskData) => {
    const wasEditing = !!editingTask;
    const { error } = wasEditing
      ? await updateTask(editingTask.id, taskData)
      : await createTask(taskData);

    setShowTaskForm(false);
    setEditingTask(null);

    if (error) {
      showToast(`Не удалось сохранить задачу: ${error.message || error}`, 'error');
    } else {
      showToast(wasEditing ? 'Изменения сохранены' : 'Задача создана', 'success');
    }
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
    await updateProgress(taskId, progress);
    if (detailTask && detailTask.id === taskId) {
      setDetailTask(prev => ({ ...prev, progress }));
    }
    if (progress === 100) {
      showToast('Прогресс 100% — задача отправлена на проверку', 'success');
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

  const handleDifficultyChange = async (taskId, difficulty) => {
    await setDifficulty(taskId, difficulty);
    if (detailTask && detailTask.id === taskId) {
      setDetailTask(prev => ({ ...prev, difficulty }));
    }
  };

  const handleDeadlineChange = async (taskId, deadline) => {
    const { error } = await setDeadline(taskId, deadline);
    if (error) {
      showToast('Не удалось изменить срок', 'error');
      return;
    }
    if (detailTask && detailTask.id === taskId) {
      setDetailTask(prev => ({ ...prev, deadline }));
    }
    showToast(deadline ? 'Срок выполнения обновлён' : 'Срок убран', 'success');
  };

  const handleQualityChange = async (taskId, quality) => {
    await setQuality(taskId, quality);
    if (detailTask && detailTask.id === taskId) {
      setDetailTask(prev => ({ ...prev, quality }));
    }
  };

  const handleSharesChange = async (taskId, shares) => {
    await setAssigneeShares(taskId, shares);
    if (detailTask && detailTask.id === taskId) {
      setDetailTask(prev => ({ ...prev, assignee_shares: shares }));
    }
  };

  return (
    <div className="dashboard-container">
      <div className="board-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }} className={filtersOpen ? 'toolbar-filters open' : 'toolbar-filters'}>
          <h2>📋 Доска задач</h2>

          <button
            type="button"
            className="btn btn-secondary filters-toggle"
            onClick={() => setFiltersOpen(o => !o)}
          >
            {filtersOpen ? '▲ Скрыть фильтры' : '▼ Фильтры и сортировка'}
          </button>

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

          {/* Sort Selector */}
          <select
            className="form-select"
            style={{ padding: '6px 12px', fontSize: '12px', width: 'auto', background: '#161b22', borderColor: 'var(--border-color)', borderRadius: '8px' }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="created_desc">📌 Новые и закрепленные</option>
            <option value="priority_desc">🔥 По приоритету (высокий сначала)</option>
            <option value="deadline_asc">📅 По дедлайну (ближайшие сначала)</option>
            <option value="progress_desc">📶 По прогрессу (высокий сначала)</option>
            <option value="title_asc">🔤 По названию (А — Я)</option>
          </select>
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
        sortBy={sortBy}
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
          onDelete={() => setTaskToDelete(detailTask)}
          onComment={handleAddComment}
          onStatusChange={(status) => handleStatusChange(detailTask.id, status)}
          onProgressChange={(progress) => handleProgressChange(detailTask.id, progress)}
          onTogglePin={() => handleTogglePin(detailTask.id)}
          onDifficultyChange={(difficulty) => handleDifficultyChange(detailTask.id, difficulty)}
          onQualityChange={(quality) => handleQualityChange(detailTask.id, quality)}
          onDeadlineChange={(deadline) => handleDeadlineChange(detailTask.id, deadline)}
          onSharesChange={(shares) => handleSharesChange(detailTask.id, shares)}
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

      <ConfirmDialog
        isOpen={!!taskToDelete}
        title="Удалить задачу?"
        message={taskToDelete ? `Задача №${taskToDelete.task_number} «${taskToDelete.title}» будет удалена вместе с комментариями и историей.` : ''}
        confirmLabel="Удалить задачу"
        onConfirm={async () => {
          const { error } = await deleteTask(taskToDelete.id);
          setDetailTask(null);
          showToast(error ? `Не удалось удалить: ${error.message || error}` : 'Задача удалена', error ? 'error' : 'success');
        }}
        onClose={() => setTaskToDelete(null)}
      />
    </div>
  );
}
