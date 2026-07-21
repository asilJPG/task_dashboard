'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useTasks(userId) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('tb_tasks')
      .select('*')
      .or(`created_by.eq.${userId},assigned_to.eq.${userId}`);
    
    if (data) setTasks(data);
    if (error) console.error('Error fetching tasks:', error);
    setLoading(false);
  }, [userId]);

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
          if (newRec.created_by === userId || newRec.assigned_to === userId) {
            setTasks(prev => [newRec, ...prev]);
          }
        } else if (eventType === 'UPDATE') {
          if (newRec.created_by === userId || newRec.assigned_to === userId) {
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
  }, [userId, fetchTasks]);

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

  const createTask = async (data) => {
    const { data: newTask, error } = await supabase.from('tb_tasks').insert([{
      ...data,
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
      if (newTask.assigned_to && newTask.assigned_to !== userId) {
        await sendNotification(newTask.assigned_to, 'assigned', newTask.id, 'Вам назначена новая задача');
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
      if (task && task.created_by !== userId) {
        await sendNotification(task.created_by, 'comment', taskId, 'Новый комментарий к задаче');
      }
      if (task && task.assigned_to && task.assigned_to !== userId) {
        await sendNotification(task.assigned_to, 'comment', taskId, 'Новый комментарий к задаче');
      }
    }
    return { data, error };
  };

  return { tasks, loading, createTask, updateTask, deleteTask, changeStatus, updateProgress, togglePin, addComment };
}
