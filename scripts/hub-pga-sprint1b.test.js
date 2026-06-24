'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

test('AC-017: enabling PGA seeds default experiences via upsertPgaSettings', () => {
  const db = read('src/db/index.js');
  const seed = read('src/engine/pga-seed.js');
  assert.match(db, /async function upsertPgaSettings/);
  assert.match(db, /seedPgaDefaultsForBrand/);
  assert.match(seed, /PGA_DEFAULT_EXPERIENCES/);
  assert.match(seed, /COIN_ACTIONS_DEFAULT/);
  assert.equal(JSON.parse(JSON.stringify(require('../src/engine/pga-seed').PGA_DEFAULT_EXPERIENCES)).length, 10);
});

test('Sprint 1: PGA dashboard API routes registered', () => {
  const api = read('src/api/pga-dashboard.js');
  const routes = read('src/api/routes.js');
  assert.match(api, /\/brands\/:id\/pga-settings/);
  assert.match(api, /\/experiences/);
  assert.match(api, /\/coins\/actions/);
  assert.match(api, /\/coins\/manual-grant/);
  assert.match(api, /\/brands\/:id\/engagement-analytics/);
  assert.match(routes, /registerPgaDashboardRoutes/);
});

test('AC-007/010: passkit adds PGA links and coin balance when PGA enabled', () => {
  const passkit = read('src/engine/passkit.js');
  const employee = read('src/engine/employee-pass.js');
  assert.match(passkit, /buildHubAppUrl\(token, brand\.slug, 'pga'\)/);
  assert.match(passkit, /buildHubAppUrl\(token, brand\.slug, 'me'\)/);
  assert.match(passkit, /getCurrentBalance/);
  assert.match(employee, /HUB DIPENDENTE/);
  assert.match(employee, /label: 'SUPPORT'/);
  assert.match(employee, /AREA RISERVATA/);
  assert.match(employee, /key: 'coin_balance'/);
});

test('AC-025: coin anniversaries cron scheduled at boot', () => {
  assert.match(read('src/engine/coin-anniversaries.js'), /runCoinAnniversariesJob/);
  assert.match(read('src/server.js'), /scheduleCoinAnniversariesJob/);
});

test('hub-jwt buildHubUrl targets /conv path', () => {
  const { buildHubUrl, buildHubAppUrl } = require('../src/engine/hub-jwt');
  const url = buildHubUrl('tok', 'acme');
  assert.match(url, /\/conv\?token=tok/);
  assert.match(buildHubAppUrl('tok', 'acme', 'pga'), /\/pga\?token=tok/);
});
