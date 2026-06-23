/**
 * FD-DS FASE 6 — Block dashboard use on smartphone viewports (<768px).
 */
(function () {
  'use strict';

  var MQ = '(max-width: 767px)';
  var overlay = null;

  function isFiloApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'fdMobileGate';
    overlay.className = 'fd-mobile-gate';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'fdMobileGateTitle');
    overlay.innerHTML =
      '<div class="fd-mobile-gate__panel">' +
      '<div class="fd-mobile-gate__icon" aria-hidden="true">📱</div>' +
      '<h2 class="fd-mobile-gate__title" id="fdMobileGateTitle">Schermo troppo piccolo</h2>' +
      '<p class="fd-mobile-gate__desc">Il backoffice FiloDiretto è ottimizzato per tablet e desktop. ' +
      'Ruota il dispositivo o apri la dashboard da un browser con larghezza almeno 768px.</p>' +
      '<p class="fd-mobile-gate__hint">Da 768px in su restano disponibili layout tablet e tabelle responsive.</p>' +
      '</div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function syncMobileGate() {
    if (!isFiloApp()) return;
    var gated = window.matchMedia(MQ).matches;
    document.documentElement.classList.toggle('fd-mobile-gated', gated);
    var node = ensureOverlay();
    node.hidden = !gated;
  }

  function initFdMobileGate() {
    if (!isFiloApp()) return;
    syncMobileGate();
    window.addEventListener('resize', syncMobileGate);
    if (typeof window.matchMedia === 'function') {
      var mq = window.matchMedia(MQ);
      if (typeof mq.addEventListener === 'function') mq.addEventListener('change', syncMobileGate);
      else if (typeof mq.addListener === 'function') mq.addListener(syncMobileGate);
    }
  }

  window.fdSyncMobileGate = syncMobileGate;
  window.fdInitMobileGate = initFdMobileGate;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdMobileGate);
  } else {
    initFdMobileGate();
  }
})();
