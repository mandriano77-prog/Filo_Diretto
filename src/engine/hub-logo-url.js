'use strict';

function normalizePublicImageUrl(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;

  if (/^\/(?!\/)/.test(value)) return value;
  if (/^\/\//.test(value)) return normalizePublicImageUrl(`https:${value}`);
  if (!/^https?:\/\//i.test(value)) {
    if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(value)) {
      return normalizePublicImageUrl(`https://${value}`);
    }
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.protocol = 'https:';
    return url.toString();
  } catch (_) {
    return null;
  }
}

module.exports = {
  normalizePublicImageUrl,
};
