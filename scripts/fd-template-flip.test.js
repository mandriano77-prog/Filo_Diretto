'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

test('fd-templates.js wires Filo HR template preview flip toggle', () => {
  const js = read('src/filodiretto/fd-templates.js');
  assert.match(js, /function setPreviewFace/);
  assert.match(js, /a2w-tpl-show-back/);
  assert.match(js, /initPreviewToggle/);
  assert.match(js, /patchTemplateModalFlip/);
  assert.match(js, /openTemplateModal.*editTemplate/s);
});

test('fd-templates.css applies flip transform for Filo template modal', () => {
  const css = read('src/filodiretto/fd-templates.css');
  assert.match(css, /html\[data-app='filodiretto'\] #templateModal \.pass-flip-container\.a2w-tpl-show-back \.pass-flip-inner/);
  assert.match(css, /rotateY\(180deg\)/);
});
