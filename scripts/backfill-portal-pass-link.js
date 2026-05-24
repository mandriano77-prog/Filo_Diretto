#!/usr/bin/env node
/**
 * Backfill portal magic-link tokens for existing pass_instances.
 *
 * Usage:
 *   node --env-file=.env scripts/backfill-portal-pass-link.js
 *   node --env-file=.env scripts/backfill-portal-pass-link.js --brand-id=UUID
 *   node --env-file=.env scripts/backfill-portal-pass-link.js --dry-run
 *   node --env-file=.env scripts/backfill-portal-pass-link.js --touch
 *
 * Requires PORTAL_BASE_URL + PORTAL_JWT_SECRET (or JWT_SECRET).
 * --touch bumps last_updated so installed passes can pick up the new back link via Wallet refresh.
 */
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

const { getDb, pool, touchPass } = require('../src/db');
const {
  isPortalLinkEnabled,
  resolvePortalLinkForPass
} = require('../src/engine/portal-pass-link');

function parseArgs(argv) {
  const opts = { dryRun: false, touch: false, brandId: null, limit: null };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--touch') opts.touch = true;
    else if (arg.startsWith('--brand-id=')) opts.brandId = arg.slice('--brand-id='.length);
    else if (arg.startsWith('--limit=')) opts.limit = parseInt(arg.slice('--limit='.length), 10);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!isPortalLinkEnabled()) {
    console.error('PORTAL_BASE_URL non configurato — impossibile emettere link portale.');
    process.exit(1);
  }

  await getDb();

  const params = [];
  let where = "WHERE status IS DISTINCT FROM 'deleted'";
  if (opts.brandId) {
    params.push(opts.brandId);
    where += ` AND brand_id = $${params.length}`;
  }
  let limitSql = '';
  if (opts.limit && opts.limit > 0) {
    params.push(opts.limit);
    limitSql = ` LIMIT $${params.length}`;
  }

  const { rows } = await pool.query(
    `SELECT id, brand_id, serial_number FROM pass_instances ${where} ORDER BY created_at ASC${limitSql}`,
    params
  );

  console.log(`Pass da processare: ${rows.length}${opts.dryRun ? ' (dry-run)' : ''}`);

  let issued = 0;
  let reused = 0;
  let touched = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      if (opts.dryRun) {
        console.log(`[dry-run] ${row.id} (${row.serial_number})`);
        continue;
      }
      const link = await resolvePortalLinkForPass(row.id, { rotate: false });
      if (!link) {
        console.warn(`[skip] ${row.id} — link non emesso`);
        continue;
      }
      if (link.rotated) issued++;
      else reused++;

      if (opts.touch) {
        await touchPass(row.id);
        touched++;
      }
      console.log(`[ok] ${row.serial_number} → ${link.portal_url ? 'link ready' : 'no url'}`);
    } catch (err) {
      errors++;
      console.error(`[err] ${row.id}:`, err.message);
    }
  }

  console.log(
    `Fatto. nuovi token: ${issued}, riusati: ${reused}, touch: ${touched}, errori: ${errors}`
  );
  if (opts.touch && touched > 0) {
    console.log('Pass toccati — i dispositivi Wallet riceveranno aggiornamento al prossimo refresh/push.');
  } else if (!opts.dryRun && rows.length > 0) {
    console.log('Suggerimento: riesegui con --touch per propagare il link sul retro del pass installato.');
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
