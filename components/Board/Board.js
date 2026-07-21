'use client';

import React, { useState } from 'react';
import TaskCard from '../TaskCard/TaskCard';

const columns = [
  { id: 'new', title: 'Новая', icon: '📋', color: '#38bdf8' },
  { id: 'in_progress', title: 'В работе', icon: '🔄', color: '#a78bfa' },
  { id: 'stopped', title: 'На стопе', icon: '🛑', color: '#f97316' },
  { id: 'done', title: 'Готово', icon: '✅', color: '#34d399' }
];

export default function Board({ tasks = [], profiles = [], onTaskClick, onStatusChange, currentUserId }) {
  const [draggedTaskId, setDraggedTaskId] = useState(null);

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

  return (
    <div className="board">
      <div className="board-columns">
        {columns.map(col => {
          const colTasks = tasks
            .filter(t => t.status === col.id)
            .sort((a, b) => {
              if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
              if (!a.deadline) return 1;
              if (!b.deadline) return -1;
              return new Date(a.deadline) - new Date(b.deadline);
            });

          return (
            <div key={col.id} className="board-column">
              <div className="column-header" style={{ borderTopColor: col.color }}>
                <span className="column-icon">{col.icon}</span>
                <span className="column-title">{col.title}</span>
                <span className="column-count badge">{colTasks.length}</span>
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
