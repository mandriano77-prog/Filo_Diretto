/**
 * FD-DS FASE 3 — Responsive tables: scroll wrap + edge fade (≥768px), card rows (<768px).
 */
(function () {
  'use strict';

  var TABLE_SELECTOR = '.content .section .table:not(.import-preview-table)';
  var WRAP_SELECTOR = '.fd-table-wrap, .pass-table-wrap, .fd-users-table-wrap, .table-wrap';
  var enhanceTimer = null;
  var scrollFadeBound = false;

  function isFiloTablesApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }

  function headerLabel(th, index, total) {
    var text = String(th && th.textContent ? th.textContent : '').replace(/\s+/g, ' ').trim();
    if (!text && index === total - 1) return 'Azioni';
    return text || 'Campo ' + (index + 1);
  }

  function applyRowLabels(table) {
    var headers = Array.prototype.slice.call(table.querySelectorAll('thead th'));
    if (!headers.length) return;
    var labels = headers.map(function (th, i) {
      return headerLabel(th, i, headers.length);
    });
    var actionsIndex = labels.length - 1;

    table.querySelectorAll('tbody tr').forEach(function (tr) {
      if (
        tr.classList.contains('table-skeleton-row') ||
        tr.classList.contains('table-empty-row') ||
        tr.classList.contains('table-error-row')
      ) {
        tr.querySelectorAll('td').forEach(function (td) {
          td.classList.add('fd-table-card-full');
          td.removeAttribute('data-label');
        });
        return;
      }

      var cells = Array.prototype.slice.call(tr.querySelectorAll(':scope > td'));
      cells.forEach(function (td, i) {
        td.classList.remove('fd-table-card-full', 'fd-table-card-actions');
        if (td.colSpan > 1) {
          td.classList.add('fd-table-card-full');
          td.removeAttribute('data-label');
          return;
        }
        var label = labels[i] || '';
        td.setAttribute('data-label', label);
        if (i === actionsIndex || label === 'Azioni') {
          td.classList.add('fd-table-card-actions');
        }
      });
    });
  }

  function updateScrollFade(wrap) {
    if (!wrap) return;
    var scrollWidth = wrap.scrollWidth;
    var clientWidth = wrap.clientWidth;
    var scrollLeft = wrap.scrollLeft;
    var canScroll = scrollWidth > clientWidth + 2;
    wrap.classList.toggle('fd-table-wrap--scrollable', canScroll);
    wrap.classList.toggle('fd-table-wrap--at-start', !canScroll || scrollLeft <= 2);
    wrap.classList.toggle('fd-table-wrap--at-end', !canScroll || scrollLeft + clientWidth >= scrollWidth - 2);
  }

  function bindScrollFade(wrap) {
    if (!wrap || wrap.dataset.fdScrollFade === '1') return;
    wrap.dataset.fdScrollFade = '1';
    wrap.addEventListener(
      'scroll',
      function () {
        updateScrollFade(wrap);
      },
      { passive: true }
    );
    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function () {
        updateScrollFade(wrap);
      });
      ro.observe(wrap);
      var table = wrap.querySelector('table');
      if (table) ro.observe(table);
    }
    requestAnimationFrame(function () {
      updateScrollFade(wrap);
    });
  }

  function normalizeWrap(wrap) {
    if (!wrap) return wrap;
    wrap.classList.add('fd-table-wrap', 'fd-table-wrap--fade');
    if (!wrap.getAttribute('role')) wrap.setAttribute('role', 'region');
    if (!wrap.getAttribute('aria-label')) wrap.setAttribute('aria-label', 'Tabella scorrevole');
    wrap.dataset.fdTableWrap = '1';
    bindScrollFade(wrap);
    return wrap;
  }

  function wrapTable(table) {
    if (!table || table.closest('.modal, dialog')) return null;
    var existing = table.closest(WRAP_SELECTOR);
    if (existing) return normalizeWrap(existing);

    var wrap = document.createElement('div');
    wrap.className = 'fd-table-wrap fd-table-wrap--fade';
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
    normalizeWrap(wrap);
    return wrap;
  }

  function enhanceTable(table) {
    if (!table || table.closest('.modal, dialog')) return;
    wrapTable(table);
    table.classList.add('fd-table-cards');
    table.dataset.fdTableCards = '1';
    applyRowLabels(table);
  }

  function enhanceAllTables() {
    if (!isFiloTablesApp()) return;
    document.querySelectorAll(TABLE_SELECTOR).forEach(enhanceTable);
    document.querySelectorAll('#audiencesList .table').forEach(enhanceTable);
    document.querySelectorAll(WRAP_SELECTOR).forEach(normalizeWrap);
  }

  function scheduleEnhance() {
    if (enhanceTimer) clearTimeout(enhanceTimer);
    enhanceTimer = setTimeout(function () {
      enhanceTimer = null;
      enhanceAllTables();
    }, 40);
  }

  function bindGlobalScrollFadeRefresh() {
    if (scrollFadeBound) return;
    scrollFadeBound = true;
    window.addEventListener('resize', function () {
      document.querySelectorAll(WRAP_SELECTOR).forEach(updateScrollFade);
    });
  }

  function bindObserver() {
    var root = document.querySelector('.content');
    if (!root || root.dataset.fdTableObserver === '1') return;
    root.dataset.fdTableObserver = '1';
    var observer = new MutationObserver(scheduleEnhance);
    observer.observe(root, { childList: true, subtree: true });
  }

  function patchNav() {
    if (!isFiloTablesApp() || window.__fdTableNavPatched) return;
    if (typeof window.nav !== 'function') return;
    window.__fdTableNavPatched = true;
    var orig = window.nav;
    window.nav = function (id) {
      var out = orig.apply(this, arguments);
      scheduleEnhance();
      return out;
    };
  }

  function initFdResponsiveTables() {
    if (!isFiloTablesApp()) return;
    enhanceAllTables();
    bindObserver();
    bindGlobalScrollFadeRefresh();
    patchNav();
    window.addEventListener('resize', scheduleEnhance);
  }

  window.fdEnhanceResponsiveTables = enhanceAllTables;
  window.fdHeaderLabelForTable = headerLabel;
  window.fdWrapResponsiveTable = wrapTable;
  window.fdUpdateTableScrollFade = updateScrollFade;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdResponsiveTables);
  } else {
    initFdResponsiveTables();
  }
})();
