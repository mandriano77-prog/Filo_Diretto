/**
 * Wallet channel flags — Samsung UI/push frozen by default (enable on request).
 * Set SAMSUNG_WALLET_UI_ENABLED=true on the server to re-enable.
 */

function isSamsungWalletUiEnabled() {
  const v = String(process.env.SAMSUNG_WALLET_UI_ENABLED || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function activePushChannelKeys() {
  const keys = ['apple', 'google'];
  if (isSamsungWalletUiEnabled()) keys.push('samsung');
  return keys;
}

module.exports = {
  isSamsungWalletUiEnabled,
  activePushChannelKeys,
};
