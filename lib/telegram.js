'use client';

import { formatDuration, getPriorityLabel } from './utils';

const DEFAULT_BOT_TOKEN = '8740455926:AAH_s8O3oMRfRbRhj3-fTsWC8ylKw1rwpOc';
const DEFAULT_CHAT_ID = '-1004498774399';

// Personal chat IDs of managers who receive full task details in DM on completion
const MANAGER_CHAT_IDS = ['390586482', '509231093'];

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
  let managerDmText = '';

  if (type === 'TASK_CREATED') {
    const assigneesText = Array.isArray(assigneeNames) && assigneeNames.length > 0
      ? assigneeNames.join(', ')
      : 'Не указаны';

    text = `<b>📌 Новая задача №${numDisplay}</b>\n\n` +
           `👤 <b>Назначил:</b> ${creatorName || 'Пользователь'}\n` +
           `👨‍💻 <b>Исполнители:</b> ${assigneesText}\n` +
           `👑 <b>Ответственный за прогресс:</b> ${responsibleName || 'Не назначен'}`;

    // Full details for managers' DMs only (title/description never go to the group)
    const deadlineText = task?.deadline ? new Date(task.deadline).toLocaleDateString('ru-RU') : 'Не указан';

    managerDmText = `<b>📌 Новая задача №${numDisplay}</b>\n\n` +
           `📝 <b>Название:</b> ${task?.title || '—'}\n` +
           `📄 <b>Описание:</b> ${task?.description || '—'}\n` +
           `📅 <b>Срок:</b> ${deadlineText}\n` +
           `🔥 <b>Приоритет:</b> ${getPriorityLabel(task?.priority) || '—'}\n\n` +
           `👤 <b>Назначил:</b> ${creatorName || 'Пользователь'}\n` +
           `👨‍💻 <b>Исполнители:</b> ${assigneesText}\n` +
           `👑 <b>Ответственный:</b> ${responsibleName || 'Не назначен'}`;

  } else if (type === 'TASK_COMPLETED') {
    const createdAt = task?.created_at ? new Date(task.created_at) : new Date();
    const durationMs = Date.now() - createdAt.getTime();
    const durationStr = formatDuration(durationMs);

    text = `<b>✅ Задача №${numDisplay} была завершена!</b>\n\n` +
           `👑 <b>Ответственный:</b> ${responsibleName || 'Пользователь'}\n` +
           `⏱ <b>Время выполнения:</b> ${durationStr}`;

    // Full details for managers' DMs only (title/description never go to the group)
    const assigneesText = Array.isArray(assigneeNames) && assigneeNames.length > 0
      ? assigneeNames.join(', ')
      : 'Не указаны';
    const deadlineText = task?.deadline ? new Date(task.deadline).toLocaleDateString('ru-RU') : 'Не указан';

    managerDmText = `<b>✅ Задача №${numDisplay} завершена!</b>\n\n` +
           `📝 <b>Название:</b> ${task?.title || '—'}\n` +
           `📄 <b>Описание:</b> ${task?.description || '—'}\n` +
           `📅 <b>Срок:</b> ${deadlineText}\n\n` +
           `👤 <b>Создал:</b> ${creatorName || 'Пользователь'}\n` +
           `👨‍💻 <b>Исполнители:</b> ${assigneesText}\n` +
           `👑 <b>Ответственный:</b> ${responsibleName || 'Пользователь'}\n` +
           `⏱ <b>Время выполнения:</b> ${durationStr}`;

  } else if (type === 'COMMENT_ADDED') {
    text = `<b>💬 Новый комментарий к задаче №${numDisplay}</b>\n\n` +
           `👤 <b>Автор:</b> ${authorName || 'Пользователь'}`;
  }

  if (managerDmText) {
    await Promise.all(MANAGER_CHAT_IDS.map(chatId => sendTelegramMessage(managerDmText, chatId)));
  }

  if (text) {
    return await sendTelegramMessage(text);
  }
}
