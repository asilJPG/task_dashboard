'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if we are running in Mock Mode
  const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                 process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id') ||
                 process.env.NEXT_PUBLIC_SUPABASE_URL === '';

  useEffect(() => {
    const loadSession = async () => {
      setLoading(true);
      try {
        const storedUserId = localStorage.getItem('tb_session');
        if (storedUserId) {
          if (isMock) {
            const profiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
            const found = profiles.find(p => p.id === storedUserId);
            if (found) {
              setProfile(found);
              setUser({ id: found.id, username: found.username });
            } else {
              localStorage.removeItem('tb_session');
            }
          } else {
            const { data, error } = await supabase
              .from('tb_profiles')
              .select('*')
              .eq('id', storedUserId)
              .single();
            
            if (data && !error) {
              setProfile(data);
              setUser({ id: data.id, username: data.username });
            } else {
              localStorage.removeItem('tb_session');
            }
          }
        }
      } catch (err) {
        console.error('Session load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [isMock]);

  const signIn = async (username, password) => {
    const cleanUsername = username.toLowerCase().trim();
    
    if (isMock) {
      const profiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
      const found = profiles.find(p => p.email.split('@')[0] === cleanUsername && p.password === password);
      
      if (!found) {
        return { error: { message: 'Неверный логин или пароль' } };
      }

      setProfile(found);
      setUser({ id: found.id, username: cleanUsername });
      localStorage.setItem('tb_session', found.id);
      return { data: found, error: null };
    } else {
      const { data, error } = await supabase
        .from('tb_profiles')
        .select('*')
        .eq('username', cleanUsername)
        .eq('password', password)
        .maybeSingle();

      if (error) {
        return { data: null, error };
      }

      if (!data) {
        return { data: null, error: { message: 'Неверное имя пользователя или пароль.' } };
      }

      setProfile(data);
      setUser({ id: data.id, username: cleanUsername });
      localStorage.setItem('tb_session', data.id);
      return { data, error: null };
    }
  };

  const adminCreateUser = async (username, password, name, avatar, color, role = 'employee') => {
    const cleanUsername = username.toLowerCase().trim();
    const isAdmin = role === 'admin';
    
    if (isMock) {
      const profiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
      if (profiles.some(p => p.username === cleanUsername || p.email?.split('@')[0] === cleanUsername)) {
        return { error: { message: 'Пользователь с таким логином уже существует.' } };
      }
      
      const newUserId = 'user_' + Date.now();
      const newProfile = { 
        id: newUserId, 
        username: cleanUsername,
        name, 
        avatar, 
        color, 
        email: `${cleanUsername}@taskboard.local`, 
        password,
        role,
        is_admin: isAdmin 
      };
      profiles.push(newProfile);
      localStorage.setItem('mock_profiles', JSON.stringify(profiles));
      return { data: newProfile, error: null };
    } else {
      // 1. Check if user already exists
      const { data: existing } = await supabase
        .from('tb_profiles')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (existing) {
        return { error: { message: 'Пользователь с таким логином уже существует.' } };
      }

      // 2. Insert profile directly with username, password and role
      const { data, error } = await supabase
        .from('tb_profiles')
        .insert([{
          username: cleanUsername,
          password,
          name,
          avatar: avatar || '🧑‍💻',
          color: color || '#7c3aed',
          role,
          is_admin: isAdmin
        }])
        .select()
        .single();

      return { data, error };
    }
  };

  const updateUserRole = async (targetUserId, newRole) => {
    const isAdmin = newRole === 'admin';
    if (isMock) {
      const profiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
      const updatedProfiles = profiles.map(p => p.id === targetUserId ? { ...p, role: newRole, is_admin: isAdmin } : p);
      localStorage.setItem('mock_profiles', JSON.stringify(updatedProfiles));
      
      if (profile && profile.id === targetUserId) {
        setProfile({ ...profile, role: newRole, is_admin: isAdmin });
      }
      return { data: { id: targetUserId, role: newRole, is_admin: isAdmin }, error: null };
    } else {
      const { data, error } = await supabase
        .from('tb_profiles')
        .update({ role: newRole, is_admin: isAdmin })
        .eq('id', targetUserId)
        .select()
        .single();
        
      if (data && !error && profile && profile.id === targetUserId) {
        setProfile(data);
      }
      return { data, error };
    }
  };

  const updateProfile = async (updates) => {
    if (!profile) return { error: { message: 'Сессия не найдена.' } };

    if (isMock) {
      const profiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
      const updatedProfiles = profiles.map(p => p.id === profile.id ? { ...p, ...updates } : p);
      localStorage.setItem('mock_profiles', JSON.stringify(updatedProfiles));
      
      const newProfile = { ...profile, ...updates };
      setProfile(newProfile);
      return { data: newProfile, error: null };
    } else {
      const { data, error } = await supabase
        .from('tb_profiles')
        .update(updates)
        .eq('id', profile.id)
        .select()
        .single();
        
      if (data && !error) {
        setProfile(data);
      }
      return { data, error };
    }
  };

  const signOut = async () => {
    localStorage.removeItem('tb_session');
    setUser(null);
    setProfile(null);
    return { error: null };
  };

  const adminDeleteUser = async (targetUserId) => {
    if (!targetUserId) return { error: { message: 'ID пользователя не указан' } };
    if (profile && profile.id === targetUserId) {
      return { error: { message: 'Вы не можете удалить свой собственный аккаунт.' } };
    }

    if (isMock) {
      const profiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
      const updatedProfiles = profiles.filter(p => p.id !== targetUserId);
      localStorage.setItem('mock_profiles', JSON.stringify(updatedProfiles));
      return { error: null };
    } else {
      const { error } = await supabase
        .from('tb_profiles')
        .delete()
        .eq('id', targetUserId);
      return { error };
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, adminCreateUser, updateUserRole, adminDeleteUser, updateProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
