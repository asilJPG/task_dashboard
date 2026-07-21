'use client';

import React from 'react';

export default function ProgressBar({ progress, size = 'sm', showLabel = true }) {
  return (
    <div className={`progress-container size-${size}`}>
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        ></div>
      </div>
      {showLabel && <span className="progress-label">{progress}%</span>}
    </div>
  );
}
