'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { publicBrandTheme, parseBrandConfig } = require('../src/engine/public-brand-theme');

test('publicBrandTheme reads brand_theme from JSON string config', () => {
  const theme = publicBrandTheme({
    config: JSON.stringify({
      brand_theme: { accent: '#112233', accentHover: '#445566', textOnAccent: '#FFFFFF' }
    })
  });
  assert.equal(theme.accent, '#112233');
  assert.equal(theme.accentHover, '#445566');
  assert.equal(theme.textOnAccent, '#FFFFFF');
});

test('publicBrandTheme prefers brand_theme.accent over legacy labelColor', () => {
  const theme = publicBrandTheme({
    config: {
      labelColor: '#8B5CF6',
      brand_theme: { accent: '#00AA88', baseColor: '#007755' }
    }
  });
  assert.equal(theme.accent, '#00AA88');
  assert.equal(theme.accentHover, '#007755');
});

test('publicBrandTheme fills missing hover and textOnAccent', () => {
  const theme = publicBrandTheme({
    config: { brand_theme: { accent: '#ABCDEF' } }
  });
  assert.equal(theme.accent, '#ABCDEF');
  assert.equal(theme.accentHover, '#ABCDEF');
  assert.equal(theme.textOnAccent, '#FFFFFF');
});

test('publicBrandTheme returns null when no accent source exists', () => {
  assert.equal(publicBrandTheme({ config: {} }), null);
  assert.equal(publicBrandTheme({ config: parseBrandConfig('not-json') }), null);
});
