'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const {
  resolvePassIconBuffers,
  readIconPackFromConfig,
  extractBrandPaletteFromImage,
  applyAutoPaletteToConfig,
} = require('../src/engine/brand-wallet-logo');

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
      wallet_icon_rev: 1,
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

test('resolvePassIconBuffers prefers template wallet_icon over logo crop', async () => {
  const iconBuf = await tinyPng();
  const pack = await require('../src/engine/brand-wallet-logo').buildNotificationIconFromRaw(iconBuf);
  const brand = { config: {} };
  const template = {
    style: {
      images: {
        wallet_icon: iconBuf.toString('base64'),
      },
    },
  };
  const logoBuf = await sharp({
    create: { width: 200, height: 50, channels: 3, background: { r: 10, g: 20, b: 30 } },
  }).png().toBuffer();
  const resolved = await resolvePassIconBuffers(brand, { buffer: logoBuf }, template);
  assert.equal(resolved.source, 'template_wallet_icon');
  assert.ok(resolved.iconBuffers?.icon?.length > 0);
  assert.equal(resolved.iconBuffers.icon.length, pack.icon.length);
});

test('extractBrandPaletteFromImage derives readable pass colors from logo', async () => {
  const logoBuf = await sharp({
    create: { width: 120, height: 80, channels: 4, background: { r: 17, g: 120, b: 220, alpha: 1 } },
  }).png().toBuffer();
  const palette = await extractBrandPaletteFromImage(logoBuf);
  assert.match(palette.backgroundColor, /^#[0-9A-F]{6}$/);
  assert.match(palette.foregroundColor, /^#[0-9A-F]{6}$/);
  assert.match(palette.labelColor, /^#[0-9A-F]{6}$/);
  assert.notEqual(palette.backgroundColor, '#0D0B1A');
});

test('applyAutoPaletteToConfig respects manual palette lock', async () => {
  const logoBuf = await tinyPng();
  const config = await applyAutoPaletteToConfig({
    backgroundColor: '#123456',
    wallet_palette: { locked: true }
  }, logoBuf, 'logo');
  assert.equal(config.backgroundColor, '#123456');
});
