/**
 * Resolve wallet logo/icon sources from Brand Identity media + legacy config.logos.
 */
const sharp = require('sharp');
const { getMedia, listTemplates, updateBrand, updateTemplate, touchPassesForTemplate } = require('../db');

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

/** Canonical wallet logo source for pass logo.png + notification icon.png */
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

/** Square crop + cover fill — legible on iOS push (29/58/87px), unlike wide pass logos. */
async function buildNotificationIconFromRaw(rawLogoBuffer) {
  const meta = await sharp(rawLogoBuffer).metadata();
  const w = meta.width || 100;
  const h = meta.height || 100;
  const size = Math.max(1, Math.min(w, h));
  const left = Math.max(0, Math.floor((w - size) / 2));
  const top = Math.max(0, Math.floor((h - size) / 2));
  const square = await sharp(rawLogoBuffer)
    .extract({ left, top, width: size, height: size })
    .png()
    .toBuffer();
  const [icon, icon2x, icon3x] = await Promise.all([
    sharp(square).resize(29, 29, { fit: 'cover', position: 'centre' }).png().toBuffer(),
    sharp(square).resize(58, 58, { fit: 'cover', position: 'centre' }).png().toBuffer(),
    sharp(square).resize(87, 87, { fit: 'cover', position: 'centre' }).png().toBuffer()
  ]);
  return { icon, icon2x, icon3x };
}

async function applyBrandLogoBase64(brandId, logoBase64, { brand, syncTemplates = false } = {}) {
  const imgBuffer = Buffer.from(logoBase64, 'base64');
  const logo1x = await sharp(imgBuffer).resize(160, 50, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const logo2x = await sharp(imgBuffer).resize(320, 100, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const iconPack = await buildNotificationIconFromRaw(imgBuffer);

  const config = { ...(brand?.config || {}) };
  config.logos = {
    ...(config.logos || {}),
    logo: logo1x.toString('base64'),
    'logo@2x': logo2x.toString('base64'),
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
        style: { ...prevStyle, images: { ...prevImages, logo: logoBase64 } }
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
  resolveWalletLogoRawBuffer,
  buildNotificationIconFromRaw,
  applyBrandLogoBase64,
  syncWalletLogoFromBrandIdentity,
  inspectPkpassIcon
};
