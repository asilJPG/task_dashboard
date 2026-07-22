export function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'только что';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} мин назад`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ч назад`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} дн назад`;
  
  return formatDate(dateString);
}

export function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export function getDeadlineStatus(deadline) {
  if (!deadline) return null;
  const date = new Date(deadline);
  const now = new Date();
  date.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  
  const diffTime = date - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return { class: 'overdue', text: 'Просрочено', days: diffDays };
  if (diffDays === 0) return { class: 'overdue', text: 'Сегодня!', days: 0 };
  if (diffDays <= 3) return { class: 'warning', text: `${diffDays} дн`, days: diffDays };
  return { class: 'safe', text: `${diffDays} дн`, days: diffDays };
}

export function getPriorityLabel(priority) {
  const labels = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
    critical: 'Критический'
  };
  return labels[priority] || priority;
}

export function getStatusLabel(status) {
  const labels = {
    new: 'Новая',
    in_progress: 'В работе',
    stopped: 'На стопе',
    done: 'Готово'
  };
  return labels[status] || status;
}

export function getPriorityEmoji(priority) {
  const emojis = {
    low: '🟢',
    medium: '🔵',
    high: '🟡',
    critical: '🔴'
  };
  return emojis[priority] || '⚪';
}

export function getStatusColor(status) {
  const colors = {
    new: '#38bdf8',
    in_progress: '#a78bfa',
    stopped: '#f97316',
    done: '#34d399'
  };
  return colors[status] || '#cbd5e1';
}

export function normalizeTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.filter(Boolean);
  if (typeof tags === 'string') {
    const trimmed = tags.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch (e) {}
    }
    return trimmed
      .replace(/^\{|\}$/g, '')
      .split(',')
      .map(t => t.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
  }
  return [];
}
