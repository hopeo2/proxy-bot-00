import assert from 'node:assert/strict';
import {
  countryName,
  flagEmoji,
  formatProxyMessage,
  normalizeProxy,
  proxyKey,
  proxyLink,
  rankCandidates,
} from '../tgcloud/lib/format.js';

const raw = {
  server: '1.2.3.4',
  port: 443,
  secret: 'abcd',
  country: 'NL',
  type: 'faketls',
  asn_org: 'Test & Co <x>',
  asn: 123,
  rtt_ms: 42,
  uptime: 0.9999,
  checks: 96,
};

const proxy = normalizeProxy(raw);
assert.ok(proxy, 'valid proxy should normalize');
assert.equal(proxyKey(proxy), '1.2.3.4:443:abcd');
assert.equal(proxyLink(proxy), 'https://t.me/proxy?server=1.2.3.4&port=443&secret=abcd');
assert.equal(flagEmoji('NL'), '🇳🇱');
assert.equal(countryName('NL'), 'Netherlands');
assert.equal(flagEmoji('??'), '🌐');

const message = formatProxyMessage(proxy, 1, 10);
assert.match(message.text, /🇳🇱 Netherlands/);
assert.match(message.text, /1\/10/);
assert.match(message.text, /Test &amp; Co &lt;x&gt;/);
assert.match(message.text, /99\.99%|100\.0%/);
assert.equal(message.reply_markup.inline_keyboard[0][0].url, proxyLink(proxy));

assert.equal(normalizeProxy(null), null);
assert.equal(normalizeProxy({ server: '', port: 443, secret: 'x' }), null);
assert.equal(normalizeProxy({ server: 'a', port: 70000, secret: 'x' }), null);
assert.equal(normalizeProxy({ server: 'a', port: 443, secret: '' }), null);

const list = [
  { ...raw, server: 'a', rtt_ms: 100 },
  { ...raw, server: 'b', rtt_ms: 10 },
  { ...raw, server: 'c', rtt_ms: 50 },
].map(normalizeProxy);

const first = rankCandidates(list, [], 2);
assert.deepEqual(first.map((p) => p.server), ['b', 'c'], 'never-posted sorted by RTT');

const rotated = rankCandidates(
  list,
  [
    { proxyKey: 'b:443:abcd', lastPostedAt: new Date('2026-01-01T00:00:00Z') },
    { proxyKey: 'c:443:abcd', lastPostedAt: new Date('2026-01-02T00:00:00Z') },
  ],
  2,
);
assert.deepEqual(rotated.map((p) => p.server), ['a', 'b'], 'unposted, then oldest');

console.log('selftest: all assertions passed');
