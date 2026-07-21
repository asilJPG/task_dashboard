'use client';

import React from 'react';

export default function StatCard({ icon, number, label, variant }) {
  return (
    <div className={`stat-card stat-${variant}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-number">{number}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
