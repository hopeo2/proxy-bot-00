import { api, db } from 'sdk';
import { eq, sql } from 'sdk/db';
import { postLog, postedProxies, settings } from '../schema.js';
import { BATCH_SIZE, CHANNEL, MIN_GAP_MINUTES, TIER } from './config.js';
import { formatProxyMessage, rankCandidates } from './format.js';
import { fetchProxies } from './proxy-source.js';

const LAST_POST_KEY = 'last_post_at';

export async function getSetting(key) {
  const row = await db.select().from(settings).where(eq(settings.key, key)).get();
  return row?.value ?? null;
}

export async function setSetting(key, value) {
  await db.insert(settings)
    .values({ key, value: String(value) })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: String(value), updatedAt: sql`(unixepoch())` },
    })
    .run();
}

/**
 * Fetch a fresh batch from the source repository and publish one message per
 * proxy. Returns a summary; throws if the source or the Bot API fails.
 *
 * @param {object} [options]
 * @param {string|number} [options.chatId]  target chat (defaults to CHANNEL)
 * @param {number} [options.count]          proxies in this batch
 * @param {string} [options.trigger]        label stored in post_log
 * @param {boolean} [options.force]         ignore the 110-minute cooldown
 * @param {string} [options.tier]           source tier (fast/resilient/…)
 * @param {boolean} [options.record]        persist rotation state (false = preview)
 * @param {boolean} [options.dryRun]        fetch + select, but send nothing
 */
export async function publishBatch({
  chatId = CHANNEL,
  count = BATCH_SIZE,
  trigger = 'manual',
  force = false,
  tier = TIER,
  record = true,
  dryRun = false,
} = {}) {
  const lastRaw = await getSetting(LAST_POST_KEY);
  const lastMs = lastRaw ? Number(lastRaw) : 0;
  const now = Date.now();
  const gapMs = MIN_GAP_MINUTES * 60_000;

  if (record && !force && lastMs && now - lastMs < gapMs) {
    const waitMinutes = Math.ceil((gapMs - (now - lastMs)) / 60_000);
    return {
      ok: true,
      skipped: true,
      reason: 'cooldown',
      waitMinutes,
      lastPostAt: new Date(lastMs).toISOString(),
    };
  }

  const proxies = await fetchProxies({ tier });
  if (proxies.length === 0) throw new Error('The proxy source returned no usable proxies.');

  const postedRows = record ? await db.select().from(postedProxies).all() : [];
  const batch = rankCandidates(proxies, postedRows, count);

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      tier,
      count: batch.length,
      candidates: batch.map((p) => ({
        server: p.server,
        port: p.port,
        country: p.country,
        rttMs: p.rttMs,
      })),
    };
  }

  const sent = [];
  try {
    for (let i = 0; i < batch.length; i++) {
      const proxy = batch[i];
      const { text, reply_markup } = formatProxyMessage(proxy, i + 1, batch.length);

      const message = await api.sendMessage({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup,
        link_preview_options: { is_disabled: true },
      });

      sent.push({ key: proxy.key, messageId: message.message_id });

      if (record) {
        await db.insert(postedProxies)
          .values({
            proxyKey: proxy.key,
            server: proxy.server,
            port: proxy.port,
            country: proxy.country || null,
            rttMs: proxy.rttMs,
            timesPosted: 1,
          })
          .onConflictDoUpdate({
            target: postedProxies.proxyKey,
            set: {
              country: proxy.country || null,
              rttMs: proxy.rttMs,
              timesPosted: sql`${postedProxies.timesPosted} + 1`,
              lastPostedAt: sql`(unixepoch())`,
            },
          })
          .run();
      }
    }
  } catch (err) {
    await db.insert(postLog).values({
      chatId: String(chatId),
      proxyCount: sent.length,
      trigger,
      status: 'error',
      error: String(err?.message || err).slice(0, 500),
    }).run();
    throw err;
  }

  if (record) await setSetting(LAST_POST_KEY, String(now));

  await db.insert(postLog).values({
    chatId: String(chatId),
    proxyCount: sent.length,
    trigger,
    status: 'ok',
  }).run();

  return {
    ok: true,
    chatId: String(chatId),
    tier,
    posted: sent.length,
    first: batch[0] ? `${batch[0].server}:${batch[0].port}` : null,
    lastPostAt: record ? new Date(now).toISOString() : null,
  };
}

export async function getStats() {
  const trackedProxies = await db.$count(postedProxies);
  const batches = await db.$count(postLog);
  const totals = await db.get(sql`
    SELECT
      COALESCE(SUM(proxy_count), 0) AS posted,
      COALESCE(SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END), 0) AS failed
    FROM post_log
  `);
  const lastRaw = await getSetting(LAST_POST_KEY);

  return {
    channel: CHANNEL,
    trackedProxies,
    batches,
    proxiesPosted: Number(totals?.posted || 0),
    failedBatches: Number(totals?.failed || 0),
    lastPostAt: lastRaw ? new Date(Number(lastRaw)).toISOString() : null,
  };
}
