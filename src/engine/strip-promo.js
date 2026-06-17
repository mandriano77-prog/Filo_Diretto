/**
 * Strip Promo Scheduler
 *
 * Runs every hour. For each active strip promo whose date range is current:
 * 1. Swaps the brand's strip image with the promo strip
 * 2. Touches passes so Apple Wallet fetches updated .pkpass on demand
 * 3. Sends push notification if configured (daily or hourly)
 *
 * When a promo expires:
 * 1. Restores the brand's default strip (stored in config.logos.strip_default)
 * 2. Touches passes and notifies devices
 */

const {
  getActiveStripPromos,
  updateStripPromo,
  getBrand,
  updateBrand,
  listPasses,
  touchPassesByIds,
  getDevicesForBrand,
  logPush,
  logEvent,
} = require('../db');
const { sendPushBatch, closeApnsSession } = require('./apns');
const { syncGoogleWalletObjectsForPasses } = require('./google-wallet-sync');

/**
 * Check and apply active strip promos.
 * Called every hour by server.js
 */
async function runStripPromoCheck() {
  try {
    const activePromos = await getActiveStripPromos();
    console.log(`[StripPromo] Checking... ${activePromos.length} active promo(s) found`);

    for (const promo of activePromos) {
      try {
        await applyStripPromo(promo);
      } catch (e) {
        console.error(`[StripPromo] Error applying promo "${promo.title}" for brand ${promo.brand_name}:`, e.message);
      }
    }

    await checkExpiredPromos();
  } catch (e) {
    console.error('[StripPromo] Fatal error:', e.message);
  }
}

async function applyStripPromo(promo) {
  const brand = await getBrand(promo.brand_id);
  if (!brand) return;

  const config = brand.config || {};
  const logos = config.logos || {};

  if (!logos.strip_default && logos.strip) {
    const updConfig = { ...config, logos: { ...logos, strip_default: logos.strip } };
    await updateBrand(promo.brand_id, { config: updConfig });
  }

  const currentStripHash = logos.strip ? logos.strip.substring(0, 50) : '';
  const promoStripHash = promo.strip_base64 ? promo.strip_base64.substring(0, 50) : '';

  if (currentStripHash !== promoStripHash) {
    const updConfig = {
      ...config,
      logos: { ...logos, strip: promo.strip_base64, strip_default: logos.strip_default || logos.strip },
    };
    await updateBrand(promo.brand_id, { config: updConfig });
    console.log(`[StripPromo] Applied strip for promo "${promo.title}" on brand ${promo.brand_name}`);

    await regenerateBrandPasses(promo.brand_id, { sendPush: false });

    await logEvent({
      brand_id: promo.brand_id,
      event_type: 'strip_promo_applied',
      metadata: { promo_id: promo.id, title: promo.title },
    });
  }

  if (promo.push_message && promo.push_frequency !== 'none') {
    const shouldPush = shouldSendPush(promo);
    if (shouldPush) {
      await sendPromoPush(promo);
      await updateStripPromo(promo.id, { last_push_sent: new Date().toISOString() });
    }
  }
}

function shouldSendPush(promo) {
  if (!promo.last_push_sent) return true;

  const lastSent = new Date(promo.last_push_sent);
  const now = new Date();
  const hoursDiff = (now - lastSent) / (1000 * 60 * 60);

  switch (promo.push_frequency) {
    case 'hourly':
      return hoursDiff >= 1;
    case 'daily':
      return hoursDiff >= 24;
    case 'once':
      return false;
    default:
      return false;
  }
}

async function sendPromoPush(promo) {
  try {
    const devices = await getDevicesForBrand(promo.brand_id);
    if (!devices || devices.length === 0) return;

    const batch = await sendPushBatch(devices.map((d) => d.push_token));
    closeApnsSession();
    const sent = batch.filter((r) => r.success).length;

    await logPush({
      brand_id: promo.brand_id,
      type: 'strip_promo',
      message: promo.push_message,
      sent_to: sent,
      total_devices: devices.length,
    });

    console.log(`[StripPromo] Push sent for "${promo.title}": ${sent}/${devices.length} devices`);
  } catch (e) {
    console.error(`[StripPromo] Push error for "${promo.title}":`, e.message);
  }
}

async function checkExpiredPromos() {
  try {
    const { pool } = require('../db');
    const expired = await pool.query(`
      SELECT sp.*, b.name as brand_name FROM strip_promos sp
      JOIN brands b ON sp.brand_id = b.id
      WHERE sp.active = true AND sp.end_date < NOW()
    `);

    for (const promo of expired.rows) {
      await updateStripPromo(promo.id, { active: false });

      const otherActive = await pool.query(
        `SELECT id FROM strip_promos WHERE brand_id = $1 AND active = true AND start_date <= NOW() AND end_date >= NOW()`,
        [promo.brand_id]
      );

      if (otherActive.rows.length === 0) {
        const brand = await getBrand(promo.brand_id);
        const config = brand.config || {};
        const logos = config.logos || {};

        if (logos.strip_default) {
          const updConfig = { ...config, logos: { ...logos, strip: logos.strip_default } };
          delete updConfig.logos.strip_default;
          await updateBrand(promo.brand_id, { config: updConfig });
          console.log(`[StripPromo] Restored default strip for brand ${promo.brand_name}`);

          await regenerateBrandPasses(promo.brand_id);
        }
      }

      await logEvent({
        brand_id: promo.brand_id,
        event_type: 'strip_promo_expired',
        metadata: { promo_id: promo.id, title: promo.title },
      });

      console.log(`[StripPromo] Promo "${promo.title}" expired for brand ${promo.brand_name}`);
    }
  } catch (e) {
    console.error('[StripPromo] Expired check error:', e.message);
  }
}

/**
 * After strip change: bulk touch + optional Google sync + optional APNs nudge.
 * Devices download fresh .pkpass on demand (no mass pre-signing).
 */
async function regenerateBrandPasses(brand_id, { sendPush = true } = {}) {
  try {
    const passes = await listPasses(brand_id);
    const activePasses = passes.filter((p) => p.status === 'active');
    const brand = await getBrand(brand_id);

    if (!activePasses.length || !brand) return;

    const touched = await touchPassesByIds(activePasses.map((p) => p.id));
    let googleSynced = { updated: 0 };
    if (activePasses.some((p) => p.google_wallet_object_id)) {
      googleSynced = await syncGoogleWalletObjectsForPasses({
        brand,
        passes: activePasses,
        message: null,
      });
    }

    let pushSent = 0;
    if (sendPush) {
      const devices = await getDevicesForBrand(brand_id);
      if (devices.length) {
        const batch = await sendPushBatch(devices.map((d) => d.push_token));
        closeApnsSession();
        pushSent = batch.filter((r) => r.success).length;
      }
    }

    console.log(
      `[StripPromo] Refreshed ${touched.touched}/${activePasses.length} passes for brand ${brand.name}`
      + ` (google: ${googleSynced.updated || 0}, apns: ${pushSent})`
    );
  } catch (e) {
    console.error('[StripPromo] Pass refresh error:', e.message);
  }
}

module.exports = {
  runStripPromoCheck,
  regenerateBrandPasses,
};
