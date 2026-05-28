/**
 * Filo HR — Media Library: layout semplificato (tutti i tipi asset, nessun campo nascosto).
 */
(function () {
  'use strict';

  var SECTION_META = {
    logo: {
      title: 'Logo',
      hint: 'PNG trasparente, max 320×100 px — usato nel pass e in landing.',
      uploadLabel: 'Carica logo'
    },
    wallet_icon: {
      title: 'Icona notifiche Wallet',
      hint: 'Quadrata 512×512 px — compare nelle push iPhone al posto del logo orizzontale.',
      uploadLabel: 'Carica icona'
    },
    strip: {
      title: 'Strip',
      hint: '750×246 px — banner in alto sul pass; puoi avere più varianti (default, promo, evento).',
      uploadLabel: 'Carica strip'
    },
    thumbnail: {
      title: 'Thumbnail',
      hint: '90×90 px — fronte pass su layout Event Ticket.',
      uploadLabel: 'Carica thumbnail'
    },
    background: {
      title: 'Background',
      hint: '360×440 px — sfondo intero su layout Event Ticket.',
      uploadLabel: 'Carica background'
    }
  };

  function isFiloMedia() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function ensureUploadTypeOption() {
    var sel = document.getElementById('mediaUploadType');
    if (!sel || sel.querySelector('option[value="wallet_icon"]')) return;
    var opt = document.createElement('option');
    opt.value = 'wallet_icon';
    opt.textContent = 'Icona notifiche Wallet';
    var stripOpt = sel.querySelector('option[value="strip"]');
    if (stripOpt && stripOpt.nextSibling) sel.insertBefore(opt, stripOpt.nextSibling);
    else sel.appendChild(opt);
  }

  function openUploadForType(type) {
    if (typeof window.openMediaUpload === 'function') {
      window.openMediaUpload();
    }
    var sel = document.getElementById('mediaUploadType');
    if (sel && type) {
      sel.value = type;
      if (typeof window.onMediaUploadTypeChange === 'function') window.onMediaUploadTypeChange();
    }
  }

  window.openMediaUploadForType = openUploadForType;

  function wrapSectionCard(card, type) {
    if (!card || card.dataset.fdMediaSection === '1') return;
    card.dataset.fdMediaSection = '1';
    card.dataset.mediaType = type;
    card.classList.add('fd-media-section');

    var meta = SECTION_META[type] || { title: type, hint: '', uploadLabel: 'Carica' };
    var oldTitle = card.querySelector('.sec-title');
    var oldHint = card.querySelector('p');
    var stripSearch = card.querySelector('#mediaStripSearch');

    var head = document.createElement('div');
    head.className = 'fd-media-section__head';
    head.innerHTML =
      '<div class="fd-media-section__copy">' +
      '<h2 class="fd-media-section__title">' + esc(meta.title) + '</h2>' +
      '<p class="fd-media-section__hint">' + esc(meta.hint) + '</p>' +
      '</div>' +
      '<div class="fd-media-section__actions">' +
      (stripSearch ? '' : '<button type="button" class="btn sec small fd-media-upload-type" data-upload-type="' + esc(type) + '">' + esc(meta.uploadLabel) + '</button>') +
      '</div>';

    if (stripSearch) {
      var actions = head.querySelector('.fd-media-section__actions');
      stripSearch.classList.add('fd-media-section__search');
      actions.appendChild(stripSearch);
      actions.insertAdjacentHTML(
        'beforeend',
        '<button type="button" class="btn sec small fd-media-upload-type" data-upload-type="strip">Carica strip</button>'
      );
    }

    if (oldTitle) oldTitle.remove();
    if (oldHint) oldHint.remove();

    var bodyHost = document.createElement('div');
    bodyHost.className = 'fd-media-section__body';
    while (card.firstChild) bodyHost.appendChild(card.firstChild);

    card.appendChild(head);
    card.appendChild(bodyHost);

    head.querySelectorAll('.fd-media-upload-type').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openUploadForType(btn.getAttribute('data-upload-type'));
      });
    });
  }

  function createWalletIconSection() {
    if (document.getElementById('mediaWalletIconGrid')) return null;
    var grid = document.querySelector('#media-library .fd-media-grid');
    if (!grid) return null;

    var card = document.createElement('div');
    card.className = 'card fd-media-section';
    card.dataset.mediaType = 'wallet_icon';
    card.innerHTML =
      '<div class="fd-media-section__head">' +
      '<div class="fd-media-section__copy">' +
      '<h2 class="fd-media-section__title">' + esc(SECTION_META.wallet_icon.title) + '</h2>' +
      '<p class="fd-media-section__hint">' + esc(SECTION_META.wallet_icon.hint) + '</p>' +
      '</div>' +
      '<div class="fd-media-section__actions">' +
      '<button type="button" class="btn sec small fd-media-upload-type" data-upload-type="wallet_icon">' + esc(SECTION_META.wallet_icon.uploadLabel) + '</button>' +
      '</div></div>' +
      '<div class="fd-media-section__body"><div id="mediaWalletIconGrid" class="strip-gallery"><p class="fd-media-empty">Caricamento…</p></div></div>';
    card.dataset.fdMediaSection = '1';

    var stripCard = grid.querySelector('[data-media-type="strip"]') || grid.children[1];
    if (stripCard) grid.insertBefore(card, stripCard);
    else grid.appendChild(card);

    card.querySelector('.fd-media-upload-type').addEventListener('click', function () {
      openUploadForType('wallet_icon');
    });
    return card;
  }

  function ensureMediaLayout() {
    var section = document.getElementById('media-library');
    if (!section || section.dataset.fdMediaLayout === '1') return;
    section.dataset.fdMediaLayout = '1';
    section.classList.add('media-library--fd-layout');

    var header = section.querySelector(':scope > div');
    if (header) {
      header.classList.add('fd-media-header');
      var h1 = header.querySelector('h1');
      var actions = header.querySelector(':scope > div');
      if (h1 && actions) {
        var copy = document.createElement('div');
        copy.className = 'fd-media-header__copy';
        copy.appendChild(h1);
        var lead = document.createElement('p');
        lead.className = 'fd-media-lead';
        lead.textContent =
          'Deposito immagini del brand e del pass. Scegli i file qui, poi assegnali in Template Pass o nelle push.';
        copy.appendChild(lead);
        header.insertBefore(copy, actions);
        actions.classList.add('fd-media-header__actions');
      }
    }

    var specsCard = section.querySelector(':scope > .card');
    if (specsCard && !specsCard.classList.contains('fd-media-specs')) {
      var details = document.createElement('details');
      details.className = 'fd-media-specs';
      details.innerHTML =
        '<summary>Specifiche tecniche consigliate</summary>' +
        '<div class="fd-media-specs__body">' +
        '<div><strong>Logo</strong> — PNG trasparente, max 320×100 px</div>' +
        '<div><strong>Icona Wallet</strong> — PNG quadrata 512×512 px</div>' +
        '<div><strong>Strip</strong> — PNG/JPG 750×246 px</div>' +
        '<div><strong>Thumbnail</strong> — PNG/JPG 90×90 px (Event Ticket)</div>' +
        '<div><strong>Background</strong> — PNG/JPG 360×440 px (Event Ticket)</div>' +
        '</div>';
      specsCard.replaceWith(details);
    }

    var grid = section.querySelector(':scope > div[style*="grid"]');
    if (grid) {
      grid.classList.add('fd-media-grid');
      grid.style.display = '';
      grid.style.gridTemplateColumns = '';
      var cards = grid.querySelectorAll(':scope > .card');
      if (cards[0]) wrapSectionCard(cards[0], 'logo');
      if (cards[1]) wrapSectionCard(cards[1], 'strip');
      if (cards[2]) wrapSectionCard(cards[2], 'thumbnail');
      if (cards[3]) wrapSectionCard(cards[3], 'background');
    }

    createWalletIconSection();

    if (!section.querySelector('.fd-media-link-template')) {
      var link = document.createElement('p');
      link.className = 'fd-media-link-template';
      link.innerHTML = 'Dopo il caricamento, assegna le immagini in <a href="#" data-fd-nav="templates">Template Pass</a>.';
      link.querySelector('a').addEventListener('click', function (e) {
        e.preventDefault();
        if (typeof window.nav === 'function') window.nav('templates');
      });
      section.appendChild(link);
    }

    ensureUploadTypeOption();
  }


  function patchLoadMediaLibrary() {
    if (window.__fdMediaLoadPatched || typeof window.loadMediaLibrary !== 'function') return;
    window.__fdMediaLoadPatched = true;
    var orig = window.loadMediaLibrary;
    window.loadMediaLibrary = async function () {
      ensureMediaLayout();
      await orig.apply(this, arguments);
      if (!isFiloMedia()) return;

      document.querySelectorAll('#media-library .media-card').forEach(function (card) {
        var img = card.querySelector('img');
        if (img && card.closest('#mediaWalletIconGrid')) card.classList.add('media-card--icon');
      });
      document.querySelectorAll('#media-library .media-card button[onclick*="deleteMediaItem"]').forEach(function (btn) {
        btn.className = 'btn small sec fd-btn-danger-outline fd-media-delete-btn';
        if (!btn.textContent.trim()) btn.textContent = 'Elimina';
      });
      document.querySelectorAll('#media-library .strip-gallery > p, #mediaLogoBox > p').forEach(function (p) {
        if (p.style.color) p.classList.add('fd-media-empty');
      });
    };
  }

  function boot() {
    if (!isFiloMedia()) return;
    ensureUploadTypeOption();
    patchLoadMediaLibrary();
    ensureMediaLayout();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  var origNav = window.nav;
  if (typeof origNav === 'function' && !window.__fdMediaNav) {
    window.__fdMediaNav = true;
    window.nav = function (id) {
      var r = origNav.apply(this, arguments);
      var done = function () {
        if (id === 'media-library') boot();
      };
      if (r && typeof r.then === 'function') return r.then(done);
      setTimeout(done, 0);
      return r;
    };
  }
})();
