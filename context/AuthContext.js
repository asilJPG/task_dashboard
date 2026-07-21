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

  const adminCreateUser = async (username, password, name, avatar, color) => {
    const cleanUsername = username.toLowerCase().trim();
    
    if (isMock) {
      const profiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
      if (profiles.some(p => p.email.split('@')[0] === cleanUsername)) {
        return { error: { message: 'Пользователь с таким логином уже существует.' } };
      }
      
      const newUserId = 'user_' + Date.now();
      const newProfile = { 
        id: newUserId, 
        name, 
        avatar, 
        color, 
        email: `${cleanUsername}@taskboard.local`, 
        password,
        is_admin: false 
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

      // 2. Insert profile directly with username and password
      const { data, error } = await supabase
        .from('tb_profiles')
        .insert([{
          username: cleanUsername,
          password,
          name,
          avatar: avatar || '🧑‍💻',
          color: color || '#7c3aed',
          is_admin: false
        }])
        .select()
        .single();

      return { data, error };
    }
  };

  const signOut = async () => {
    localStorage.removeItem('tb_session');
    setUser(null);
    setProfile(null);
    return { error: null };
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, adminCreateUser, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
