/**
 * Filo HR — brand identity vs pass template: no duplicate pass fields on Identità brand.
 */
(function () {
  'use strict';

  function isFilo() {
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }

  function isHr() {
    return typeof isHrDashboard === 'function' && isHrDashboard();
  }

  function applyBrandIdentityScope() {
    if (!isFilo() || !isHr()) return;
    var page = document.querySelector('#brand-identity .a2w-bi-page');
    if (!page) return;

    var layout = page.querySelector('.a2w-bi-layout');
    if (layout) layout.classList.add('a2w-bi-layout--brand-only');

    var taglineGroup = document.getElementById('biTagline');
    if (taglineGroup && taglineGroup.closest('.form-group')) {
      taglineGroup.closest('.form-group').classList.add('a2w-bi-field--pass-only');
    }

    page.querySelectorAll('.a2w-bi-section').forEach(function (section) {
      var h2 = section.querySelector('.a2w-bi-section__head h2');
      if (h2 && /logo e immagini/i.test(h2.textContent || '')) {
        section.classList.add('a2w-bi-section--pass-assets');
      }
    });

    var subtitle = page.querySelector('.a2w-bi-subtitle');
    if (subtitle) {
      subtitle.textContent =
        'Nome, slug, lingua e contatti aziendali. Logo, strip e testi del pass si configurano in Template Pass.';
    }

    if (!page.querySelector('.fd-brand-scope-hint')) {
      var hint = document.createElement('p');
      hint.className = 'fd-brand-scope-hint';
      hint.innerHTML =
        'Le immagini e i testi del pass dipendente non si impostano qui. Vai su ' +
        '<a href="#" data-fd-nav="templates">Template Pass</a> per layout, strip, logo pass e header.';
      hint.querySelector('a')?.addEventListener('click', function (e) {
        e.preventDefault();
        if (typeof nav === 'function') nav('templates');
      });
      var header = page.querySelector('.a2w-bi-header');
      if (header && header.nextElementSibling) {
        header.parentNode.insertBefore(hint, header.nextElementSibling);
      } else if (header) {
        header.after(hint);
      }
    }

    var contactsHead = page.querySelector('.a2w-bi-section .a2w-bi-section__head p');
    page.querySelectorAll('.a2w-bi-section').forEach(function (section) {
      var h2 = section.querySelector('h2');
      if (h2 && /contatti pubblici/i.test(h2.textContent || '')) {
        var p = section.querySelector('.a2w-bi-section__head p');
        if (p) {
          p.textContent =
            'Contatti HR e aziendali usati su landing, comunicazioni e retro del pass (se il template non li sovrascrive).';
        }
      }
    });
  }

  function applyTemplateScope() {
    if (!isFilo() || !isHr()) return;
    var editor = document.getElementById('hrPassBackEditor');
    if (!editor) return;
    var modal = document.getElementById('templateModal');
    if (modal && !modal.querySelector('.fd-template-brand-contacts-note')) {
      var note = document.createElement('p');
      note.className = 'fd-template-brand-contacts-note';
      note.textContent =
        'People Operations, DPO ed emergenze si gestiscono in Identità Brand. Qui configuri solo link fisso e contenuti specifici del pass.';
      if (editor.parentNode) editor.parentNode.insertBefore(note, editor);
    }
  }

  function boot() {
    applyBrandIdentityScope();
    applyTemplateScope();
  }

  function wrapTemplateHooks() {
    var origNav = window.nav;
    if (typeof origNav === 'function' && !window.__fdBrandScopeNav) {
      window.__fdBrandScopeNav = true;
      window.nav = function fdBrandScopeNav(id) {
        var p = origNav.apply(this, arguments);
        if (p && typeof p.then === 'function') {
          return p.then(function () {
            if (id === 'brand-identity' || id === 'templates') boot();
          });
        }
        if (id === 'brand-identity' || id === 'templates') setTimeout(boot, 0);
        return p;
      };
    }

    var origOpen = window.openTemplateModal;
    if (typeof origOpen === 'function' && !window.__fdBrandScopeTpl) {
      window.__fdBrandScopeTpl = true;
      window.openTemplateModal = function () {
        var r = origOpen.apply(this, arguments);
        if (r && typeof r.then === 'function') return r.then(function () { applyTemplateScope(); });
        setTimeout(applyTemplateScope, 0);
        return r;
      };
    }

    var origEdit = window.editTemplate;
    if (typeof origEdit === 'function' && !window.__fdBrandScopeEditTpl) {
      window.__fdBrandScopeEditTpl = true;
      window.editTemplate = function () {
        var r = origEdit.apply(this, arguments);
        if (r && typeof r.then === 'function') return r.then(function () { applyTemplateScope(); });
        setTimeout(applyTemplateScope, 0);
        return r;
      };
    }
  }

  function bootAll() {
    boot();
    wrapTemplateHooks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAll);
  } else {
    bootAll();
  }
  window.addEventListener('load', bootAll);
})();
