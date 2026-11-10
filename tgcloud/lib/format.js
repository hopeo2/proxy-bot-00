// Pure helpers: no SDK imports, so this module can also be unit-tested with
// plain Node (see scripts/selftest.mjs).

const COUNTRY_NAMES = {
  AE: 'United Arab Emirates',
  AL: 'Albania',
  AM: 'Armenia',
  AR: 'Argentina',
  AT: 'Austria',
  AU: 'Australia',
  AZ: 'Azerbaijan',
  BA: 'Bosnia and Herzegovina',
  BD: 'Bangladesh',
  BE: 'Belgium',
  BG: 'Bulgaria',
  BR: 'Brazil',
  BY: 'Belarus',
  CA: 'Canada',
  CH: 'Switzerland',
  CL: 'Chile',
  CN: 'China',
  CO: 'Colombia',
  CY: 'Cyprus',
  CZ: 'Czechia',
  DE: 'Germany',
  DK: 'Denmark',
  EE: 'Estonia',
  EG: 'Egypt',
  ES: 'Spain',
  FI: 'Finland',
  FR: 'France',
  GB: 'United Kingdom',
  GE: 'Georgia',
  GR: 'Greece',
  HK: 'Hong Kong',
  HR: 'Croatia',
  HU: 'Hungary',
  ID: 'Indonesia',
  IE: 'Ireland',
  IL: 'Israel',
  IN: 'India',
  IQ: 'Iraq',
  IR: 'Iran',
  IS: 'Iceland',
  IT: 'Italy',
  JP: 'Japan',
  KE: 'Kenya',
  KG: 'Kyrgyzstan',
  KR: 'South Korea',
  KZ: 'Kazakhstan',
  LT: 'Lithuania',
  LU: 'Luxembourg',
  LV: 'Latvia',
  MD: 'Moldova',
  MX: 'Mexico',
  MY: 'Malaysia',
  NG: 'Nigeria',
  NL: 'Netherlands',
  NO: 'Norway',
  NZ: 'New Zealand',
  PH: 'Philippines',
  PK: 'Pakistan',
  PL: 'Poland',
  PT: 'Portugal',
  RO: 'Romania',
  RS: 'Serbia',
  RU: 'Russia',
  SA: 'Saudi Arabia',
  SE: 'Sweden',
  SG: 'Singapore',
  SI: 'Slovenia',
  SK: 'Slovakia',
  TH: 'Thailand',
  TR: 'Turkey',
  TW: 'Taiwan',
  UA: 'Ukraine',
  US: 'United States',
  UZ: 'Uzbekistan',
  VN: 'Vietnam',
  ZA: 'South Africa',
};

const TYPE_NAMES = {
  classic: 'Classic MTProto',
  faketls: 'FakeTLS',
  secure: 'Secure MTProto',
};

/** Regional-indicator flag for a two-letter country code. */
export function flagEmoji(code) {
  const cc = String(code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '🌐';
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function countryName(code) {
  const cc = String(code || '').toUpperCase();
  return COUNTRY_NAMES[cc] || cc || 'Unknown';
}

export function typeName(type) {
  return TYPE_NAMES[String(type || '').toLowerCase()] || 'MTProto';
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

/** Stable identity of a proxy: same server/port/secret means the same proxy. */
export function proxyKey(proxy) {
  return `${proxy.server}:${proxy.port}:${proxy.secret}`;
}

/** Clickable link that opens Telegram's "connect to proxy" dialog. */
export function proxyLink(proxy) {
  return (
    'https://t.me/proxy?server=' +
    encodeURIComponent(proxy.server) +
    '&port=' +
    encodeURIComponent(proxy.port) +
    '&secret=' +
    encodeURIComponent(proxy.secret)
  );
}

/**
 * The same link, escaped for an HTML attribute. Message text is rendered by
 * every client, unlike inline keyboards, so the body carries its own link.
 */
export function proxyLinkHtml(proxy) {
  return proxyLink(proxy).replace(/&/g, '&amp;');
}

/**
 * Turn one entry of the repository's proxies.json into the shape the bot uses.
 * Returns null for entries that cannot be turned into a valid proxy link.
 */
export function normalizeProxy(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const server = typeof raw.server === 'string' ? raw.server.trim() : '';
  const port = Number(raw.port);
  const secret = typeof raw.secret === 'string' ? raw.secret.trim() : '';
  if (!server || !Number.isInteger(port) || port < 1 || port > 65535 || !secret) return null;

  const rtt = Number(raw.rtt_ms);
  const uptime = Number(raw.uptime);
  const checks = Number(raw.checks);

  return {
    server,
    port,
    secret,
    type: typeof raw.type === 'string' ? raw.type : 'classic',
    country: typeof raw.country === 'string' ? raw.country.toUpperCase() : '',
    asnOrg: typeof raw.asn_org === 'string' ? raw.asn_org : '',
    asn: raw.asn ?? null,
    rttMs: Number.isFinite(rtt) ? rtt : 9999,
    uptime: Number.isFinite(uptime) ? uptime : 0,
    checks: Number.isFinite(checks) ? checks : 0,
  };
}

/**
 * One Telegram message for a single proxy: the details, a tappable "connect"
 * link inside the text, and the same link as an inline button.
 *
 * The text link is the one that matters: some clients do not render inline
 * keyboards on channel posts (or hide URL buttons they cannot open), and a
 * message without a visible link leaves the reader with no way to connect.
 */
export function formatProxyMessage(proxy, index, total) {
  const uptime = `${(Math.round(proxy.uptime * 1000) / 10).toFixed(1)}%`;
  const network = proxy.asnOrg
    ? `${escapeHtml(proxy.asnOrg)}${proxy.asn ? ` (AS${proxy.asn})` : ''}`
    : 'Unknown network';

  const text = [
    `<b>${flagEmoji(proxy.country)} ${escapeHtml(countryName(proxy.country))}</b> · <b>${index}/${total}</b>`,
    '',
    `⚡ <b>${proxy.rttMs} ms</b> · ✅ <b>${uptime}</b> uptime`,
    `🔐 ${escapeHtml(typeName(proxy.type))} · 🏢 ${network}`,
    `🌐 <code>${escapeHtml(proxy.server)}:${proxy.port}</code>`,
    '',
    `🚀 <a href="${proxyLinkHtml(proxy)}">Connect to proxy</a>`,
    '',
    `<i>#proxy #${escapeHtml(proxy.country || 'XX')}</i>`,
  ].join('\n');

  return {
    text,
    reply_markup: {
      inline_keyboard: [[{ text: '🚀 Connect to proxy', url: proxyLink(proxy) }]],
    },
  };
}

/**
 * Pick the next batch: proxies never posted come first (ordered by RTT), then
 * the ones whose last post is oldest. This rotates through the tier instead of
 * reposting the same ten servers forever.
 */
export function rankCandidates(proxies, postedRows = [], limit = 10) {
  const lastByKey = new Map();
  for (const row of postedRows) {
    if (!row || !row.proxyKey) continue;
    const ts = row.lastPostedAt ? new Date(row.lastPostedAt).getTime() : 0;
    lastByKey.set(row.proxyKey, Number.isFinite(ts) ? ts : 0);
  }

  const size = Math.max(1, Number(limit) || 1);
  return proxies
    .map((proxy) => {
      const key = proxyKey(proxy);
      return { ...proxy, key, lastPostedAt: lastByKey.get(key) || 0 };
    })
    .sort((a, b) => a.lastPostedAt - b.lastPostedAt || a.rttMs - b.rttMs)
    .slice(0, size);
}
