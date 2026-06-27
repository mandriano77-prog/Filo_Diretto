const googleWallet = require('./google-wallet');
const { getTemplate, markGoogleWalletUpdateStatus } = require('../db');
const { parsePushAnnouncementRecord } = require('./pass-push-state');

const DEFAULT_CONCURRENCY = Math.max(
  1,
  Math.min(parseInt(process.env.GOOGLE_WALLET_SYNC_CONCURRENCY || '15', 10) || 15, 32)
);

async function syncGoogleWalletObjectsForPasses({
  brand,
  passes,
  message,
  title,
  back_details,
  concurrency = DEFAULT_CONCURRENCY,
}) {
  if (!googleWallet.isConfigured()) {
    return { attempted: 0, updated: 0, errors: 0, skipped: true };
  }
  if (!Array.isArray(passes) || passes.length === 0) {
    return { attempted: 0, updated: 0, errors: 0, skipped: false };
  }

  const eligible = passes.filter((pass) => pass.google_wallet_object_id);
  if (!eligible.length) {
    return { attempted: 0, updated: 0, errors: 0, skipped: false };
  }

  const outcomes = new Array(eligible.length);
  let cursor = 0;
  const workers = Math.max(1, Math.min(concurrency, eligible.length));

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= eligible.length) break;
      const pass = eligible[index];
      try {
        const template = await getTemplate(pass.template_id);
        if (!template) {
          outcomes[index] = { ok: false, error: 'missing_template' };
          continue;
        }
        const passForGoogle = withCurrentPushDetails(pass, { title, message, back_details });
        const passObject = await googleWallet.buildPassObject(brand, template, passForGoogle, passForGoogle.customer_data || {});
        await googleWallet.ensurePassReadyOnServer(brand, template, passObject);
        if (message) {
          await googleWallet.updatePassMessage(pass.serial_number, message, brand, { title });
        }
        await markGoogleWalletUpdateStatus(pass.serial_number, 'delivered');
        outcomes[index] = { ok: true };
      } catch (err) {
        console.error('[GoogleWallet] Sync error for serial', pass.serial_number, err.message);
        await markGoogleWalletUpdateStatus(pass.serial_number, err.message || 'failed').catch(() => {});
        outcomes[index] = { ok: false, error: err.message };
      }
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));

  const attempted = eligible.length;
  const updated = outcomes.filter((o) => o?.ok).length;
  const errors = outcomes.filter((o) => o && !o.ok).length;
  return { attempted, updated, errors, skipped: false };
}

function withCurrentPushDetails(pass, { title, message, back_details } = {}) {
  const backDetails = String(back_details || '').trim();
  if (!backDetails) return pass;
  const current = parsePushAnnouncementRecord(pass?.push_announcement) || {};
  const next = {
    ...current,
    title: String(title || current.title || '').trim(),
    message: String(message || current.message || '').trim(),
    back_details: backDetails.slice(0, 500),
    ts: Number(current.ts) || Date.now(),
  };
  if (!next.message) return pass;
  return { ...pass, push_announcement: next };
}

module.exports = {
  syncGoogleWalletObjectsForPasses,
  DEFAULT_CONCURRENCY,
  withCurrentPushDetails,
};
