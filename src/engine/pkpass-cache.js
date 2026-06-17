const { createPkpass } = require('./passkit');

const cache = new Map();
const MAX_ENTRIES = Math.max(50, parseInt(process.env.PKPASS_CACHE_MAX || '400', 10) || 400);
const TTL_MS = Math.max(10000, parseInt(process.env.PKPASS_CACHE_TTL_MS || '120000', 10) || 120000);

function cacheKey(passId, lastUpdated) {
  const ts = lastUpdated instanceof Date
    ? lastUpdated.getTime()
    : new Date(lastUpdated || 0).getTime();
  return `${passId}:${ts}`;
}

function getCachedPkpass(passId, lastUpdated) {
  const key = cacheKey(passId, lastUpdated);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.buffer;
}

function setCachedPkpass(passId, lastUpdated, buffer) {
  if (!buffer?.length) return;
  const key = cacheKey(passId, lastUpdated);
  if (cache.size >= MAX_ENTRIES && !cache.has(key)) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { buffer, at: Date.now() });
}

async function buildPkpassCached(template, passInstance, brand, options = {}) {
  const cached = getCachedPkpass(passInstance.id, passInstance.last_updated);
  if (cached) return cached;

  const buffer = await createPkpass(template, passInstance, brand, options);
  setCachedPkpass(passInstance.id, passInstance.last_updated, buffer);
  return buffer;
}

function getPkpassCacheStats() {
  return { entries: cache.size, maxEntries: MAX_ENTRIES, ttlMs: TTL_MS };
}

module.exports = {
  buildPkpassCached,
  getCachedPkpass,
  setCachedPkpass,
  getPkpassCacheStats,
};
