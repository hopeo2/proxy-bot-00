// Project configuration. Everything here is deployed with the bot, so it must
// stay plain data (no secrets that you would not put in a public repo).

/** Target channel. A public channel can be addressed by its @username. */
export const CHANNEL = '@free_proxy_00';

/**
 * Telegram user IDs allowed to run admin commands in private chat.
 * Leave empty and send /id to the bot to learn your numeric ID, then add it
 * here and run `npx tgcloud push` again.
 */
export const ADMIN_IDS = [7289077755];

/** How many proxies one batch contains. */
export const BATCH_SIZE = 10;

/**
 * Minimum minutes between automatic batches. The scheduled job runs every two
 * hours; this guard prevents a retried/delayed run from double-posting while
 * still tolerating a scheduler that is ~20 minutes late.
 * Manual /post ignores it.
 */
export const MIN_GAP_MINUTES = 100;

/** Source repository and the tier used for posts. */
export const SOURCE_REPO = 'https://github.com/0xRadikal/Free-Telegram-Proxy';
export const SOURCE_BASE = 'https://raw.githubusercontent.com/0xRadikal/Free-Telegram-Proxy/main';
export const TIER = 'fast';

/** Hard cap for a single batch (Telegram flood protection). */
export const MAX_BATCH = 25;
