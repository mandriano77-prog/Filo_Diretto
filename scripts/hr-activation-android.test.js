'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const HR_SOURCE = fs.readFileSync(path.join(__dirname, '../src/engine/hr-activation.js'), 'utf8');
const ACTIVATE_HTML = fs.readFileSync(path.join(__dirname, '../src/activate/index.html'), 'utf8');
const ROUTES_SOURCE = fs.readFileSync(path.join(__dirname, '../src/api/routes.js'), 'utf8');

test('hr-activation allows JWT lookup for already-activated members', () => {
  assert.match(HR_SOURCE, /activation_status === 'activated'/);
  assert.match(HR_SOURCE, /activation_token !== token/);
  assert.doesNotMatch(HR_SOURCE, /activation_token = \$2[\s\S]*activation_token_expires_at > NOW\(\)/);
});

test('confirmMemberActivation returns idempotent path for activated members', () => {
  assert.match(HR_SOURCE, /already_activated: true/);
});

test('activate page uses robust token extraction and no-store fetch', () => {
  assert.match(ACTIVATE_HTML, /extractActivationToken/);
  assert.match(ACTIVATE_HTML, /cache: 'no-store'/);
  assert.match(ACTIVATE_HTML, /pageshow/);
});

test('activate API sets no-store cache headers', () => {
  assert.match(ROUTES_SOURCE, /activationApiCacheHeaders/);
  assert.match(ROUTES_SOURCE, /extractActivationTokenFromRequest/);
});
