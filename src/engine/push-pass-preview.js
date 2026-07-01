/**
 * HR push pass preview — same field layout as createPkpass / buildEmployeePass.
 */
const {
  loadHrStripBuffers,
  normalizePushAnnouncementForStrip,
} = require('./passkit');
const {
  buildEmployeePass,
  resolveEmployeePassColors,
  buildBackSections,
} = require('./employee-pass');
const { attachBackDetailsToAnnouncement } = require('./push-text-limits');
const { resolvePassIconBuffers, resolveWalletLogoRawBuffer, buildPassLogoBuffersFromRaw } = require('./brand-wallet-logo');

const PREVIEW_MEMBER = {
  first_name: 'Mario',
  last_name: 'Rossi',
  department: 'Engineering',
};

const APPLE_WALLET_UPDATE_HINT = "Apri l'aggiornamento";

function toDataUrl(buffer, mime = 'image/png') {
  if (!buffer?.length) return null;
  return `data:${mime};base64,${Buffer.from(buffer).toString('base64')}`;
}

function buildPreviewAnnouncement(body) {
  const title = String(body.title || '').trim();
  const message = String(body.message || '').trim();
  if (!message) return null;
  const base = normalizePushAnnouncementForStrip({ title, message, ts: Date.now() })
    || { title, message, ts: Date.now() };
  return attachBackDetailsToAnnouncement(base, body.back_details);
}

async function buildPushPassPreview({ brand, template, body = {} }) {
  const announcement = buildPreviewAnnouncement(body);
  const updatePass = body.update_pass !== false;
  const includeLink = !!body.include_pass_link;
  const linkUrl = String(body.pass_link_url || body.back_link_url || '').trim();
  const linkLabel = String(body.pass_link_label || body.back_link_label || '').trim();

  const instance = {
    push_announcement: updatePass && announcement ? announcement : null,
    dynamic_link_url: includeLink && linkUrl ? linkUrl : null,
    dynamic_link_label: linkLabel || null,
    dynamic_link_expires_at: includeLink && linkUrl
      ? new Date(Date.now() + 7 * 86400000).toISOString()
      : null,
    field_values: {
      nome: PREVIEW_MEMBER.first_name,
      cognome: PREVIEW_MEMBER.last_name,
      reparto: PREVIEW_MEMBER.department,
    },
  };

  const brandConfig = { ...(brand?.config || {}), product_line: 'hr' };
  const colors = resolveEmployeePassColors(template, brandConfig);
  const employeePass = buildEmployeePass({
    brand,
    template,
    instance,
    member: PREVIEW_MEMBER,
    brandConfig,
    coinBalance: 25,
    hubUrl: 'https://example.com/hub',
    portalUrl: 'https://example.com/portal',
  });

  const headerField = employeePass.headerHint || null;
  const alertAux = (employeePass.front.auxiliary || []).find((f) => f.key === 'announcement');
  const lockScreenBody = updatePass && alertAux?.changeMessage
    ? String(alertAux.changeMessage)
    : '';

  let stripPreview = null;
  if (updatePass) {
    let stripOverride = null;
    if (body.strip_base64) {
      stripOverride = body.strip_base64.replace(/^data:image\/\w+;base64,/, '');
    }
    const stripBuffers = await loadHrStripBuffers({
      brand,
      template,
      stripOverrideBase64: stripOverride,
    });
    stripPreview = toDataUrl(stripBuffers.strip);
  }

  const [logoRaw, iconResolved] = await Promise.all([
    resolveWalletLogoRawBuffer(brand, template),
    resolvePassIconBuffers(brand, null, template),
  ]);

  let logoDataUrl = null;
  if (logoRaw?.buffer) {
    const logos = await buildPassLogoBuffersFromRaw(logoRaw.buffer);
    logoDataUrl = toDataUrl(logos.logo);
  }

  let walletIconDataUrl = null;
  if (iconResolved?.iconBuffers?.icon) {
    walletIconDataUrl = toDataUrl(iconResolved.iconBuffers.icon);
  }

  const backSections = buildBackSections({
    brand,
    template,
    instance,
    member: PREVIEW_MEMBER,
    brandConfig,
    hubUrl: 'https://example.com/hub',
    portalUrl: 'https://example.com/portal',
  });

  const back = backSections.map((s) => {
    if (s.kind === 'link') {
      return { type: 'link', key: s.key, label: s.label, url: s.url };
    }
    return { type: 'text', key: s.key, label: s.label, body: s.body };
  });

  const secondary = (employeePass.front?.secondary || []).map((f) => ({
    key: f.key,
    label: f.label,
    value: f.value,
  }));

  return {
    brand_name: brand?.name || '',
    update_pass: updatePass,
    colors: {
      background: colors.backgroundColor,
      foreground: colors.foregroundColor,
      label: colors.labelColor,
    },
    lock_screen: {
      app_name: brand?.name || 'Wallet',
      body: lockScreenBody.slice(0, 178),
    },
    header: headerField
      ? { label: headerField.label, value: String(headerField.value || '').replace(/[\u200b\u200c\u200d\u2060]/g, '') }
      : null,
    secondary,
    back,
    strip_preview: stripPreview,
    logo_data_url: logoDataUrl,
    wallet_icon_data_url: walletIconDataUrl,
    wallet_icon_source: iconResolved?.source || null,
  };
}

module.exports = { buildPushPassPreview, PREVIEW_MEMBER };
