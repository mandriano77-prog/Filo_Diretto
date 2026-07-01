const { parseBrandConfig } = require('./brand-privacy-url');

function normalizePublicThemeHex(value) {
  const raw = String(value || '').trim();
  const m = raw.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return `#${h.toUpperCase()}`;
}

function resolveBrandAccent(cfg) {
  const theme = cfg.brand_theme || {};
  const hub = cfg.hub_settings && typeof cfg.hub_settings === 'object' ? cfg.hub_settings : {};
  const identity = cfg.brand_identity && typeof cfg.brand_identity === 'object' ? cfg.brand_identity : {};
  return normalizePublicThemeHex(
    theme.accent
      || theme.baseColor
      || cfg.labelColor
      || hub.accent_color
      || identity.primaryColor
      || cfg.primaryColor
  );
}

function publicBrandTheme(brand) {
  const cfg = parseBrandConfig(brand?.config);
  const theme = cfg.brand_theme || {};
  const accent = resolveBrandAccent(cfg);
  if (!accent) return null;
  return {
    accent,
    accentHover: normalizePublicThemeHex(theme.accentHover || theme.baseColor) || accent,
    textOnAccent: normalizePublicThemeHex(theme.textOnAccent) || '#FFFFFF'
  };
}

module.exports = {
  normalizePublicThemeHex,
  resolveBrandAccent,
  publicBrandTheme,
  parseBrandConfig
};
