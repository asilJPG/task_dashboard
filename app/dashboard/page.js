'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTasks } from '@/hooks/useTasks';
import Board from '@/components/Board/Board';
import TaskFormModal from '@/components/TaskModal/TaskFormModal';
import TaskDetailModal from '@/components/TaskModal/TaskDetailModal';
import StopReasonModal from '@/components/TaskModal/StopReasonModal';
import { supabase } from '@/lib/supabase';

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
  
  const [comments, setComments] = useState({});
  const [histories, setHistories] = useState({});

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
    if (newStatus === 'stopped') {
      const task = tasks.find(t => t.id === taskId);
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
      <div className="board-toolbar">
        <h2>Канбан-доска</h2>
        <button className="btn btn-primary" onClick={() => { setEditingTask(null); setShowTaskForm(true); }}>
          + Новая задача
        </button>
      </div>

      <Board 
        tasks={tasks}
        profiles={profiles}
        onTaskClick={handleTaskClick}
        onStatusChange={handleStatusChange}
        currentUserId={user?.id}
      />

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
