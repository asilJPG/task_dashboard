'use client';

import React, { useState, useEffect } from 'react';

export default function TaskFormModal({ isOpen, onClose, onSave, task, profiles = [], currentUser }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState('medium');
  const [deadline, setDeadline] = useState('');
  const [progress, setProgress] = useState(0);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setAssignedTo(task.assigned_to || '');
      setPriority(task.priority || 'medium');
      setDeadline(task.deadline || '');
      setProgress(task.progress || 0);
      setTags(task.tags || []);
    } else {
      setTitle('');
      setDescription('');
      setAssignedTo('');
      setPriority('medium');
      setDeadline('');
      setProgress(0);
      setTags([]);
    }
  }, [task, isOpen]);

  if (!isOpen) return null;

  const handleTagAdd = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!assignedTo) {
      alert('Пожалуйста, выберите исполнителя.');
      return;
    }
    
    const payload = {
      title,
      description,
      assigned_to: assignedTo,
      priority,
      deadline: deadline || null,
      progress,
      tags
    };
    if (task?.id) {
      payload.id = task.id;
    }
    onSave(payload);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{task ? 'Редактировать задачу' : 'Новая задача'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Название *</label>
              <input 
                className="form-input" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                required 
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Описание</label>
              <textarea 
                className="form-textarea" 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Исполнитель *</label>
                <select 
                  className="form-select" 
                  value={assignedTo} 
                  onChange={(e) => setAssignedTo(e.target.value)}
                  required
                >
                  <option value="">Выберите исполнителя</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name} {p.id === currentUser?.id ? '(Вы)' : ''}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Приоритет</label>
                <select 
                  className="form-select" 
                  value={priority} 
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="low">Низкий 🟢</option>
                  <option value="medium">Средний 🔵</option>
                  <option value="high">Высокий 🟡</option>
                  <option value="critical">Критичный 🔴</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Дедлайн</label>
              <input 
                type="date" 
                className="form-input" 
                value={deadline} 
                onChange={(e) => setDeadline(e.target.value)} 
              />
            </div>

            {task && (
              <div className="form-group">
                <label className="form-label">Прогресс ({progress}%):</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {[0, 25, 50, 75, 100].map(val => (
                    <button
                      type="button"
                      key={val}
                      className={`btn btn-sm ${progress === val ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '4px 12px', fontSize: '12px' }}
                      onClick={() => setProgress(val)}
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Теги</label>
              <div className="tag-input-container">
                <div className="tag-list">
                  {tags.map(tag => (
                    <span key={tag} className="tag-pill">
                      {tag} <button type="button" className="tag-remove" onClick={() => removeTag(tag)}>×</button>
                    </span>
                  ))}
                </div>
                <input 
                  className="tag-input" 
                  placeholder="Добавить тег (Enter)" 
                  value={tagInput} 
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagAdd}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
              <button type="submit" className="btn btn-primary">{task ? 'Сохранить' : 'Создать задачу'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
