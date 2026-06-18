'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadResponsiveTables() {
  const g = {
    document: {
      documentElement: {
        classList: { contains: () => false },
        getAttribute: (k) => (k === 'data-app' ? 'filodiretto' : null)
      },
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener: () => {},
      createElement: (tag) => ({
        tagName: tag.toUpperCase(),
        className: '',
        dataset: {},
        classList: {
          add: function () {
            for (let i = 0; i < arguments.length; i++) {
              this.className += (this.className ? ' ' : '') + arguments[i];
            }
          },
          toggle: () => {}
        },
        setAttribute: function (k, v) {
          this[k] = v;
        },
        getAttribute: function (k) {
          return this[k] || null;
        },
        appendChild: function () {},
        addEventListener: () => {}
      })
    },
    __2WALLET_PRODUCT_LOCK__: 'hr',
    addEventListener: () => {},
    requestAnimationFrame: (fn) => fn()
  };
  g.window = g;
  const code = fs.readFileSync(path.join(__dirname, '../src/filodiretto/fd-responsive-tables.js'), 'utf8');
  vm.runInNewContext(code, g, { filename: 'fd-responsive-tables.js' });
  return g;
}

test('fdHeaderLabelForTable defaults empty last header to Azioni', () => {
  const g = loadResponsiveTables();
  assert.equal(g.fdHeaderLabelForTable({ textContent: 'Nome' }, 0, 4), 'Nome');
  assert.equal(g.fdHeaderLabelForTable({ textContent: '  ' }, 3, 4), 'Azioni');
});

test('fdWrapResponsiveTable wraps bare table in fd-table-wrap', () => {
  const parent = { child: null, wrap: null };
  const table = {
    closest: () => null,
    parentNode: {
      insertBefore(wrap) {
        parent.wrap = wrap;
        wrap.parentNode = this;
      }
    }
  };
  parent.wrap = null;
  const g = loadResponsiveTables();
  const wrap = g.fdWrapResponsiveTable(table);
  assert.ok(wrap);
  assert.match(wrap.className, /fd-table-wrap--fade/);
  assert.equal(wrap.dataset.fdTableWrap, '1');
});
