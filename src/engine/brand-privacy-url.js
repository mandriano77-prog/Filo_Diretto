const { buildPublicPathUrl } = require('./base-url');

function parseBrandConfig(config) {
  if (!config) return {};
  if (typeof config === 'string') {
    try {
      return JSON.parse(config);
    } catch {
      return {};
    }
  }
  return typeof config === 'object' ? config : {};
}

function resolveBrandPrivacyUrl(brand, options = {}) {
  const cfg = parseBrandConfig(brand?.config);
  const slug = String(brand?.slug || brand?.brand_slug || '').trim();
  const doc = cfg.privacy_document;
  if (doc && typeof doc === 'object' && String(doc.content_base64 || '').trim()) {
    if (slug) return buildPublicPathUrl(`privacy-doc/${slug}`, options);
  }
  const custom = String(cfg.privacy_url || cfg.privacyUrl || '').trim();
  if (custom) return custom;

  if (slug) return buildPublicPathUrl(`privacy/${slug}`, options);
  return buildPublicPathUrl('privacy-policy', options);
}

module.exports = { resolveBrandPrivacyUrl, parseBrandConfig };
