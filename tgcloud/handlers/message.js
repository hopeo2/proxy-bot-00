import { api } from 'sdk';
import { ADMIN_IDS, BATCH_SIZE, CHANNEL, MAX_BATCH } from '../lib/config.js';
import { getStats, publishBatch } from '../lib/publisher.js';

function isAdmin(userId) {
  return ADMIN_IDS.map(Number).includes(Number(userId));
}

function parseCount(args) {
  const n = Number.parseInt(args[0], 10);
  if (!Number.isFinite(n)) return BATCH_SIZE;
  return Math.max(1, Math.min(n, MAX_BATCH));
}

export default async function (message) {
  // Scheduled/CLI invocation:
  //   npx tgcloud run handlers/message '{"cron":true,"trigger":"cron"}'
  // A real Telegram Message never carries a `cron` field.
  if (message?.cron === true) {
    return publishBatch({
      trigger: message.trigger || 'cron',
      force: message.force === true,
      count: message.count ? Number(message.count) : BATCH_SIZE,
      tier: message.tier || undefined,
    });
  }

  const chatId = message?.chat?.id;
  const text = String(message?.text || '').trim();
  if (!chatId || !text.startsWith('/')) return;

  const [rawCommand, ...args] = text.split(/\s+/);
  const command = rawCommand.split('@')[0].toLowerCase();
  const userId = message.from?.id;

  if (command === '/start' || command === '/help') {
    await api.sendMessage({
      chat_id: chatId,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      text: [
        '<b>Free Proxy Bot</b>',
        '',
        `Fetches verified MTProto proxies from <a href="https://github.com/0xRadikal/Free-Telegram-Proxy">Free-Telegram-Proxy</a> and publishes them to ${CHANNEL}.`,
        '',
        '<b>Commands</b>',
        '/post [n] — publish a batch to the channel',
        '/preview [n] — send a batch to this chat (does not consume the queue)',
        '/stats — posting statistics',
        '/id — show your Telegram ID',
        '',
        `Your Telegram ID: <code>${userId ?? 'unknown'}</code>`,
        ADMIN_IDS.length === 0
          ? '\n⚠️ No admins configured yet. Add your ID to <code>ADMIN_IDS</code> in <code>tgcloud/lib/config.js</code>, then run <code>npx tgcloud push</code>.'
          : '',
      ].join('\n'),
    });
    return;
  }

  if (command === '/id') {
    await api.sendMessage({
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `Your Telegram ID: <code>${userId ?? 'unknown'}</code>`,
    });
    return;
  }

  if (!isAdmin(userId)) {
    await api.sendMessage({
      chat_id: chatId,
      parse_mode: 'HTML',
      text: [
        '⛔ <b>Not authorized.</b>',
        '',
        `Your Telegram ID: <code>${userId ?? 'unknown'}</code>`,
        'Add it to <code>ADMIN_IDS</code> in <code>tgcloud/lib/config.js</code>, then run <code>npx tgcloud push</code>.',
      ].join('\n'),
    });
    return;
  }

  if (command === '/post') {
    try {
      const result = await publishBatch({
        chatId: CHANNEL,
        count: parseCount(args),
        trigger: 'dm',
        force: true,
      });
      await api.sendMessage({
        chat_id: chatId,
        text: result.skipped
          ? `⏳ Skipped: cooldown, try again in ${result.waitMinutes} min.`
          : `✅ Posted ${result.posted} proxies to ${CHANNEL}.`,
      });
    } catch (err) {
      await api.sendMessage({
        chat_id: chatId,
        text: `❌ Posting failed: ${err?.description || err?.message || err}`,
      });
    }
    return;
  }

  if (command === '/preview') {
    try {
      const result = await publishBatch({
        chatId,
        count: parseCount(args),
        trigger: 'preview',
        force: true,
        record: false,
      });
      await api.sendMessage({ chat_id: chatId, text: `🧪 Preview sent: ${result.posted} proxies.` });
    } catch (err) {
      await api.sendMessage({
        chat_id: chatId,
        text: `❌ Preview failed: ${err?.description || err?.message || err}`,
      });
    }
    return;
  }

  if (command === '/stats') {
    const stats = await getStats();
    await api.sendMessage({
      chat_id: chatId,
      parse_mode: 'HTML',
      text: [
        '<b>Proxy bot stats</b>',
        '',
        `Channel: <b>${stats.channel}</b>`,
        `Tracked proxies: <b>${stats.trackedProxies}</b>`,
        `Batches: <b>${stats.batches}</b> (${stats.failedBatches} failed)`,
        `Proxies posted: <b>${stats.proxiesPosted}</b>`,
        `Last post: <b>${stats.lastPostAt ?? 'never'}</b>`,
      ].join('\n'),
    });
    return;
  }

  await api.sendMessage({ chat_id: chatId, text: 'Unknown command. Try /help.' });
}
