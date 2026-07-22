'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useSearch } from '@/hooks/useSearch';
import { formatRelativeTime } from '@/lib/utils';
import ProfileSettingsModal from '../ProfileModal/ProfileSettingsModal';

const SearchBar = () => {
  const { user, profile } = useAuth();
  const { query, setQuery, results, searching } = useSearch(user?.id, profile);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="search-bar" ref={containerRef}>
      <span className="search-icon">🔍</span>
      <input 
        className="search-input" 
        placeholder="Поиск задач..." 
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
      />
      {isOpen && query.trim() !== '' && (
        <div className="search-results">
          {searching && <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>Поиск...</div>}
          {!searching && results.length === 0 && <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>Ничего не найдено</div>}
          {results.map(res => (
            <Link 
              key={res.id} 
              href={`/dashboard?task=${res.id}`} 
              className="search-result-item" 
              onClick={() => setIsOpen(false)}
              style={{ textDecoration: 'none', display: 'flex' }}
            >
              <div style={{ flex: 1 }}>
                <div className="search-result-title">{res.title}</div>
                <div className="search-result-meta">Прогресс: {res.progress}%</div>
              </div>
              <span className={`status-badge ${res.status}`} style={{ fontSize: '10px', height: 'fit-content' }}>
                {res.status === 'new' ? 'Новая' : res.status === 'in_progress' ? 'В работе' : res.status === 'stopped' ? 'Стоп' : 'Готово'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

const NotificationBell = () => {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(user?.id);
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="notification-wrapper" ref={panelRef}>
      <button className="notification-bell" onClick={() => setIsOpen(!isOpen)}>
        🔔 {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>
      {isOpen && (
        <div className="notification-panel">
          <div className="notification-header">
            <h3>Уведомления</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => { markAllAsRead(); setIsOpen(false); }}>Прочитать все</button>
          </div>
          <div className="notification-list">
            {notifications.length === 0 && (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                Нет уведомлений
              </div>
            )}
            {notifications.map(n => (
              <Link 
                key={n.id} 
                href={`/dashboard?task=${n.task_id}`} 
                className={`notification-item ${!n.read ? 'unread' : ''}`} 
                onClick={() => { markAsRead(n.id); setIsOpen(false); }}
                style={{ textDecoration: 'none', display: 'flex' }}
              >
                <span className="notif-icon">
                  {n.type === 'task_assigned' ? '📥' : n.type === 'status_change' ? '🔄' : n.type === 'comment' ? '💬' : '🔔'}
                </span>
                <div className="notif-content">
                  <div className="notif-text">{n.message}</div>
                  <div className="notif-time">{formatRelativeTime(n.created_at)}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const UserMenu = () => {
  const { profile, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const userRole = profile?.role || (profile?.is_admin ? 'admin' : 'employee');

  return (
    <div className="user-menu" ref={dropdownRef} onClick={() => setIsOpen(!isOpen)}>
      <span className="user-avatar" style={{ backgroundColor: profile?.color || 'var(--accent)' }}>
        {profile?.avatar || '👤'}
      </span>
      <span className="user-name">{profile?.name || 'Пользователь'}</span>
      <span className="dropdown-arrow">▼</span>
      {isOpen && (
        <div className="user-dropdown" onClick={(e) => e.stopPropagation()}>
          <div style={{ paddingBottom: '8px', marginBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-primary)' }}>{profile?.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>@{profile?.username || profile?.email?.split('@')[0] || 'user'}</div>
            <div style={{ marginTop: '4px' }}>
              {userRole === 'admin' && <span className="status-badge" style={{ backgroundColor: 'rgba(219, 109, 40, 0.15)', color: '#db6d28', fontSize: '10px', padding: '1px 6px', margin: 0 }}>👑 Админ</span>}
              {userRole === 'manager' && <span className="status-badge" style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: '10px', padding: '1px 6px', margin: 0 }}>🧑‍💼 Руководитель</span>}
              {userRole === 'employee' && <span className="status-badge" style={{ backgroundColor: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', fontSize: '10px', padding: '1px 6px', margin: 0 }}>👨‍💻 Сотрудник</span>}
            </div>
          </div>
          <button 
            className="btn btn-sm btn-secondary btn-full" 
            style={{ marginBottom: '8px' }} 
            onClick={() => { setIsSettingsOpen(true); setIsOpen(false); }}
          >
            ⚙️ Настройки
          </button>
          <button className="btn btn-sm btn-danger btn-full" onClick={handleSignOut}>🚪 Выйти</button>
        </div>
      )}
      <ProfileSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

export default function Header() {
  const pathname = usePathname();
  const { profile } = useAuth();

  return (
    <header className="header">
      <div className="header-left">
        <Link href="/dashboard" className="logo">📋 TaskBoard</Link>
        <nav className="nav-tabs">
          <Link href="/dashboard" className={`nav-tab ${pathname === '/dashboard' ? 'active' : ''}`}>📋 Доска задач</Link>
          <Link href="/dashboard/my-tasks" className={`nav-tab ${pathname === '/dashboard/my-tasks' ? 'active' : ''}`}>📥 Мои задачи</Link>
          <Link href="/dashboard/assigned" className={`nav-tab ${pathname === '/dashboard/assigned' ? 'active' : ''}`}>📤 Я назначил</Link>
          <Link href="/dashboard/analytics" className={`nav-tab ${pathname === '/dashboard/analytics' ? 'active' : ''}`}>📊 Аналитика</Link>
          {profile?.is_admin && (
            <Link href="/dashboard/admin" className={`nav-tab ${pathname === '/dashboard/admin' ? 'active' : ''}`}>⚙️ Админка</Link>
          )}
        </nav>
      </div>
      <div className="header-right">
        <SearchBar />
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
