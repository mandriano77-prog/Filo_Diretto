'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  parsePushAnnouncementRecord,
  resolveHrPassPushState,
  brandConfigForHrPass,
} = require('../src/engine/pass-push-state');
const { generatePassJson } = require('../src/engine/passkit');

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

test('Apple HR pass includes geofencing locations and maxDistance', () => {
  const passJson = generatePassJson(
    { id: 'tpl1', name: 'HR', fields: {}, style: {} },
    { id: 'pass1', serial_number: 'SN-GEO-1', field_values: {} },
    {
      id: 'brand1',
      name: 'Acme HR',
      slug: 'acme',
      config: {
        product_line: 'hr',
        locations: [
          {
            latitude: '45.4764',
            longitude: '9.1432',
            relevantText: 'Sei vicino alla sede',
            radius: '50'
          }
        ],
        maxDistance: 50
      }
    },
    {
      baseUrl: 'https://studio.example.test',
      member: {
        first_name: 'Mario',
        last_name: 'Rossi',
        department: 'Engineering'
      }
    }
  );

  assert.equal(passJson.locations.length, 1);
  assert.deepEqual(passJson.locations[0], {
    latitude: 45.4764,
    longitude: 9.1432,
    relevantText: 'Sei vicino alla sede'
  });
  assert.equal(passJson.maxDistance, 50);
  const structure = passJson.storeCard || passJson.generic;
  const frontFields = [
    ...(structure.headerFields || []),
    ...(structure.primaryFields || []),
    ...(structure.secondaryFields || []),
    ...(structure.auxiliaryFields || [])
  ];
  assert.equal(frontFields.some((field) => field.key === 'geo_inzone_promo'), false);
});
