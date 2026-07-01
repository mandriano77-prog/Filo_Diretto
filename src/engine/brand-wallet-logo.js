/**
 * Resolve wallet logo/icon sources from Brand Identity media + legacy config.logos.
 */
const sharp = require('sharp');
const {
  getMedia,
  getBrand,
  listTemplates,
  updateBrand,
  updateTemplate,
  touchPassesForTemplate,
  listPasses,
  getDevicesForBrand,
} = require('../db');

async function resolveBrandLogoRawBuffer(brand) {
  const cfg = brand?.config || {};
  const mediaId = cfg.brand_identity_assets?.logo;
  if (mediaId) {
    const media = await getMedia(mediaId);
    if (media?.image_base64) {
      return {
        buffer: Buffer.from(media.image_base64, 'base64'),
        source: 'brand_identity_media'
      };
    }
  }
  if (cfg.logos?.['logo@2x'] || cfg.logos?.logo) {
    const b64 = cfg.logos['logo@2x'] || cfg.logos.logo;
    return {
      buffer: Buffer.from(b64, 'base64'),
      source: 'config_logos'
    };
  }
  return null;
}

const INVITE_EMAIL_LOGO_CID = 'brand-invite-logo';
const EMPLOYEE_EMAIL_LOGO_CID = 'brand-employee-logo';

/** Square brand mark for Hub, activation, and HR emails — wallet_icon first, then wide logo. */
async function resolveBrandMarkRawBuffer(brand) {
  const fromIcon = await resolveNotificationIconRawBuffer(brand);
  if (fromIcon?.buffer) return fromIcon;
  return resolveBrandLogoRawBuffer(brand);
}

function publicBrandMarkVersion(brand) {
  const cfg = brand?.config || {};
  return [
    cfg.brand_identity_assets?.wallet_icon,
    cfg.brand_identity_assets?.logo,
    cfg.wallet_icon_rev,
    brand?.updated_at
  ].filter(Boolean).join('-') || 'current';
}

/** Cache-bust key for pass-scoped wide logo (template + brand identity). */
function publicPassLogoVersion(brand, pass) {
  const cfg = brand?.config || {};
  return [
    pass?.template_id,
    pass?.updated_at,
    cfg.brand_identity_assets?.logo,
    brand?.updated_at
  ].filter(Boolean).join('-') || 'current';
}

/** Wide logo.png as shown on the employee pass (template-aware). */
function publicPassLogoUrl(brand, pass) {
  if (!brand?.slug) return null;
  const q = new URLSearchParams();
  if (pass?.id) q.set('pass_id', String(pass.id));
  q.set('v', publicPassLogoVersion(brand, pass));
  return `/api/v1/brands/by-slug/${encodeURIComponent(brand.slug)}/logo?${q.toString()}`;
}

/** PNG inline attachment for dashboard invite emails (Resend CID). */
async function buildInviteEmailLogoAttachment(rawBuffer) {
  if (!rawBuffer?.length) return null;
  try {
    const png = await sharp(rawBuffer)
      .png()
      .resize(120, 120, { fit: 'inside', withoutEnlargement: true })
      .toBuffer();
    return {
      cid: INVITE_EMAIL_LOGO_CID,
      filename: 'brand-logo.png',
      content_type: 'image/png',
      content: png.toString('base64'),
    };
  } catch (err) {
    console.warn('[invite-email] logo normalize failed:', err.message);
    return null;
  }
}

/** PNG inline attachment for HR employee activation emails (Resend CID). */
async function buildEmployeeEmailLogoAttachment(rawBuffer) {
  if (!rawBuffer?.length) return null;
  try {
    const png = await sharp(rawBuffer)
      .png()
      .resize(120, 120, { fit: 'inside', withoutEnlargement: false })
      .toBuffer();
    return {
      cid: EMPLOYEE_EMAIL_LOGO_CID,
      filename: 'brand-mark.png',
      content_type: 'image/png',
      content: png.toString('base64'),
    };
  } catch (err) {
    console.warn('[employee-email] brand mark normalize failed:', err.message);
    return null;
  }
}

