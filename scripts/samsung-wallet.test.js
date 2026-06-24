'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const MOD = path.join(__dirname, '../src/engine/samsung-wallet.js');

const ENV_KEYS = [
  'SAMSUNG_WALLET_CARD_TYPE',
  'SAMSUNG_WALLET_CARD_SUBTYPE',
  'SAMSUNG_WALLET_DEFAULT_CC2',
  'SAMSUNG_WALLET_CARD_ID',
  'SAMSUNG_WALLET_CERTIFICATE_ID',
  'SAMSUNG_WALLET_PARTNER_ID',
  'CUSTOM_DOMAIN'
];

function loadSamsung(overrides = {}) {
  const saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    if (Object.prototype.hasOwnProperty.call(overrides, k)) {
      if (overrides[k] == null) delete process.env[k];
      else process.env[k] = String(overrides[k]);
    }
  }
  delete require.cache[require.resolve(MOD)];
  const mod = require(MOD);
  return {
    mod,
    restore() {
      for (const k of ENV_KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
      delete require.cache[require.resolve(MOD)];
    }
  };
}

test('buildLoyaltyCardResponse renders HR employee pass and IT tsapi default', () => {
  const { mod, restore } = loadSamsung({
    SAMSUNG_WALLET_CARD_TYPE: 'generic',
    SAMSUNG_WALLET_CARD_SUBTYPE: 'others',
    SAMSUNG_WALLET_DEFAULT_CC2: 'IT',
    SAMSUNG_WALLET_CARD_ID: 'test-card',
    SAMSUNG_WALLET_CERTIFICATE_ID: 'test',
    SAMSUNG_WALLET_PARTNER_ID: 'test',
    CUSTOM_DOMAIN: 'studio.filodiretto.app'
  });

  try {
    const brand = { id: 'b1', name: 'FiloDiretto', config: { product_line: 'hr' } };
    const template = { name: 'Pass Dipendente', style: { backgroundColor: '#112233' } };
    const instance = {
      serial_number: 'SN-001',
      field_values: {
        first_name: 'Ada',
        last_name: 'Lovelace',
        employee_id: '42',
        department: 'People'
      }
    };

    const result = mod.buildLoyaltyCardResponse(brand, template, instance, 'refid-test', 'ACTIVE');
    assert.equal(result.card.type, 'generic');
    assert.equal(result.card.subType, 'others');
    const attrs = result.card.data[0].attributes;
    assert.ok(attrs['serial1.value']);
    assert.equal(attrs['serial1.serialType'], 'QRCODE');
    assert.equal(attrs['serial1.ptFormat'], 'QRCODE');
    assert.equal(attrs.appLinkData, 'https://studio.filodiretto.app');
    assert.equal(attrs.appLinkName, 'FiloDiretto');
    assert.equal(typeof attrs.startDate, 'number');
    assert.equal(attrs.title, 'Ada Lovelace');
    assert.equal(attrs.providerName, 'FiloDiretto');
    assert.equal(attrs.subtitle, 'Pass dipendente');
    assert.match(attrs.noticeDesc, /MATRICOLA: #42/);
    assert.match(attrs.noticeDesc, /REPARTO: People/);

    assert.equal(mod.buildTsapiBaseUrl(), 'https://it-tsapi.walletsvc.samsung.com');
    assert.equal(mod.buildTsapiBaseUrl('de'), 'https://de-tsapi.walletsvc.samsung.com');
  } finally {
    restore();
  }
});
