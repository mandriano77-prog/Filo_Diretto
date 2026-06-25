const test = require('node:test');
const assert = require('node:assert/strict');

const { parseWalletPushFlags } = require('../src/engine/push-dispatch');

test('parseWalletPushFlags supports comma-separated channel pairs', () => {
  assert.deepEqual(parseWalletPushFlags('apple,google'), {
    sendApple: true,
    sendGoogle: true,
    sendSamsung: false
  });
  assert.deepEqual(parseWalletPushFlags('google,samsung'), {
    sendApple: false,
    sendGoogle: true,
    sendSamsung: false
  });
});

test('parseWalletPushFlags keeps legacy both and all semantics (Samsung frozen by default)', () => {
  assert.deepEqual(parseWalletPushFlags('both'), {
    sendApple: true,
    sendGoogle: true,
    sendSamsung: false
  });
  assert.deepEqual(parseWalletPushFlags('all'), {
    sendApple: true,
    sendGoogle: true,
    sendSamsung: false
  });
});

test('parseWalletPushFlags includes Samsung when SAMSUNG_WALLET_UI_ENABLED=true', () => {
  const prev = process.env.SAMSUNG_WALLET_UI_ENABLED;
  process.env.SAMSUNG_WALLET_UI_ENABLED = 'true';
  assert.deepEqual(parseWalletPushFlags('all'), {
    sendApple: true,
    sendGoogle: true,
    sendSamsung: true
  });
  assert.deepEqual(parseWalletPushFlags('google,samsung'), {
    sendApple: false,
    sendGoogle: true,
    sendSamsung: true
  });
  if (prev === undefined) delete process.env.SAMSUNG_WALLET_UI_ENABLED;
  else process.env.SAMSUNG_WALLET_UI_ENABLED = prev;
});
