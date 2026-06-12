/**
 * FD — Identità Brand: social affordance, timestamp label, delete typing fix.
 */
(function () {
  'use strict';

  var SOCIAL_IDS = ['biSocialInstagram', 'biSocialFacebook', 'biSocialLinkedin', 'biSocialTiktok', 'biSocialX'];

  function isFiloBiApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }

  function isConfirmTypingMatch(input, expected) {
    if (window.A2W && window.A2W.UI && typeof window.A2W.UI.isConfirmTypingMatch === 'function') {
      return window.A2W.UI.isConfirmTypingMatch(input, expected);
    }
    return String(input || '').trim() === String(expected || '').trim();
  }

  function countSocialProfiles() {
    var n = 0;
    SOCIAL_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && String(el.value || '').trim()) n += 1;
    });
    return n;
  }

  function syncSocialToggleUi() {
    var toggle = document.getElementById('a2wBiSocialToggle');
    var body = document.getElementById('a2wBiSocialBody');
    var countEl = document.getElementById('fdBiSocialCount');
    if (!toggle) return;
    var count = countSocialProfiles();
    if (countEl) {
      countEl.textContent = count > 0 ? count + (count === 1 ? ' profilo' : ' profili') : 'Nessun profilo';
      countEl.classList.toggle('has-profiles', count > 0);
    }
    if (body && count > 0 && body.hidden) {
      body.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
    }
  }

  function enhanceSocialSection() {
    var toggle = document.getElementById('a2wBiSocialToggle');
    var body = document.getElementById('a2wBiSocialBody');
    if (!toggle || toggle.dataset.fdSocialEnhanced === '1') return;
    var section = toggle.closest('section');
    toggle.dataset.fdSocialEnhanced = '1';

    if (section && !section.querySelector('.fd-bi-social-head')) {
      var head = document.createElement('div');
      head.className = 'fd-bi-social-head';
      head.innerHTML =
        '<p class="fd-bi-social-lead">Collegamenti ai profili social del brand (opzionale). Appaiono nel pass e nelle comunicazioni.</p>';
      section.insertBefore(head, toggle);
    }

    toggle.classList.add('fd-bi-social-trigger');
    if (!toggle.querySelector('.fd-bi-social-trigger__chevron')) {
      var labelWrap = document.createElement('span');
      labelWrap.className = 'fd-bi-social-trigger__label';
      labelWrap.innerHTML = '<span class="fd-bi-social-trigger__title">Social</span><span class="fd-bi-social-trigger__meta" id="fdBiSocialCount">Nessun profilo</span>';
      var chevron = document.createElement('span');
      chevron.className = 'fd-bi-social-trigger__chevron';
      chevron.setAttribute('aria-hidden', 'true');
      chevron.textContent = '›';
      toggle.textContent = '';
      toggle.appendChild(labelWrap);
      toggle.appendChild(chevron);
    }

    if (body) body.classList.add('fd-bi-social-body');

    SOCIAL_IDS.forEach(function (id) {
      var input = document.getElementById(id);
      if (!input || input.dataset.fdSocialBound === '1') return;
      input.dataset.fdSocialBound = '1';
      input.addEventListener('input', syncSocialToggleUi);
    });

    if (!toggle.dataset.fdSocialToggleBound) {
      toggle.dataset.fdSocialToggleBound = '1';
      toggle.addEventListener('click', function () {
        requestAnimationFrame(syncSocialToggleUi);
      });
    }

    syncSocialToggleUi();
  }

  function formatBadgeLabel(stateLabel) {
    if (!stateLabel) return stateLabel;
    if (stateLabel === 'Modifiche non salvate' || stateLabel === 'Salvataggio…') return stateLabel;
    if (/^Salvato|^circa/i.test(stateLabel)) {
      return 'Ultima modifica: ' + stateLabel.replace(/^Salvato\s*/i, '');
    }
    if (stateLabel === 'Salvato') return 'Ultima modifica: ora';
    return stateLabel;
  }

  function patchSaveStateBadge() {
    if (window.__fdBiBadgePatched || typeof window.a2wBiUpdateSaveStateBadge !== 'function') return;
    window.__fdBiBadgePatched = true;
    var orig = window.a2wBiUpdateSaveStateBadge;
    window.a2wBiUpdateSaveStateBadge = function (stateLabel, modeClass, title) {
      orig(formatBadgeLabel(stateLabel), modeClass, title);
    };
  }

  function patchDeleteTypingHandler() {
    var confirmInput = document.getElementById('a2wDeleteBrandConfirmInput');
    var confirmBtn = document.getElementById('a2wDeleteBrandConfirmBtn');
    if (!confirmInput || !confirmBtn || confirmInput.dataset.fdTypingPatched === '1') return;
    confirmInput.dataset.fdTypingPatched = '1';

    var fresh = confirmInput.cloneNode(true);
    confirmInput.parentNode.replaceChild(fresh, confirmInput);
    if (document.getElementById('a2wDeleteBrandDialogHint')) {
      fresh.setAttribute('aria-describedby', 'a2wDeleteBrandDialogHint');
    }

    fresh.addEventListener('input', function () {
      var expected = '';
      if (typeof window.a2wBiCollectFormData === 'function') {
        try {
          expected = window.a2wBiCollectFormData().name || '';
        } catch (_) {}
      }
      confirmBtn.disabled = !isConfirmTypingMatch(fresh.value, expected);
    });
  }

  function patchLoadBrandIdentity() {
    if (window.__fdBiLoadPatched || typeof window.loadBrandIdentity !== 'function') return;
    window.__fdBiLoadPatched = true;
    var orig = window.loadBrandIdentity;
    window.loadBrandIdentity = async function () {
      await orig.apply(this, arguments);
      enhanceSocialSection();
      syncSocialToggleUi();
      patchDeleteTypingHandler();
    };
  }

  function initFdBrandIdentity() {
    if (!isFiloBiApp()) return;
    patchSaveStateBadge();
    patchLoadBrandIdentity();
    patchDeleteTypingHandler();
    enhanceSocialSection();
    if (typeof window.fdInitFormDirty === 'function') window.fdInitFormDirty();
  }

  window.fdEnhanceBrandIdentity = enhanceSocialSection;
  window.fdInitBrandIdentity = initFdBrandIdentity;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdBrandIdentity);
  } else {
    initFdBrandIdentity();
  }
})();
