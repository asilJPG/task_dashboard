'use client';

import React, { useState, useEffect } from 'react';

export default function TaskFormModal({ isOpen, onClose, onSave, task, profiles = [], currentUser }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [responsibleId, setResponsibleId] = useState('');
  const [priority, setPriority] = useState('medium');
  const [deadline, setDeadline] = useState('');
  const [progress, setProgress] = useState(0);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      const initialAssignees = Array.isArray(task.assignees) && task.assignees.length > 0
        ? task.assignees
        : (task.assigned_to ? [task.assigned_to] : []);
      setAssignees(initialAssignees);
      setAssignedTo(task.assigned_to || initialAssignees[0] || '');
      setResponsibleId(task.responsible_id || task.assigned_to || initialAssignees[0] || '');
      setPriority(task.priority || 'medium');
      setDeadline(task.deadline || '');
      setProgress(task.progress || 0);
      setTags(task.tags || []);
    } else {
      setTitle('');
      setDescription('');
      setAssignedTo('');
      setAssignees(currentUser?.id ? [currentUser.id] : []);
      setResponsibleId(currentUser?.id || '');
      setPriority('medium');
      setDeadline('');
      setProgress(0);
      setTags([]);
    }
  }, [task, isOpen, currentUser]);

  if (!isOpen) return null;

  const handleAssigneeToggle = (profileId) => {
    setAssignees(prev => {
      let updated;
      if (prev.includes(profileId)) {
        updated = prev.filter(id => id !== profileId);
      } else {
        updated = [...prev, profileId];
      }
      if (updated.length > 0 && !updated.includes(responsibleId)) {
        setResponsibleId(updated[0]);
      }
      return updated;
    });
  };

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
    if (assignees.length === 0) {
      alert('Пожалуйста, выберите хотя бы одного исполнителя.');
      return;
    }
    const finalResponsible = responsibleId || assignees[0];

    const payload = {
      title,
      description,
      assigned_to: assignees[0],
      assignees,
      responsible_id: finalResponsible,
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

            <div className="form-group">
              <label className="form-label">👨‍💻 Исполнители (выберите без ограничений) *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px', background: '#0d1117', border: '1px solid var(--border-color)', borderRadius: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                {profiles
                  .filter(p => p.username !== 'admin' && !p.is_admin && p.role !== 'admin')
                  .map(p => {
                    const isChecked = assignees.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`btn btn-sm ${isChecked ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                        onClick={() => handleAssigneeToggle(p.id)}
                      >
                        {isChecked ? '✓ ' : '+ '}{p.name} {p.id === currentUser?.id ? '(Вы)' : ''}
                      </button>
                    );
                })}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">👑 Ответственный за прогресс и статус *</label>
                <select 
                  className="form-select" 
                  value={responsibleId} 
                  onChange={(e) => setResponsibleId(e.target.value)}
                  required
                >
                  <option value="">Выберите ответственного</option>
                  {profiles
                    .filter(p => p.username !== 'admin' && !p.is_admin && p.role !== 'admin')
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.name} {p.id === currentUser?.id ? '(Вы)' : ''}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ flex: 1 }}>
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
