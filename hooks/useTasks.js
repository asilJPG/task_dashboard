import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { sendTelegramNotification } from '../lib/telegram';

export function useTasks(userId, profile) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const isManagerOrAdmin = profile?.role === 'manager' || profile?.role === 'admin' || profile?.is_admin === true;

  const isUserRelated = useCallback((task, uid) => {
    if (!task || !uid) return false;
    if (task.created_by === uid || task.assigned_to === uid || task.responsible_id === uid) return true;
    if (Array.isArray(task.assignees) && task.assignees.includes(uid)) return true;
    return false;
  }, []);

  const fetchTasks = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    let queryBuilder = supabase.from('tb_tasks').select('*');

    const { data, error } = await queryBuilder;
    
    if (data) {
      if (isManagerOrAdmin) {
        setTasks(data);
      } else {
        setTasks(data.filter(t => isUserRelated(t, userId)));
      }
    }
    if (error) console.error('Error fetching tasks:', error);
    setLoading(false);
  }, [userId, isManagerOrAdmin, isUserRelated]);

  useEffect(() => {
    if (!userId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    fetchTasks();

    const channel = supabase.channel('tb_tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tb_tasks' }, payload => {
        const { eventType, new: newRec, old: oldRec } = payload;
        if (eventType === 'INSERT') {
          if (isManagerOrAdmin || isUserRelated(newRec, userId)) {
            setTasks(prev => [newRec, ...prev]);
          }
        } else if (eventType === 'UPDATE') {
          if (isManagerOrAdmin || isUserRelated(newRec, userId)) {
            setTasks(prev => {
              const exists = prev.some(t => t.id === newRec.id);
              if (exists) {
                return prev.map(t => t.id === newRec.id ? newRec : t);
              } else {
                return [newRec, ...prev];
              }
            });
          } else {
            setTasks(prev => prev.filter(t => t.id !== newRec.id));
          }
        } else if (eventType === 'DELETE') {
          setTasks(prev => prev.filter(t => t.id !== oldRec.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchTasks, isManagerOrAdmin, isUserRelated]);

  const sendNotification = async (recipientId, type, taskId, message) => {
    if (!recipientId || recipientId === userId) return;
    await supabase.from('tb_notifications').insert([{
      user_id: recipientId,
      type,
      task_id: taskId,
      message,
      read: false
    }]);
  };

  const fetchProfileName = async (uid) => {
    if (!uid) return '';
    if (profile && profile.id === uid && profile.name) return profile.name;
    try {
      const { data } = await supabase.from('tb_profiles').select('name').eq('id', uid).maybeSingle();
      return data?.name || '';
    } catch (e) {
      return '';
    }
  };

  const createTask = async (data) => {
    const assignees = Array.isArray(data.assignees) ? data.assignees : (data.assigned_to ? [data.assigned_to] : []);
    const responsible_id = data.responsible_id || data.assigned_to || userId;

    const { data: newTask, error } = await supabase.from('tb_tasks').insert([{
      ...data,
      assignees,
      responsible_id,
      created_by: userId,
      created_at: new Date().toISOString()
    }]).select().single();

    if (error) {
      console.error('Error creating task:', error);
    } else if (newTask) {
      await supabase.from('tb_task_history').insert([{
        task_id: newTask.id,
        user_id: userId,
        action: 'created'
      }]);

      // Notify assignees
      for (const assigneeId of assignees) {
        if (assigneeId !== userId) {
          await sendNotification(assigneeId, 'assigned', newTask.id, 'Вам назначена новая задача');
        }
      }

      // Send Telegram Notification (PRIVACY: No task title/description)
      try {
        const creatorName = profile?.name || await fetchProfileName(userId);
        const responsibleName = await fetchProfileName(responsible_id);
        const assigneeNames = await Promise.all(assignees.map(id => fetchProfileName(id)));

        await sendTelegramNotification('TASK_CREATED', {
          task: newTask,
          creatorName,
          assigneeNames,
          responsibleName
        });
      } catch (err) {
        console.error('Telegram notification trigger failed:', err);
      }
    }
    return { data: newTask, error };
  };

  const updateTask = async (taskId, updates) => {
    const { data, error } = await supabase.from('tb_tasks').update({
      ...updates,
      updated_at: new Date().toISOString()
    }).eq('id', taskId).select().single();

    if (error) {
      console.error('Error updating task:', error);
    } else {
      await supabase.from('tb_task_history').insert([{
        task_id: taskId,
        user_id: userId,
        action: 'updated',
        changes: JSON.stringify(updates)
      }]);
    }
    return { data, error };
  };

  const deleteTask = async (taskId) => {
    const { error } = await supabase.from('tb_tasks').delete().eq('id', taskId);
    if (error) {
      console.error('Error deleting task:', error);
    }
    return { error };
  };

  const changeStatus = async (taskId, newStatus, stopReason = null) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const updates = { 
      status: newStatus, 
      updated_at: new Date().toISOString() 
    };
    if (newStatus === 'done') updates.progress = 100;
    if (task.status === 'stopped' && newStatus !== 'stopped') updates.stop_reason = null;
    if (newStatus === 'stopped' && stopReason) updates.stop_reason = stopReason;

    const { error } = await supabase.from('tb_tasks').update(updates).eq('id', taskId);
    if (error) {
      console.error('Error changing status:', error);
    } else {
      await supabase.from('tb_task_history').insert([{
        task_id: taskId,
        user_id: userId,
        action: 'status_changed',
        details: `Статус изменен с ${task.status} на ${newStatus}`
      }]);
      if (task.created_by !== userId) {
        await sendNotification(task.created_by, 'status_change', taskId, `Статус задачи изменен на ${newStatus}`);
      }

      // If status changed to DONE, send Telegram notification with duration
      if (newStatus === 'done') {
        try {
          const respId = task.responsible_id || task.assigned_to;
          const responsibleName = await fetchProfileName(respId);
          await sendTelegramNotification('TASK_COMPLETED', {
            task,
            responsibleName
          });
        } catch (err) {
          console.error('Telegram completion notification error:', err);
        }
      }
    }
  };

  const updateProgress = async (taskId, progress) => {
    return await updateTask(taskId, { progress });
  };

  const togglePin = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    return await updateTask(taskId, { pinned: !task.pinned });
  };

  const addComment = async (taskId, text) => {
    const { data, error } = await supabase.from('tb_comments').insert([{
      task_id: taskId,
      user_id: userId,
      text
    }]).select().single();
    
    if (error) {
      console.error('Error adding comment:', error);
    } else {
      await supabase.from('tb_task_history').insert([{
        task_id: taskId,
        user_id: userId,
        action: 'comment_added',
        details: text.substring(0, 50)
      }]);

      const task = tasks.find(t => t.id === taskId);
      if (task) {
        if (task.created_by !== userId) {
          await sendNotification(task.created_by, 'comment', taskId, 'Новый комментарий к задаче');
        }
        if (task.assigned_to && task.assigned_to !== userId) {
          await sendNotification(task.assigned_to, 'comment', taskId, 'Новый комментарий к задаче');
        }

        // Send Telegram alert for new comment
        try {
          const authorName = profile?.name || await fetchProfileName(userId);
          await sendTelegramNotification('COMMENT_ADDED', {
            task,
            authorName
          });
        } catch (err) {
          console.error('Telegram comment notification error:', err);
        }
      }
    }
    return { data, error };
  };

  return { tasks, loading, createTask, updateTask, deleteTask, changeStatus, updateProgress, togglePin, addComment };
}
