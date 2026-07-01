/**
 * Per-pass push overlay (strip text + optional strip image).
 * HR passes never inherit brand.config.pushAnnouncement — only targeted instances.
 */

function parsePushAnnouncementRecord(raw) {
  if (!raw) return null;
  let ann = raw;
  if (typeof raw === 'string') {
    try {
      ann = JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }
  const message = String(ann?.message || '').trim();
  if (!message) return null;
  const ts = Number(ann.ts ?? ann.timestamp);
  const backRaw = String(ann?.back_details ?? ann?.backDetails ?? '').trim();
  const out = {
    title: String(ann.title || '').trim(),
    message,
    ts: Number.isFinite(ts) ? ts : Date.now(),
  };
  const screen = String(ann.screen_alert ?? ann.screenAlert ?? '').trim();
  if (screen) out.screen_alert = screen.slice(0, 178);
  if (backRaw) out.back_details = backRaw.slice(0, 500);
  return out;
}

/** Effective HR push overlay for one pass instance (null = standard template). */
function resolveHrPassPushState(instance) {
  const pushAnnouncement = parsePushAnnouncementRecord(instance?.push_announcement);
  const stripBase64 = instance?.push_strip_base64
    ? String(instance.push_strip_base64).trim() || null
    : null;
  return { pushAnnouncement, stripBase64 };
}

/** Merge instance push state into brand.config for pass generation (HR only). */
function brandConfigForHrPass(brand, instance) {
  const base = { ...(brand?.config || {}) };
  const { pushAnnouncement, stripBase64 } = resolveHrPassPushState(instance);
  if (pushAnnouncement) base.pushAnnouncement = pushAnnouncement;
  else delete base.pushAnnouncement;
  if (stripBase64) base.stripOverride = stripBase64;
  else delete base.stripOverride;
  // relevantDate triggers generic "Carta punto vendita modificata" on storeCard — never on HR push passes.
  delete base.relevantDate;
  return base;
}

module.exports = {
  parsePushAnnouncementRecord,
  resolveHrPassPushState,
  brandConfigForHrPass,
};
