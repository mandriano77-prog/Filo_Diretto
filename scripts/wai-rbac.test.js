'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rbac = require('../src/engine/rbac');
const { getWaiModelFallbacks } = require('../src/engine/ai-models');

test('W.AI routes classify under push so sender is not blanket-blocked', () => {
  const ask = rbac.enforceApiPermission({ role: 'sender', brand_id: 'b1' }, 'POST', '/wai/ask');
  assert.equal(ask.ok, true);

  const execute = rbac.enforceApiPermission({ role: 'sender', brand_id: 'b1' }, 'POST', '/wai/execute');
  assert.equal(execute.ok, true);

  const history = rbac.enforceApiPermission({ role: 'sender', brand_id: 'b1' }, 'GET', '/wai/history');
  assert.equal(history.ok, true);

  const stripSave = rbac.enforceApiPermission({ role: 'sender', brand_id: 'b1' }, 'POST', '/wai/strip-save');
  assert.equal(stripSave.ok, true);
});

test('reporter cannot call W.AI write endpoints', () => {
  const ask = rbac.enforceApiPermission({ role: 'reporter', brand_id: 'b1' }, 'POST', '/wai/ask');
  assert.equal(ask.ok, false);
  assert.equal(ask.status, 403);
});

test('sender can execute push W.AI intents but not audience.create', () => {
  assert.equal(rbac.canExecuteWaiIntent('sender', 'push.send'), true);
  assert.equal(rbac.canExecuteWaiIntent('sender', 'strip.generate'), true);
  assert.equal(rbac.canExecuteWaiIntent('sender', 'audience.create'), false);
  assert.equal(rbac.canExecuteWaiIntent('manager', 'audience.create'), true);
});

test('getWaiModelFallbacks chains opus 4.7 to opus 4.6 then sonnet', () => {
  const chain = getWaiModelFallbacks('claude-opus-4-7');
  assert.deepEqual(chain, ['claude-opus-4-6', 'claude-sonnet-4-6']);
});

test('W.AI push uses HR push limits and passes generated strip to wallet update', () => {
  const wai = fs.readFileSync(path.join(__dirname, '../src/engine/wai.js'), 'utf8');
  const routes = fs.readFileSync(path.join(__dirname, '../src/api/routes.js'), 'utf8');
  assert.match(wai, /PUSH_TITLE_MAX/);
  assert.match(wai, /PUSH_MESSAGE_MAX/);
  assert.doesNotMatch(wai, /slice\(0,\s*60\)/);
  assert.doesNotMatch(wai, /slice\(0,\s*180\)/);
  assert.match(routes, /resolvedStripBase64:\s*stripBase64/);
  assert.match(routes, /no badges, no stickers, no circles/);
});

test('W.AI pass preview does not reserve HR thumbnail space', () => {
  const preview = fs.readFileSync(path.join(__dirname, '../src/engine/push-pass-preview.js'), 'utf8');
  assert.doesNotMatch(preview, /reserveThumbnail/);
});
