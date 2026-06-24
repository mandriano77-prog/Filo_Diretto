'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const serverJs = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'src/dashboard/index.html'), 'utf8');
const baseUrlJs = fs.readFileSync(path.join(root, 'src/engine/base-url.js'), 'utf8');

test('server boot.js hardcodes HR product lock', () => {
  assert.match(serverJs, /const DASHBOARD_PRODUCT_LOCK = 'hr'/);
  assert.doesNotMatch(serverJs, /getDeployDashboardProductLine/);
  assert.match(serverJs, /__2WALLET_PRODUCT_LOCK__=\$\{JSON\.stringify\(lock\)\}/);
});

test('dashboard index boots Filo HR shell without Ads2Wallet scripts', () => {
  assert.match(indexHtml, /data-app', 'filodiretto'/);
  assert.match(indexHtml, /data-shell', 'light'/);
  assert.match(indexHtml, /window\.API = '\/api\/v1'/);
  assert.match(indexHtml, /<title>FiloDiretto<\/title>/);
  assert.doesNotMatch(indexHtml, /a2w-shell\.js/);
  assert.doesNotMatch(indexHtml, /a2w-template-editor\.js/);
  assert.doesNotMatch(indexHtml, /a2w-setup-checklist\.js/);
  assert.doesNotMatch(indexHtml, /host\.includes\('ads2wallet'\)/);
  assert.doesNotMatch(indexHtml, /<span class="chrome-product-title">Ads2Wallet<\/span>/);
  assert.match(indexHtml, /chrome-product-title">Filo Diretto/);
  assert.match(indexHtml, /filodiretto:jwt/);
});

test('base-url defaults brand to Filo Diretto (HR-only repo)', () => {
  assert.match(baseUrlJs, /return 'Filo Diretto'/);
  assert.match(baseUrlJs, /function isHrProductLine\(\) \{\s*return true;/);
});
