'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { resolvePassIconBuffers, readIconPackFromConfig } = require('../src/engine/brand-wallet-logo');

async function tinyPng() {
  return sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 200, g: 50, b: 50 } },
  })
    .png()
    .toBuffer();
}

test('resolvePassIconBuffers uses synced config.logos without wallet_icon media id', async () => {
  const iconBuf = await tinyPng();
  const pack = await require('../src/engine/brand-wallet-logo').buildNotificationIconFromRaw(iconBuf);
  const brand = {
    config: {
      logos: {
        icon: pack.icon.toString('base64'),
        'icon@2x': pack.icon2x.toString('base64'),
      },
    },
  };
  const resolved = await resolvePassIconBuffers(brand, null);
  assert.equal(resolved.source, 'config_logos_synced');
  assert.ok(resolved.iconBuffers?.icon?.length > 0);
});

test('readIconPackFromConfig returns buffers', async () => {
  const iconBuf = await tinyPng();
  const pack = readIconPackFromConfig({
    icon: iconBuf.toString('base64'),
    'icon@2x': iconBuf.toString('base64'),
  });
  assert.ok(pack.icon.length > 0);
});
