/**
 * Email Recap Engine
 *
 * Sends weekly (every Monday 9:00) and monthly (1st of month 9:00) recap emails
 * to ALL members with an email address — not just those who earned points.
 * Members who earned 0 points in the period still receive their position recap.
 *
 * Each brand can enable/disable recaps via config.email_recap_weekly / email_recap_monthly.
 * Default: both enabled (if RESEND_API_KEY is set).
 */

const db = require('../db');
const { sendRecapEmail } = require('./mailer');

// ─── Period Helpers ─────────────────────────────────────

function getLastWeekBounds() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - 7);
  lastMonday.setHours(0, 0, 0, 0);
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  lastSunday.setHours(23, 59, 59, 999);
  return { start: lastMonday, end: lastSunday };
}

function getLastMonthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return { start, end };
}

function getMonthName(date) {
  return date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
}

function getWeekRange(start, end) {
  const fmt = { day: '2-digit', month: 'short' };
  return `${start.toLocaleDateString('it-IT', fmt)} - ${end.toLocaleDateString('it-IT', fmt)}`;
}

// ─── Get member's current tier ─────────────────────────

async function getMemberTier(brand_id, totalPoints) {
  try {
    const tiers = await db.listTiers(brand_id);
    if (!tiers || tiers.length === 0) return null;
    const sorted = tiers.sort((a, b) => (b.min_points || 0) - (a.min_points || 0));
    for (const tier of sorted) {
      if (totalPoints >= (tier.min_points || 0)) return tier.name;
    }
    return sorted[sorted.length - 1]?.name || null;
  } catch(e) {
    return null;
  }
}

// ─── Send Recap for a Brand ────────────────────────────

async function sendBrandRecap(brand, periodType) {
  const bounds = periodType === 'weekly' ? getLastWeekBounds() : getLastMonthBounds();
  const periodLabel = periodType === 'weekly'
    ? `Settimana ${getWeekRange(bounds.start, bounds.end)}`
    : getMonthName(bounds.start).charAt(0).toUpperCase() + getMonthName(bounds.start).slice(1);

  const brandColor = brand.config?.backgroundColor || '#000000';

  // Get ALL members with an email (not just those with points)
  const allMembers = await db.getAllMembersWithEmail(brand.id);

  if (allMembers.length === 0) {
    console.log(`[EmailRecap] ${brand.name}: no members with email, skipping`);
    return { sent: 0, brand: brand.name };
  }

  // Get all points in the period (one query, then filter per member)
  const pointsLog = await db.getPointsLogForPeriod(brand.id, bounds.start, bounds.end);

  // Build a map: member_id -> { periodPoints, details[] }
  const pointsMap = {};
  for (const p of pointsLog) {
    if (!pointsMap[p.member_id]) pointsMap[p.member_id] = { total: 0, details: [] };
    pointsMap[p.member_id].total += parseInt(p.points) || 0;
    pointsMap[p.member_id].details.push(p);
  }

  let sent = 0;
  let errors = 0;

  for (const member of allMembers) {
    try {
      const memberData = pointsMap[member.id] || { total: 0, details: [] };
      const periodPoints = memberData.total;
      const memberPointsDetails = memberData.details;

      // Get total current points from pass
      const totalPoints = await db.getMemberTotalPoints(member.id);

      // Get tier
      const tierName = await getMemberTier(brand.id, totalPoints);

      const result = await sendRecapEmail({
        to: member.email,
        brandName: brand.name,
        brandColor,
        memberName: [member.first_name, member.last_name].filter(Boolean).join(' ') || 'Membro',
        periodLabel,
        periodPoints,
        pointsDetails: memberPointsDetails,
        totalPoints,
        tierName
      });

      if (result && !result.skipped && !result.error) {
        sent++;
        try {
          await db.logEmail({
            brand_id: brand.id,
            member_id: member.id,
            email_type: `recap_${periodType}`,
            subject: `Recap ${periodLabel}`,
            status: 'sent'
          });
        } catch(e) {}
      } else {
        if (result?.error) console.error(`[EmailRecap] Resend error for ${member.email}: ${result.error}`);
        errors++;
      }

      // Rate limiting: 100ms between emails
      await new Promise(r => setTimeout(r, 100));
    } catch(e) {
      console.error(`[EmailRecap] Error sending to ${member.email}:`, e.message);
      errors++;
    }
  }

  console.log(`[EmailRecap] ${brand.name} ${periodType}: ${sent} sent, ${errors} errors (${allMembers.length} total members)`);
  return { sent, errors, brand: brand.name, period: periodType, totalMembers: allMembers.length };
}

// ─── Main Recap Runner ─────────────────────────────────

async function runRecap(periodType) {
  console.log(`[EmailRecap] Starting ${periodType} recap...`);

  try {
    const brands = await db.listBrands();
    const results = [];

    for (const brand of brands) {
      const config = brand.config || {};

      if (periodType === 'weekly' && config.email_recap_weekly === false) {
        console.log(`[EmailRecap] ${brand.name}: weekly recap disabled, skipping`);
        continue;
      }
      if (periodType === 'monthly' && config.email_recap_monthly === false) {
        console.log(`[EmailRecap] ${brand.name}: monthly recap disabled, skipping`);
        continue;
      }

      try {
        const result = await sendBrandRecap(brand, periodType);
        results.push(result);
      } catch(e) {
        console.error(`[EmailRecap] Error for brand ${brand.name}:`, e.message);
        results.push({ brand: brand.name, error: e.message });
      }
    }

    const totalSent = results.reduce((s, r) => s + (r.sent || 0), 0);
    console.log(`[EmailRecap] ${periodType} recap complete: ${totalSent} emails sent across ${results.length} brands`);
    return results;
  } catch(e) {
    console.error('[EmailRecap] Fatal error:', e.message);
    return [];
  }
}

// ─── Cron Scheduling ───────────────────────────────────

function startRecapCrons() {
  setInterval(() => {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay(); // 0=Sun, 1=Mon
    const date = now.getDate();

    // Weekly: Monday at 9:00
    if (day === 1 && hour === 9) {
      console.log('[EmailRecap] Triggering weekly recap (Monday 9:00)');
      runRecap('weekly').catch(e => console.error('[EmailRecap] Weekly cron error:', e.message));
    }

    // Monthly: 1st of month at 9:00
    if (date === 1 && hour === 9) {
      console.log('[EmailRecap] Triggering monthly recap (1st of month 9:00)');
      runRecap('monthly').catch(e => console.error('[EmailRecap] Monthly cron error:', e.message));
    }
  }, 60 * 60 * 1000);

  console.log('[EmailRecap] Recap crons started (weekly: Mon 9:00, monthly: 1st 9:00)');
}

module.exports = {
  runRecap,
  startRecapCrons,
  sendBrandRecap
};