/** Square icon for push notifications — dedicated asset, not the wide pass logo. */
async function resolveNotificationIconRawBuffer(brand) {
  const mediaId = brand?.config?.brand_identity_assets?.wallet_icon;
  if (mediaId) {
    const media = await getMedia(mediaId);
    if (media?.image_base64) {
      return {
        buffer: Buffer.from(media.image_base64, 'base64'),
        source: 'brand_identity_wallet_icon'
      };
    }
  }
  return null;
}

function readIconPackFromConfig(logos) {
  if (!logos?.icon) return null;
  return {
    icon: Buffer.from(logos.icon, 'base64'),
    icon2x: Buffer.from(logos['icon@2x'] || logos.icon, 'base64'),
    icon3x: Buffer.from(logos['icon@3x'] || logos['icon@2x'] || logos.icon, 'base64')
  };
}

/**
 * Resolve notification icon buffers for .pkpass (icon.png).
 * Prefers dedicated wallet_icon media, then synced config.logos, template asset, then wide logo crop.
 */
async function resolvePassIconBuffers(brand, resolvedLogo, template = null) {
  const cfg = brand?.config || {};
  const fromMedia = await resolveNotificationIconRawBuffer(brand);
  if (fromMedia) {
    return {
      iconBuffers: await buildNotificationIconFromRaw(fromMedia.buffer),
      source: fromMedia.source
    };
  }
  const tplIcon = template?.style?.images?.wallet_icon;
  if (tplIcon) {
    return {
      iconBuffers: await buildNotificationIconFromRaw(Buffer.from(tplIcon, 'base64')),
      source: 'template_wallet_icon'
    };
  }
  const synced = readIconPackFromConfig(cfg.logos);
  if (synced && (Number(cfg.wallet_icon_rev) > 0 || cfg.wallet_icon_synced_at)) {
    return { iconBuffers: synced, source: 'config_logos_synced' };
  }
  if (resolvedLogo?.buffer) {
    return {
      iconBuffers: await buildNotificationIconFromRaw(resolvedLogo.buffer),
      source: 'logo_derived'
    };
  }
  return { iconBuffers: null, source: null };
}

/** Canonical wide logo for pass logo.png (Brand Identity → template → config). */
async function resolveWalletLogoRawBuffer(brand, template) {
  const cfg = brand?.config || {};
  const mediaId = cfg.brand_identity_assets?.logo;
  if (mediaId) {
    const media = await getMedia(mediaId);
    if (media?.image_base64) {
      return {
        buffer: Buffer.from(media.image_base64, 'base64'),
        source: 'brand_identity_media'
      };
    }
  }
  const tplLogo = template?.style?.images?.logo;
  if (tplLogo) {
    return {
      buffer: Buffer.from(tplLogo, 'base64'),
      source: 'template_logo'
    };
  }
  return resolveBrandLogoRawBuffer(brand);
}

/**
 * Build icon.png sizes for Apple Wallet push.
 * Wide wordmarks are center-cropped; near-square sources are only resized.
 */
async function buildNotificationIconFromRaw(rawBuffer) {
  const meta = await sharp(rawBuffer).metadata();
  const w = meta.width || 100;
  const h = meta.height || 100;
  const ratio = w / Math.max(h, 1);
  let source = rawBuffer;
  if (ratio > 1.2 || ratio < 0.83) {
    const size = Math.max(1, Math.min(w, h));
    const left = Math.max(0, Math.floor((w - size) / 2));
    const top = Math.max(0, Math.floor((h - size) / 2));
    source = await sharp(rawBuffer)
      .extract({ left, top, width: size, height: size })
      .png()
      .toBuffer();
  }
  const [icon, icon2x, icon3x] = await Promise.all([
    sharp(source).resize(29, 29, { fit: 'cover', position: 'centre' }).png().toBuffer(),
    sharp(source).resize(58, 58, { fit: 'cover', position: 'centre' }).png().toBuffer(),
    sharp(source).resize(87, 87, { fit: 'cover', position: 'centre' }).png().toBuffer()
  ]);
  return { icon, icon2x, icon3x };
}

