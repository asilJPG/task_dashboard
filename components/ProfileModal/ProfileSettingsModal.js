'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function ProfileSettingsModal({ isOpen, onClose }) {
  const { profile, updateProfile } = useAuth();

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
          <h3>Настройки профиля</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSave}>
          <div className="modal-body">
            {error && <div className="error-message" style={{ marginBottom: '14px' }}>{error}</div>}
            {success && <div style={{ background: 'rgba(46, 160, 67, 0.1)', border: '1px solid rgba(46, 160, 67, 0.2)', color: '#3fb950', padding: '8px', borderRadius: '6px', fontSize: '13px', marginBottom: '14px', textAlign: 'center' }}>Настройки сохранены!</div>}

            <div className="form-group">
              <label className="form-label">Ваше имя (русскими буквами)</label>
              <input 
                type="text" 
                className="form-input" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
              />
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Новый пароль</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Подтвердите пароль</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  required 
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Стикер (Аватар)</label>
              <div className="avatar-selector" style={{ gridTemplateColumns: 'repeat(9, 1fr)' }}>
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
