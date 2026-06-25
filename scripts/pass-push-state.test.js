'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  parsePushAnnouncementRecord,
  resolveHrPassPushState,
  brandConfigForHrPass,
} = require('../src/engine/pass-push-state');

test('fresh pass instance ignores brand pushAnnouncement', () => {
  const brand = {
    config: {
      pushAnnouncement: { title: 'PROMO', message: 'Vecchia push globale', ts: 1 },
      stripOverride: 'abc',
    },
  };
  const instance = { id: 'p1', serial_number: 'SN1' };
  const cfg = brandConfigForHrPass(brand, instance);
  assert.equal(cfg.pushAnnouncement, undefined);
  assert.equal(cfg.stripOverride, undefined);
});

test('targeted pass uses instance push overlay', () => {
  const brand = { config: { pushAnnouncement: { title: 'X', message: 'y', ts: 1 } } };
  const instance = {
    push_announcement: { title: '2x1', message: 'Solo oggi', ts: 1710000000001 },
    push_strip_base64: 'stripB64',
  };
  const state = resolveHrPassPushState(instance);
  assert.equal(state.pushAnnouncement.message, 'Solo oggi');
  assert.equal(state.stripBase64, 'stripB64');
  const cfg = brandConfigForHrPass(brand, instance);
  assert.equal(cfg.pushAnnouncement.title, '2x1');
  assert.equal(cfg.stripOverride, 'stripB64');
});

test('parsePushAnnouncementRecord rejects empty message', () => {
  assert.equal(parsePushAnnouncementRecord({ title: 'A', message: '  ' }), null);
});

test('parsePushAnnouncementRecord preserves back_details', () => {
  const ann = parsePushAnnouncementRecord({
    title: '2x1',
    message: 'Solo oggi',
    back_details: 'Valido fino al 31/12',
    ts: 1,
  });
  assert.equal(ann.back_details, 'Valido fino al 31/12');
});
