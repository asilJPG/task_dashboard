'use client';

import React, { useState } from 'react';
import TaskCard from '../TaskCard/TaskCard';

const columns = [
  { id: 'new', title: 'Новая', icon: '📋', color: '#38bdf8' },
  { id: 'in_progress', title: 'В работе', icon: '🔄', color: '#a78bfa' },
  { id: 'stopped', title: 'На стопе', icon: '🛑', color: '#f97316' },
  { id: 'done', title: 'Готово', icon: '✅', color: '#34d399' }
];

const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };

export default function Board({ tasks = [], profiles = [], sortBy = 'created_desc', onTaskClick, onStatusChange, currentUserId }) {
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [activeMobileCol, setActiveMobileCol] = useState('all');

  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = (e, columnId) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (draggedTaskId) {
      onStatusChange(draggedTaskId, columnId);
    }
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
  };

  const scrollToColumn = (colId) => {
    setActiveMobileCol(colId);
    if (colId !== 'all') {
      const el = document.getElementById(`board-col-${colId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      }
    }
  };

  return (
    <div className="board">
      {/* Mobile Column Quick Switcher */}
      <div className="mobile-board-pills">
        <button
          type="button"
          className={`mobile-board-pill ${activeMobileCol === 'all' ? 'active' : ''}`}
          onClick={() => scrollToColumn('all')}
        >
          Все ({tasks.length})
        </button>
        {columns.map(col => {
          const count = tasks.filter(t => t.status === col.id).length;
          return (
            <button
              key={col.id}
              type="button"
              className={`mobile-board-pill ${activeMobileCol === col.id ? 'active' : ''}`}
              style={{ '--pill-color': col.color }}
              onClick={() => scrollToColumn(col.id)}
            >
              {col.icon} {col.title} ({count})
            </button>
          );
        })}
      </div>

      <div className="board-columns">
        {columns.map(col => {
          const colTasks = tasks
            .filter(t => t.status === col.id)
            .sort((a, b) => {
              if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;

              if (sortBy === 'priority_desc') {
                const wA = priorityWeight[a.priority] || 0;
                const wB = priorityWeight[b.priority] || 0;
                if (wA !== wB) return wB - wA;
              } else if (sortBy === 'deadline_asc') {
                if (!a.deadline && !b.deadline) return 0;
                if (!a.deadline) return 1;
                if (!b.deadline) return -1;
                const diff = new Date(a.deadline) - new Date(b.deadline);
                if (diff !== 0) return diff;
              } else if (sortBy === 'progress_desc') {
                const diff = (b.progress || 0) - (a.progress || 0);
                if (diff !== 0) return diff;
              } else if (sortBy === 'title_asc') {
                const diff = (a.title || '').localeCompare(b.title || '', 'ru');
                if (diff !== 0) return diff;
              }

              return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            });

          const isHiddenOnMobile = activeMobileCol !== 'all' && activeMobileCol !== col.id;

          return (
            <div 
              key={col.id} 
              id={`board-col-${col.id}`} 
              className={`board-column ${isHiddenOnMobile ? 'mobile-hidden' : ''}`}
            >
              <div className="column-header" style={{ borderTopColor: col.color }}>
                <span className="column-icon">{col.icon}</span>
                <span className="column-title">{col.title} ({colTasks.length})</span>
                <span 
                  className="column-count badge"
                  style={{ 
                    backgroundColor: `${col.color}25`,
                    color: col.color,
                    border: `1px solid ${col.color}50`,
                    fontWeight: 'bold',
                    padding: '2px 8px',
                    fontSize: '12px'
                  }}
                >
                  {colTasks.length}
                </span>
              </div>
              <div 
                className="column-body"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                {colTasks.length > 0 ? (
                  colTasks.map(task => (
                    <TaskCard 
                      key={task.id}
                      task={task}
                      profiles={profiles}
                      allTasks={tasks}
                      onClick={onTaskClick}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      dragging={draggedTaskId === task.id}
                    />
                  ))
                ) : (
                  <div className="empty-state">Нет задач</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
