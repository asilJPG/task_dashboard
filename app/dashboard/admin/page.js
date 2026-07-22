'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { getTelegramSettings, saveTelegramSettings, sendTelegramMessage } from '@/lib/telegram';

export default function AdminPage() {
  const { profile, loading, adminCreateUser, updateUserRole, adminDeleteUser } = useAuth();
  const router = useRouter();

  const [usersList, setUsersList] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('👨‍💻');
  const [color, setColor] = useState('#7c3aed');
  const [role, setRole] = useState('employee');
  
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [creating, setCreating] = useState(false);

  const avatars = ['👨‍💻', '👩‍💻', '🧑‍💼', '👨‍🎨', '👩‍🔬', '🧑‍🚀', '🦊', '🐱', '🐶', '🦁', '🐯', '🐻', '🎯', '🚀', '⭐', '💎', '🔥', '⚡'];
  const colors = ['#7c3aed', '#3b82f6', '#ef4444', '#f59e0b', '#34d399', '#ec4899', '#f97316', '#06b6d4'];

  const fetchUsers = async () => {
    const { data } = await supabase.from('tb_profiles').select('*').order('created_at', { ascending: true });
    if (data) setUsersList(data);
  };

  useEffect(() => {
    if (!loading && (!profile || (!profile.is_admin && profile.role !== 'admin'))) {
      router.push('/dashboard');
    } else {
      fetchUsers();
    }
  }, [profile, loading, router]);

  if (loading || !profile || (!profile.is_admin && profile.role !== 'admin')) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setCreating(true);

    try {
      if (!username.trim()) throw new Error('Пожалуйста, введите логин');
      if (username.includes(' ')) throw new Error('Логин не должен содержать пробелы');
      if (password.length < 6) throw new Error('Пароль должен состоять минимум из 6 символов');
      if (!name.trim()) throw new Error('Пожалуйста, введите имя сотрудника');

      const { error: createError } = await adminCreateUser(username, password, name, avatar, color, role);
      if (createError) throw createError;

      const roleLabel = role === 'manager' ? 'Руководитель' : role === 'admin' ? 'Администратор' : 'Обычный сотрудник';
      setSuccess(`Пользователь "${name}" (${roleLabel}) успешно создан! Логин: ${username.toLowerCase()}`);
      setUsername('');
      setPassword('');
      setName('');
      setAvatar('👨‍💻');
      setColor('#7c3aed');
      setRole('employee');
      
      // Refresh list of users
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Произошла ошибка при создании пользователя');
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (targetUserId, newRole) => {
    const { error: updateError } = await updateUserRole(targetUserId, newRole);
    if (!updateError) {
      fetchUsers();
    } else {
      alert('Ошибка при изменении роли: ' + (updateError.message || 'Не удалось обновить'));
    }
  };

  const handleDeleteUser = async (targetUser) => {
    if (window.confirm(`Вы действительно хотите удалить сотрудника "${targetUser.name}" (@${targetUser.username})?`)) {
      const { error: delError } = await adminDeleteUser(targetUser.id);
      if (!delError) {
        fetchUsers();
      } else {
        alert('Ошибка при удалении пользователя: ' + (delError.message || 'Не удалось удалить'));
      }
    }
  };

  const [tgBotToken, setTgBotToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [tgMsgStatus, setTgMsgStatus] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const { botToken, chatId } = getTelegramSettings();
      setTgBotToken(botToken || '');
      setTgChatId(chatId || '');
    }
  }, []);

  const handleSaveTelegram = (e) => {
    e.preventDefault();
    saveTelegramSettings({ botToken: tgBotToken, chatId: tgChatId });
    setTgMsgStatus({ type: 'success', text: 'Настройки Telegram сохранены!' });
    setTimeout(() => setTgMsgStatus(null), 3000);
  };

  const handleTestTelegram = async () => {
    setTgMsgStatus({ type: 'info', text: 'Отправка тестового сообщения...' });
    const res = await sendTelegramMessage('<b>🤖 TaskBoard:</b> Тестовое уведомление успешно отправлено в группу!');
    if (res.success) {
      setTgMsgStatus({ type: 'success', text: 'Тестовое сообщение отправлено в Telegram-группу! Check your chat.' });
    } else {
      setTgMsgStatus({ type: 'error', text: 'Ошибка отправки: ' + (res.error || 'Проверьте токен и ID группы') });
    }
  };

  return (
    <div className="dashboard-view" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h2>⚙️ Панель администратора</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>
        Здесь вы можете регистрировать новых сотрудников, назначать им роли, управлять командой и настраивать уведомления в Telegram-группу.
      </p>

      {/* Telegram Group Notification Settings */}
      <div className="analytics-card" style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📢 Уведомления в Telegram-группу</span>
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          🔒 <strong>Политика конфиденциальности:</strong> В группу приходят уведомления о новых задачах, их завершении и комментариях. <u>Названия и описание задач НЕ публикуются в группе</u>, чтобы другие сотрудники не могли читать чужие конфиденциальные задачи.
        </p>

        {tgMsgStatus && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            marginBottom: '16px',
            background: tgMsgStatus.type === 'success' ? 'rgba(46, 160, 67, 0.15)' : tgMsgStatus.type === 'error' ? 'rgba(248, 81, 73, 0.15)' : 'rgba(56, 189, 248, 0.15)',
            border: `1px solid ${tgMsgStatus.type === 'success' ? '#3fb950' : tgMsgStatus.type === 'error' ? '#f85149' : '#38bdf8'}`,
            color: tgMsgStatus.type === 'success' ? '#3fb950' : tgMsgStatus.type === 'error' ? '#f85149' : '#38bdf8'
          }}>
            {tgMsgStatus.text}
          </div>
        )}

        <form onSubmit={handleSaveTelegram} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Токен Telegram бота (Bot Token)</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Пример: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              value={tgBotToken}
              onChange={e => setTgBotToken(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">ID Telegram группы (Chat ID)</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Пример: -1001234567890"
              value={tgChatId}
              onChange={e => setTgChatId(e.target.value)}
            />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '13px' }}>
              💾 Сохранить настройки TG
            </button>
            <button type="button" className="btn btn-secondary" style={{ padding: '8px 20px', fontSize: '13px' }} onClick={handleTestTelegram}>
              💬 Отправить тестовое сообщение
            </button>
          </div>
        </form>
      </div>

      <div className="admin-grid">
        {/* User Creation Form */}
        <div className="analytics-card" style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            Добавить сотрудника
          </h3>

          <form onSubmit={handleCreateUser}>
            {error && <div className="error-message">{error}</div>}
            {success && <div style={{ background: 'rgba(46, 160, 67, 0.1)', border: '1px solid rgba(46, 160, 67, 0.2)', color: '#3fb950', padding: '10px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>{success}</div>}

            <div className="form-group">
              <label className="form-label">Логин для входа (английскими буквами)</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Пример: ivan, a.smirnov"
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                required 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Пароль (минимум 6 символов)</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Введи пароль для сотрудника"
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Имя и Фамилия сотрудника (русскими буквами)</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Пример: Иван Иванов"
                value={name} 
                onChange={e => setName(e.target.value)} 
                required 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Роль в системе</label>
              <select 
                className="form-select" 
                value={role} 
                onChange={e => setRole(e.target.value)}
              >
                <option value="employee">👨‍💻 Обычный сотрудник (видит только свои задачи)</option>
                <option value="manager">🧑‍💼 Руководитель (видит все задачи и аналитику)</option>
                <option value="admin">👑 Администратор (полный доступ)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Аватар сотрудника</label>
              <div className="avatar-selector">
                {avatars.map(emoji => (
                  <button 
                    type="button" 
                    key={emoji} 
                    className={`avatar-option ${avatar === emoji ? 'selected' : ''}`} 
                    onClick={() => setAvatar(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Цвет профиля</label>
              <div className="color-selector">
                {colors.map(c => (
                  <button 
                    type="button" 
                    key={c} 
                    className={`color-option ${color === c ? 'selected' : ''}`} 
                    style={{ backgroundColor: c }} 
                    onClick={() => setColor(c)} 
                  />
                ))}
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={creating}>
              {creating ? 'Создание...' : 'Зарегистрировать сотрудника'}
            </button>
          </form>
        </div>

        {/* Active Team List */}
        <div className="analytics-card">
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            Список сотрудников ({usersList.filter(u => u.username !== 'admin' && !u.is_admin && u.role !== 'admin').length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '550px', overflowY: 'auto', paddingRight: '4px' }}>
            {usersList
              .filter(u => u.username !== 'admin' && !u.is_admin && u.role !== 'admin')
              .map(u => {
                const currentRole = u.role || (u.is_admin ? 'admin' : 'employee');
              return (
                <div 
                  key={u.id} 
                  className="comment" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    padding: '10px 14px', 
                    border: '1px solid var(--border-color)',
                    background: '#0d1117'
                  }}
                >
                  <div 
                    className="avatar-circle" 
                    style={{ 
                      backgroundColor: u.color || 'var(--accent)', 
                      width: '32px', 
                      height: '32px', 
                      fontSize: '16px',
                      flexShrink: 0
                    }}
                  >
                    {u.avatar || '👤'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {u.name}
                      {currentRole === 'admin' && (
                        <span className="status-badge" style={{ backgroundColor: 'rgba(219, 109, 40, 0.15)', color: '#db6d28', fontSize: '10px', padding: '1px 6px', margin: 0 }}>Админ</span>
                      )}
                      {currentRole === 'manager' && (
                        <span className="status-badge" style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: '10px', padding: '1px 6px', margin: 0 }}>Руководитель</span>
                      )}
                      {currentRole === 'employee' && (
                        <span className="status-badge" style={{ backgroundColor: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', fontSize: '10px', padding: '1px 6px', margin: 0 }}>Сотрудник</span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Логин: {u.username || u.email?.split('@')[0]}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                      className="form-select"
                      style={{ padding: '4px 8px', fontSize: '11px', width: 'auto', background: '#161b22', borderColor: 'var(--border-color)', borderRadius: '6px' }}
                      value={currentRole}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    >
                      <option value="employee">👨‍💻 Сотрудник</option>
                      <option value="manager">🧑‍💼 Руководитель</option>
                      <option value="admin">👑 Админ</option>
                    </select>

                    {u.id !== profile?.id && (
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                        title="Удалить сотрудника"
                        onClick={() => handleDeleteUser(u)}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
