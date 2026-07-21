'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('tb_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (data) setNotifications(data);
    if (error) console.error('Error fetching notifications:', error);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    fetchNotifications();

    const channel = supabase.channel(`notifications-${userId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tb_notifications',
        filter: `user_id=eq.${userId}`
      }, payload => {
        const { eventType, new: newRec, old: oldRec } = payload;
        if (eventType === 'INSERT') {
          setNotifications(prev => [newRec, ...prev]);
        } else if (eventType === 'UPDATE') {
          setNotifications(prev => prev.map(n => n.id === newRec.id ? newRec : n));
        } else if (eventType === 'DELETE') {
          setNotifications(prev => prev.filter(n => n.id !== oldRec.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchNotifications]);

  const markAsRead = async (id) => {
    const { error } = await supabase
      .from('tb_notifications')
      .update({ read: true })
      .eq('id', id);
    if (error) console.error('Error marking notification as read:', error);
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    const { error } = await supabase
      .from('tb_notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) console.error('Error marking all notifications as read:', error);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, unreadCount, markAsRead, markAllAsRead, loading };
}
