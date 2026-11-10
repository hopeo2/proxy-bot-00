import { api, BotApiError } from 'sdk';
import { BATCH_SIZE, MAX_BATCH } from '../lib/config.js';
import { publishBatch } from '../lib/publisher.js';

/**
 * Trigger a batch from inside the channel itself:
 *   /post        → 10 proxies
 *   /post 5      → 5 proxies
 *
 * Only channel administrators can post in a channel, so no extra auth check is
 * needed. The command message is deleted afterwards to keep the channel clean.
 */
export default async function (post) {
  const text = String(post?.text || '').trim();
  if (!text.startsWith('/')) return;

  const [rawCommand, ...args] = text.split(/\s+/);
  const command = rawCommand.split('@')[0].toLowerCase();
  if (command !== '/post' && command !== '/proxy') return;

  const chatId = post.chat.id;
  const parsed = Number.parseInt(args[0], 10);
  const count = Number.isFinite(parsed)
    ? Math.max(1, Math.min(parsed, MAX_BATCH))
    : BATCH_SIZE;

  try {
    await api.deleteMessage({ chat_id: chatId, message_id: post.message_id });
  } catch (err) {
    // The bot needs "Delete messages" in the channel; posting still works if not.
    if (!(err instanceof BotApiError)) throw err;
  }

  await publishBatch({ chatId, count, trigger: 'channel', force: true });
}
