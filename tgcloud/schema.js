import { table, integer, text, index, sql } from 'sdk/db';

// Remember every proxy we have published so batches rotate instead of
// repeating the same servers. No foreign keys: relationships are logical.
export const postedProxies = table('posted_proxies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  proxyKey: text('proxy_key').notNull().unique(),
  server: text('server').notNull(),
  port: integer('port').notNull(),
  country: text('country'),
  rttMs: integer('rtt_ms'),
  timesPosted: integer('times_posted').notNull().default(0),
  firstPostedAt: integer('first_posted_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  lastPostedAt: integer('last_posted_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (t) => ({
  lastPostedIdx: index('idx_posted_last_posted').on(t.lastPostedAt),
  countryIdx: index('idx_posted_country').on(t.country),
}));

// Small key/value store for runtime state (last post timestamp, etc.).
export const settings = table('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// One row per publishing attempt, for /stats and debugging.
export const postLog = table('post_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chatId: text('chat_id'),
  proxyCount: integer('proxy_count').notNull().default(0),
  trigger: text('trigger'),
  status: text('status').notNull().default('ok'),
  error: text('error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (t) => ({
  createdIdx: index('idx_post_log_created').on(t.createdAt),
}));
