'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function ProfileSettingsModal({ isOpen, onClose }) {
  const { profile, updateProfile } = useAuth();

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [avatar, setAvatar] = useState('👨‍💻');
  const [color, setColor] = useState('#7c3aed');

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const avatars = ['👨‍💻', '👩‍💻', '🧑‍💼', '👨‍🎨', '👩‍🔬', '🧑‍🚀', '🦊', '🐱', '🐶', '🦁', '🐯', '🐻', '🎯', '🚀', '⭐', '💎', '🔥', '⚡'];
  const colors = ['#7c3aed', '#3b82f6', '#ef4444', '#f59e0b', '#34d399', '#ec4899', '#f97316', '#06b6d4'];

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setAvatar(profile.avatar || '👨‍💻');
      setColor(profile.color || '#7c3aed');
      setPassword(profile.password || '');
      setConfirmPassword(profile.password || '');
    }
  }, [profile, isOpen]);

  if (!isOpen || !profile) return null;

  const userRole = profile.role || (profile.is_admin ? 'admin' : 'employee');

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      if (!name.trim()) throw new Error('Пожалуйста, укажите ваше имя');
      if (password.length < 6) throw new Error('Пароль должен состоять минимум из 6 символов');
      if (password !== confirmPassword) throw new Error('Пароли не совпадают');

      const { error: updateError } = await updateProfile({
        name,
        avatar,
        color,
        password
      });

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.message || 'Произошла ошибка при сохранении настроек');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>⚙️ Настройки профиля</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSave}>
          <div className="modal-body">
            {error && <div className="error-message" style={{ marginBottom: '14px' }}>{error}</div>}
            {success && <div style={{ background: 'rgba(46, 160, 67, 0.1)', border: '1px solid rgba(46, 160, 67, 0.2)', color: '#3fb950', padding: '8px', borderRadius: '6px', fontSize: '13px', marginBottom: '14px', textAlign: 'center' }}>Настройки сохранены!</div>}

            <div className="form-group">
              <label className="form-label">Ваш логин для входа</label>
              <input 
                type="text" 
                className="form-input" 
                value={profile.username || profile.email?.split('@')[0] || ''} 
                disabled 
                style={{ opacity: 0.7, cursor: 'not-allowed', background: '#0d1117' }} 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Ваше имя и фамилия</label>
              <input 
                type="text" 
                className="form-input" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Роль в системе</label>
              <div style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {userRole === 'admin' && <span className="status-badge" style={{ backgroundColor: 'rgba(219, 109, 40, 0.15)', color: '#db6d28', fontSize: '12px', padding: '3px 10px', margin: 0 }}>👑 Администратор</span>}
                {userRole === 'manager' && <span className="status-badge" style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: '12px', padding: '3px 10px', margin: 0 }}>🧑‍💼 Руководитель</span>}
                {userRole === 'employee' && <span className="status-badge" style={{ backgroundColor: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', fontSize: '12px', padding: '3px 10px', margin: 0 }}>👨‍💻 Обычный сотрудник</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Пароль</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    className="form-input" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    style={{ paddingRight: '36px', width: '100%' }}
                    required 
                  />
                  <button
                    type="button"
                    style={{
                      position: 'absolute',
                      right: '8px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: 'var(--text-secondary)'
                    }}
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Подтверждение пароля</label>
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  className="form-input" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  required 
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Стикер (Аватар)</label>
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

            <div className="form-group">
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
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
