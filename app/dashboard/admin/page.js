'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const { profile, loading, adminCreateUser } = useAuth();
  const router = useRouter();

  const [usersList, setUsersList] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('👨‍💻');
  const [color, setColor] = useState('#7c3aed');
  
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
    if (!loading && (!profile || !profile.is_admin)) {
      router.push('/dashboard');
    } else {
      fetchUsers();
    }
  }, [profile, loading, router]);

  if (loading || !profile || !profile.is_admin) {
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

      const { error: createError } = await adminCreateUser(username, password, name, avatar, color);
      if (createError) throw createError;

      setSuccess(`Пользователь "${name}" успешно создан! Логин: ${username.toLowerCase()}`);
      setUsername('');
      setPassword('');
      setName('');
      setAvatar('👨‍💻');
      setColor('#7c3aed');
      
      // Refresh list of users
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Произошла ошибка при создании пользователя');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="dashboard-view" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h2>⚙️ Панель администратора</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>
        Здесь вы можете регистрировать новых сотрудников и управлять списком вашей команды.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
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
            Список сотрудников ({usersList.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '550px', overflowY: 'auto', paddingRight: '4px' }}>
            {usersList.map(u => (
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
                    {u.is_admin && <span className="status-badge" style={{ backgroundColor: 'rgba(219, 109, 40, 0.1)', color: '#db6d28', fontSize: '10px', padding: '1px 6px', margin: 0 }}>Админ</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Логин: {u.username || u.email?.split('@')[0]}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
