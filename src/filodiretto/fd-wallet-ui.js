/**
 * FD — Samsung Wallet UI frozen by default (on-request only).
 * Server: SAMSUNG_WALLET_UI_ENABLED=true to re-enable everywhere.
 */
(function (global) {
  'use strict';

  function isSamsungWalletUiEnabled() {
    try {
      if (global.__FD_SAMSUNG_WALLET_UI__ === true) return true;
    } catch (_) {}
    return false;
  }

  function isFiloApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (global.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }

  global.__FD_SAMSUNG_WALLET_UI__ = global.__FD_SAMSUNG_WALLET_UI__ === true;
  global.fdActiveWalletChannelKeys = function fdActiveWalletChannelKeys() {
    return isSamsungWalletUiEnabled() ? ['apple', 'google', 'samsung'] : ['apple', 'google'];
  };

  function hideSamsungWalletUi() {
    if (!isFiloApp() || isSamsungWalletUiEnabled()) return;
    document.documentElement.setAttribute('data-samsung-wallet-ui', '0');

    document.querySelectorAll('option[value="samsung"]').forEach(function (opt) {
      opt.disabled = true;
      opt.hidden = true;
    });

    ['passDetailSamsungBtn'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.hidden = true;
      el.setAttribute('aria-hidden', 'true');
      el.tabIndex = -1;
    });

    document.querySelectorAll('.wallet-diag-item--samsung, .fd-push-preview__device--samsung').forEach(function (el) {
      el.hidden = true;
      el.setAttribute('aria-hidden', 'true');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideSamsungWalletUi);
  } else {
    hideSamsungWalletUi();
  }
})(typeof window !== 'undefined' ? window : global);
