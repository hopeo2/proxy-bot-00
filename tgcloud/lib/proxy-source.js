import { fetch } from 'sdk';
import { SOURCE_BASE, TIER } from './config.js';
import { normalizeProxy, proxyKey } from './format.js';

async function fetchTier(tier) {
  const url = `${SOURCE_BASE}/${tier}/proxies.json`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Proxy source "${tier}" answered HTTP ${res.status}`);

  const data = await res.json();
  if (!Array.isArray(data)) throw new Error(`Proxy source "${tier}" returned an unexpected payload`);

  const seen = new Set();
  const out = [];
  for (const raw of data) {
    const proxy = normalizeProxy(raw);
    if (!proxy) continue;
    const key = proxyKey(proxy);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(proxy);
  }

  out.sort((a, b) => a.rttMs - b.rttMs);
  return out;
}

/**
 * Load the configured tier, falling back to the broader tiers if the preferred
 * one is unavailable or empty. Every proxy is de-duplicated and sorted by RTT.
 */
export async function fetchProxies({ tier = TIER } = {}) {
  const order = [tier, ...['fast', 'resilient', 'stable', 'verified'].filter((t) => t !== tier)];
  let lastError;

  for (const candidate of order) {
    try {
      const list = await fetchTier(candidate);
      if (list.length > 0) return list.map((proxy) => ({ ...proxy, tier: candidate }));
    } catch (err) {
      lastError = err;
      console.warn(`proxy source "${candidate}" failed: ${err?.message || err}`);
    }
  }

  throw lastError || new Error('No proxies available from the source repository');
}