async function buildPassLogoBuffersFromRaw(rawLogoBuffer) {
  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
  const [logo, logo2x] = await Promise.all([
    sharp(rawLogoBuffer).resize(160, 50, { fit: 'contain', position: 'left', background: transparent }).png().toBuffer(),
    sharp(rawLogoBuffer).resize(320, 100, { fit: 'contain', position: 'left', background: transparent }).png().toBuffer()
  ]);
  return { logo, logo2x };
}

function clamp(n, min = 0, max = 255) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function rgbToHex({ r, g, b }) {
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`.toUpperCase();
}

function mixRgb(a, b, amount) {
  const t = Math.max(0, Math.min(1, amount));
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
  };
}

function relativeLuminance(rgb) {
  const linear = [rgb.r, rgb.g, rgb.b].map((v) => {
    const c = clamp(v) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(a, b) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

function saturationScore(rgb) {
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  if (!max) return 0;
  return (max - min) / max;
}

function paletteFromBrandColor(base) {
  const black = { r: 6, g: 6, b: 12 };
  const white = { r: 255, g: 255, b: 255 };
  const bg = relativeLuminance(base) > 0.18
    ? mixRgb(base, black, 0.68)
    : mixRgb(base, black, 0.28);
  const backgroundColor = rgbToHex(bg);
  const foregroundColor = contrastRatio(bg, white) >= 4.5 ? '#FFFFFF' : '#111827';
  const labelBase = saturationScore(base) < 0.18 ? mixRgb(base, { r: 139, g: 92, b: 246 }, 0.65) : base;
  const labelOnBg = contrastRatio(labelBase, bg) >= 3
    ? labelBase
    : mixRgb(labelBase, foregroundColor === '#FFFFFF' ? white : black, 0.35);
  return {
    backgroundColor,
    foregroundColor,
    labelColor: rgbToHex(labelOnBg),
    baseColor: rgbToHex(base)
  };
}

async function extractBrandPaletteFromImage(rawBuffer) {
  const { data, info } = await sharp(rawBuffer)
    .resize(96, 96, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const buckets = new Map();
  for (let i = 0; i < data.length; i += info.channels) {
    const a = data[i + 3];
    if (a < 64) continue;
    const rgb = { r: data[i], g: data[i + 1], b: data[i + 2] };
    const lum = relativeLuminance(rgb);
    const sat = saturationScore(rgb);
    if (lum > 0.94 || lum < 0.025) continue;
    if (sat < 0.08) continue;
    const key = `${Math.round(rgb.r / 24) * 24},${Math.round(rgb.g / 24) * 24},${Math.round(rgb.b / 24) * 24}`;
    const prev = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0, score: 0 };
    prev.r += rgb.r;
    prev.g += rgb.g;
    prev.b += rgb.b;
    prev.n += 1;
    prev.score += sat * (1 - Math.abs(lum - 0.38));
    buckets.set(key, prev);
  }

  let best = null;
  for (const bucket of buckets.values()) {
    if (!best || bucket.score > best.score) best = bucket;
  }
  if (!best || best.n < 3) return null;
  return paletteFromBrandColor({ r: best.r / best.n, g: best.g / best.n, b: best.b / best.n });
}

async function applyAutoPaletteToConfig(config, rawBuffer, source) {
  const next = { ...(config || {}) };
  if (next.wallet_palette_mode === 'manual' || next.wallet_palette?.locked === true) return next;
  const palette = await extractBrandPaletteFromImage(rawBuffer).catch((err) => {
    console.warn('[wallet-palette] extraction failed:', err.message);
    return null;
  });
  if (!palette) return next;
  next.backgroundColor = palette.backgroundColor;
  next.foregroundColor = palette.foregroundColor;
  next.labelColor = palette.labelColor;
  next.wallet_palette = {
    ...(next.wallet_palette || {}),
    mode: 'auto',
    source,
    baseColor: palette.baseColor,
    updated_at: new Date().toISOString()
  };
  if (next.brand_theme_mode !== 'manual' && next.brand_theme?.locked !== true) {
    next.brand_theme = {
      ...(next.brand_theme || {}),
      mode: 'auto',
      source,
      accent: palette.labelColor,
      accentHover: palette.baseColor,
      baseColor: palette.baseColor,
      updated_at: new Date().toISOString()
    };
  }
  return next;
}

async function buildWalletLogoAndIconFromRaw(rawLogoBuffer, brand) {
  const logoBuffers = await buildPassLogoBuffersFromRaw(rawLogoBuffer);
  const dedicated = brand ? await resolveNotificationIconRawBuffer(brand) : null;
  const iconSource = dedicated?.buffer || rawLogoBuffer;
  const iconBuffers = await buildNotificationIconFromRaw(iconSource);
  return { logoBuffers, iconBuffers };
}

async function touchAndNotifyBrandPasses(brandId) {
  const passes = await listPasses(brandId);
  const passIds = passes.map((p) => p.id);
  if (passIds.length) {
    const { touchPassesByIds } = require('../db');
    await touchPassesByIds(passIds);
  }
  let pushSent = 0;
  try {
    const devices = await getDevicesForBrand(brandId);
    if (devices.length) {
      const { sendPushBatch } = require('./apns');
      const batch = await sendPushBatch(devices.map((d) => d.push_token));
      pushSent = batch.filter((r) => r.success).length;
    }
  } catch (err) {
    console.warn('[wallet-icon] APNs notify after icon update failed:', err.message);
  }
  return { touched: passIds.length, push_sent: pushSent };
}

async function applyWalletIconBase64(brandId, iconBase64, { brand, touchPasses = true } = {}) {
  const imgBuffer = Buffer.from(iconBase64, 'base64');
  const iconPack = await buildNotificationIconFromRaw(imgBuffer);
  const config = await applyAutoPaletteToConfig(brand?.config || {}, imgBuffer, 'wallet_icon');
  config.logos = {
    ...(config.logos || {}),
    icon: iconPack.icon.toString('base64'),
    'icon@2x': iconPack.icon2x.toString('base64'),
    'icon@3x': iconPack.icon3x.toString('base64')
  };
  config.wallet_icon_rev = (Number(config.wallet_icon_rev) || 0) + 1;
  config.wallet_icon_synced_at = new Date().toISOString();
  await updateBrand(brandId, { config });
  if (touchPasses) {
    await touchAndNotifyBrandPasses(brandId);
  }
  return config;
}

async function applyBrandLogoBase64(brandId, logoBase64, { brand, syncTemplates = false } = {}) {
  const imgBuffer = Buffer.from(logoBase64, 'base64');
  const logoBuffers = await buildPassLogoBuffersFromRaw(imgBuffer);
  const cfg = brand?.config || {};
  const hasDedicatedIconAsset = !!cfg.brand_identity_assets?.wallet_icon;
  const hasSyncedWalletIcon = !!cfg.wallet_icon_synced_at || Number(cfg.wallet_icon_rev) > 0;
  const dedicated = await resolveNotificationIconRawBuffer(brand);
  let iconPack;
  if (dedicated) {
    iconPack = await buildNotificationIconFromRaw(dedicated.buffer);
  } else if (hasDedicatedIconAsset || hasSyncedWalletIcon) {
    iconPack = readIconPackFromConfig(cfg.logos) || await buildNotificationIconFromRaw(imgBuffer);
  } else {
    iconPack = await buildNotificationIconFromRaw(imgBuffer);
  }

  const config = await applyAutoPaletteToConfig(brand?.config || {}, imgBuffer, 'logo');
  config.logos = {
    ...(config.logos || {}),
    logo: logoBuffers.logo.toString('base64'),
    'logo@2x': logoBuffers.logo2x.toString('base64'),
    icon: iconPack.icon.toString('base64'),
    'icon@2x': iconPack.icon2x.toString('base64'),
    'icon@3x': iconPack.icon3x.toString('base64')
  };
  await updateBrand(brandId, { config });

  if (syncTemplates) {
    const templates = await listTemplates(brandId);
    for (const tpl of templates) {
      const prevStyle = tpl.style && typeof tpl.style === 'object' ? tpl.style : {};
      const prevImages = prevStyle.images && typeof prevStyle.images === 'object' ? prevStyle.images : {};
      await updateTemplate(tpl.id, {
        style: {
          ...prevStyle,
          backgroundColor: config.backgroundColor || prevStyle.backgroundColor,
          foregroundColor: config.foregroundColor || prevStyle.foregroundColor,
          labelColor: config.labelColor || prevStyle.labelColor,
          images: { ...prevImages, logo: logoBase64 }
        }
      });
      await touchPassesForTemplate(tpl.id);
    }
  }

  return config;
}

async function syncWalletLogoFromBrandIdentity(brandId, brand, { syncTemplates = false } = {}) {
  const mediaId = brand?.config?.brand_identity_assets?.logo;
  if (!mediaId) return false;
  const media = await getMedia(mediaId);
  if (!media?.image_base64) return false;
  await applyBrandLogoBase64(brandId, media.image_base64, { brand, syncTemplates });
  return true;
}

async function syncWalletIconFromBrandIdentity(brandId, brand, { touchPasses = true, mediaId: mediaIdOverride } = {}) {
  const mediaId = mediaIdOverride || brand?.config?.brand_identity_assets?.wallet_icon;
  if (!mediaId) return false;
  const media = await getMedia(mediaId);
  if (!media?.image_base64) return false;
  const refreshedBrand = await getBrand(brandId);
  const config = { ...(refreshedBrand?.config || brand?.config || {}) };
  config.brand_identity_assets = {
    ...(config.brand_identity_assets || {}),
    wallet_icon: mediaId
  };
  await updateBrand(brandId, { config });
  const latest = await getBrand(brandId);
  await applyWalletIconBase64(brandId, media.image_base64, { brand: latest, touchPasses });
  return true;
}

async function assignWalletIconMedia(brandId, mediaId, { touchPasses = true } = {}) {
  const media = await getMedia(mediaId);
  if (!media?.image_base64) return false;
  const brand = await getBrand(brandId);
  if (!brand || String(media.brand_id) !== String(brandId)) return false;
  const config = { ...(brand.config || {}) };
  config.brand_identity_assets = {
    ...(config.brand_identity_assets || {}),
    wallet_icon: mediaId
  };
  await updateBrand(brandId, { config });
  const latest = await getBrand(brandId);
  await applyWalletIconBase64(brandId, media.image_base64, { brand: latest, touchPasses });
  return true;
}

async function inspectPkpassIcon(pkpassBuffer) {
  const AdmZip = require('adm-zip');
  const crypto = require('crypto');
  const zip = new AdmZip(pkpassBuffer);
  const entry = zip.getEntry('icon.png') || zip.getEntry('icon@2x.png');
  if (!entry) return null;
  const buffer = entry.getData();
  return {
    file: entry.entryName,
    bytes: buffer.length,
    sha256_prefix: crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16)
  };
}

module.exports = {
  resolveBrandLogoRawBuffer,
  resolveBrandMarkRawBuffer,
  publicBrandMarkVersion,
  publicPassLogoVersion,
  publicPassLogoUrl,
  buildInviteEmailLogoAttachment,
  buildEmployeeEmailLogoAttachment,
  INVITE_EMAIL_LOGO_CID,
  EMPLOYEE_EMAIL_LOGO_CID,
  resolveNotificationIconRawBuffer,
  resolveWalletLogoRawBuffer,
  resolvePassIconBuffers,
  readIconPackFromConfig,
  buildNotificationIconFromRaw,
  buildPassLogoBuffersFromRaw,
  buildWalletLogoAndIconFromRaw,
  extractBrandPaletteFromImage,
  applyAutoPaletteToConfig,
  applyBrandLogoBase64,
  touchAndNotifyBrandPasses,
  applyWalletIconBase64,
  syncWalletLogoFromBrandIdentity,
  syncWalletIconFromBrandIdentity,
  assignWalletIconMedia,
  inspectPkpassIcon
};
