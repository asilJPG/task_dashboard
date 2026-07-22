'use client';

// Helper to format time duration from milliseconds
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

// Get Telegram settings from localStorage or fallback to env
export function getTelegramSettings() {
  if (typeof window === 'undefined') {
    return {
      botToken: process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || '',
      chatId: process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID || ''
    };
  }

  const saved = localStorage.getItem('tb_telegram_settings');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing telegram settings:', e);
    }
  }

  return {
    botToken: process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID || ''
  };
}

// Save Telegram settings
export function saveTelegramSettings(settings) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('tb_telegram_settings', JSON.stringify(settings));
  }
}

// Send a Telegram Message via Bot API
export async function sendTelegramMessage(text) {
  const { botToken, chatId } = getTelegramSettings();
  if (!botToken || !chatId) {
    console.log('Telegram Bot Token or Chat ID not configured.');
    return { success: false, error: 'Telegram settings not configured' };
  }

  try {
    const url = `https://api.telegram.org/bot${botToken.trim()}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text: text,
        parse_mode: 'HTML'
      })
    });

    const data = await response.json();
    if (!data.ok) {
      console.error('Telegram API error:', data);
      return { success: false, error: data.description };
    }
    return { success: true };
  } catch (err) {
    console.error('Failed to send Telegram message:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Send privacy-compliant group notifications
 * CONFIDENTIAL RULE: Never expose task title or description in group messages!
 */
export async function sendTelegramNotification(type, payload) {
  const { task, creatorName, assigneeNames, responsibleName, authorName } = payload;
  const taskIdShort = task?.id ? task.id.slice(0, 8) : '—';

  let text = '';

  if (type === 'TASK_CREATED') {
    const assigneesText = Array.isArray(assigneeNames) && assigneeNames.length > 0
      ? assigneeNames.join(', ')
      : 'Не указаны';

    text = `<b>📌 Новая задача №${taskIdShort}</b>\n\n` +
           `👤 <b>Назначил:</b> ${creatorName || 'Пользователь'}\n` +
           `👨‍💻 <b>Исполнители:</b> ${assigneesText}\n` +
           `👑 <b>Ответственный за прогресс:</b> ${responsibleName || 'Не назначен'}`;

  } else if (type === 'TASK_COMPLETED') {
    const createdAt = task?.created_at ? new Date(task.created_at) : new Date();
    const durationMs = Date.now() - createdAt.getTime();
    const durationStr = formatDuration(durationMs);

    text = `<b>✅ Задача №${taskIdShort} была завершена!</b>\n\n` +
           `👑 <b>Ответственный:</b> ${responsibleName || 'Пользователь'}\n` +
           `⏱ <b>Время выполнения:</b> ${durationStr}`;

  } else if (type === 'COMMENT_ADDED') {
    text = `<b>💬 Новый комментарий к задаче №${taskIdShort}</b>\n\n` +
           `👤 <b>Автор:</b> ${authorName || 'Пользователь'}`;
  }

  if (text) {
    return await sendTelegramMessage(text);
  }
}
