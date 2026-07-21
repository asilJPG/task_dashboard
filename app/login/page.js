'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { signIn } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!username.trim()) throw new Error('Пожалуйста, введите логин (имя)');
      if (!password.trim()) throw new Error('Пожалуйста, введите пароль');
      
      const { error } = await signIn(username, password);
      if (error) throw error;
      router.push('/dashboard');
    } catch (err) {
      setError(err.message || 'Произошла ошибка при входе');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login-screen">
      <div className="login-card" style={{ maxWidth: '360px' }}>
        <h1 className="login-title">TaskBoard</h1>
        <p className="login-subtitle">Панель управления задачами</p>

        <form onSubmit={handleSubmit} style={{ marginTop: '10px' }}>
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label className="form-label">Имя (логин)</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Введите ваше имя"
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required 
            />
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Пароль</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="••••••••"
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Загрузка...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
