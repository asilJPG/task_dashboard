'use client';

import React from 'react';

export default function FilterChips({ filters = [], activeFilter, onFilterChange }) {
  return (
    <div className="filter-chips">
      {filters.map(filter => (
        <button 
          key={filter.value} 
          className={`chip ${activeFilter === filter.value ? 'active' : ''}`}
          onClick={() => onFilterChange(filter.value)}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
