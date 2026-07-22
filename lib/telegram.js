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

const DEFAULT_BOT_TOKEN = '8740455926:AAH_s8O3oMRfRbRhj3-fTsWC8ylKw1rwpOc';
const DEFAULT_CHAT_ID = '-1004498774399';

// Get Telegram settings from localStorage, env, or hardcoded defaults
export function getTelegramSettings() {
  let botToken = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || '').trim();
  let chatId = (process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID || '').trim();

  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('tb_telegram_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.botToken && parsed.botToken.trim()) {
          botToken = parsed.botToken.trim();
        }
        if (parsed && parsed.chatId && parsed.chatId.trim()) {
          chatId = parsed.chatId.trim();
        }
      } catch (e) {
        console.error('Error parsing telegram settings:', e);
      }
    }
  }

  // Force override old invalid chat ID -5386882174 or non-supergroup IDs
  if (!botToken) botToken = DEFAULT_BOT_TOKEN;
  if (!chatId || chatId === '-5386882174' || !chatId.startsWith('-100')) {
    chatId = DEFAULT_CHAT_ID;
  }

  return { botToken, chatId };
}

// Save Telegram settings
export function saveTelegramSettings(settings) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('tb_telegram_settings', JSON.stringify(settings));
  }
}

// Send a Telegram Message via Bot API
export async function sendTelegramMessage(text, targetChatId = null) {
  const { botToken, chatId: defaultChat } = getTelegramSettings();
  const chatId = targetChatId || defaultChat;

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
        chat_id: String(chatId).trim(),
        text: text,
        parse_mode: 'HTML'
      })
    });

    const data = await response.json();
    if (!data.ok) {
      if (data.parameters && data.parameters.migrate_to_chat_id) {
        const newSupergroupId = data.parameters.migrate_to_chat_id;
        saveTelegramSettings({ botToken, chatId: String(newSupergroupId) });
        return await sendTelegramMessage(text, newSupergroupId);
      }
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
  const { task, creatorName, assigneeNames, responsibleName, authorName, taskNumber } = payload;
  const numDisplay = task?.task_number || taskNumber || (task?.id ? task.id.slice(0, 5) : '1');

  let text = '';

  if (type === 'TASK_CREATED') {
    const assigneesText = Array.isArray(assigneeNames) && assigneeNames.length > 0
      ? assigneeNames.join(', ')
      : 'Не указаны';

    text = `<b>📌 Новая задача №${numDisplay}</b>\n\n` +
           `👤 <b>Назначил:</b> ${creatorName || 'Пользователь'}\n` +
           `👨‍💻 <b>Исполнители:</b> ${assigneesText}\n` +
           `👑 <b>Ответственный за прогресс:</b> ${responsibleName || 'Не назначен'}`;

  } else if (type === 'TASK_COMPLETED') {
    const createdAt = task?.created_at ? new Date(task.created_at) : new Date();
    const durationMs = Date.now() - createdAt.getTime();
    const durationStr = formatDuration(durationMs);

    text = `<b>✅ Задача №${numDisplay} была завершена!</b>\n\n` +
           `👑 <b>Ответственный:</b> ${responsibleName || 'Пользователь'}\n` +
           `⏱ <b>Время выполнения:</b> ${durationStr}`;

  } else if (type === 'COMMENT_ADDED') {
    text = `<b>💬 Новый комментарий к задаче №${numDisplay}</b>\n\n` +
           `👤 <b>Автор:</b> ${authorName || 'Пользователь'}`;
  }

  if (text) {
    return await sendTelegramMessage(text);
  }
}
