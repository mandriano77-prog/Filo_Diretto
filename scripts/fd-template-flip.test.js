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

test('index.html template editor supports removing pass images', () => {
  const html = read('src/dashboard/index.html');
  assert.match(html, /function clearTplImage/);
  assert.match(html, /persistTemplateImageRemovals/);
  assert.match(html, /tplImgRemove_thumbnail/);
  assert.match(html, /images\/\$\{imgType\}/);
  assert.doesNotMatch(html, /tplStripPromoSelect/);
  assert.match(html, /saveTemplateFromBtn/);
  assert.match(html, /fd-tpl-file/);
  assert.match(html, /fd-tpl-img-toolbar/);
  assert.match(html, /if \(bgRow\) bgRow\.style\.display = ''/);
});

test('index.html HR pass preview includes consolidated back sections', () => {
  const html = read('src/dashboard/index.html');
  assert.match(html, /function previewHubUrl\(\)/);
  assert.match(html, /TOKEN_AUTOMATICO/);
  assert.match(html, /addBackLink\('HUB DIPENDENTE', previewHubUrl\(\), 'DEAL · PGA · COIN'\)/);
  assert.match(html, /biSupportEmail/);
  assert.match(html, /pp-back-field-label">SUPPORT</);
  assert.match(html, /addBackLink\('AREA RISERVATA'/);
  const hubIdx = html.indexOf("addBackLink('HUB DIPENDENTE', previewHubUrl(), 'DEAL · PGA · COIN')");
  const supportIdx = html.indexOf('pp-back-field-label">SUPPORT</div>');
  const portalIdx = html.indexOf("addBackLink('AREA RISERVATA'");
  assert.ok(hubIdx > -1 && supportIdx > hubIdx && portalIdx > supportIdx);
});
