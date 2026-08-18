export function formatDuration(ms) {
  if (!ms || ms < 0) return 'меньше минуты';
  const minutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remHours = hours % 24;
    return remHours > 0 ? `${days} дн ${remHours} ч` : `${days} дн`;
  }
  if (hours > 0) {
    const remMin = minutes % 60;
    return remMin > 0 ? `${hours} ч ${remMin} мин` : `${hours} ч`;
  }
  return `${minutes || 1} мин`;
}

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

  // Overdue tasks say by how much — "Просрочено" alone gave no sense of how bad it is.
  if (diffDays < 0) return { class: 'overdue', text: `Просрочено на ${Math.abs(diffDays)} дн`, days: diffDays };
  if (diffDays === 0) return { class: 'overdue', text: 'Сегодня!', days: 0 };
  if (diffDays <= 3) return { class: 'warning', text: `Осталось ${diffDays} дн`, days: diffDays };
  return { class: 'safe', text: `Осталось ${diffDays} дн`, days: diffDays };
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * How long a task was given versus how long it actually took.
 *
 * planned  — days from creation to the deadline ("сколько давалось")
 * actual   — days from creation to hand-in ("за сколько сделал")
 * overdue  — days past the deadline at hand-in; 0 when on time
 *
 * Uses submitted_at when present: the deadline is judged by the hand-in, not by acceptance.
 */
export function getTaskTiming(task) {
  if (!task) return null;

  const created = task.created_at ? new Date(task.created_at) : null;
  const deadline = task.deadline ? new Date(`${String(task.deadline).slice(0, 10)}T23:59:59`) : null;
  const finishedRaw = task.submitted_at || task.completed_at;
  const finished = finishedRaw ? new Date(finishedRaw) : null;

  const valid = (d) => d && !isNaN(d);

  const planned = valid(created) && valid(deadline)
    ? Math.max(1, Math.ceil((deadline - created) / DAY))
    : null;

  const actual = valid(created) && valid(finished)
    ? Math.max(1, Math.ceil((finished - created) / DAY))
    : null;

  let overdue = 0;
  if (valid(deadline) && valid(finished) && finished > deadline) {
    overdue = Math.ceil((finished - deadline) / DAY);
  }

  return { planned, actual, overdue, isDone: task.status === 'done' };
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
    review: 'На рассмотрении',
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
    review: '#eab308',
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

export function getTaskNumber(task, allTasks = []) {
  if (!task) return '1';
  if (task.task_number) return String(task.task_number);

  if (Array.isArray(allTasks) && allTasks.length > 0) {
    const sorted = [...allTasks].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    const index = sorted.findIndex(t => t.id === task.id);
    if (index !== -1) return String(index + 1);
  }

  return '1';
}
