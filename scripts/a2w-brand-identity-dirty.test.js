'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'src/dashboard/index.html'), 'utf8');
const biCss = fs.readFileSync(path.join(root, 'src/dashboard/styles/a2w-brand-identity.css'), 'utf8');
const chromeCss = fs.readFileSync(path.join(root, 'src/dashboard/styles/a2w-chrome.css'), 'utf8');

test('brand identity traccia dirty state con baseline serializzato', () => {
  assert.match(indexHtml, /brandIdentityState\s*=\s*\{[\s\S]*dirty:\s*false[\s\S]*baseline:/);
  assert.match(indexHtml, /function a2wBiSerializeState\(/);
  assert.match(indexHtml, /brandIdentityState\.dirty = current !== brandIdentityState\.baseline/);
});

test('salva modifiche disabilitato quando pulito e abilitato solo se dirty', () => {
  assert.match(indexHtml, /function a2wBiRefreshSaveUi\(/);
  assert.match(indexHtml, /if \(brandIdentityState\.dirty\)/);
  assert.match(indexHtml, /btn\.disabled = false/);
  assert.match(indexHtml, /btn\.disabled = true[\s\S]*Nessuna modifica da salvare/);
});

test('badge riflette dirty, salvataggio e stato salvato relativo', () => {
  assert.match(indexHtml, /Modifiche non salvate/);
  assert.match(indexHtml, /Salvataggio…/);
  assert.match(indexHtml, /formatRelativeSavedLabel/);
  assert.match(indexHtml, /a2wBiStartSavedLabelTicker/);
  assert.match(indexHtml, /id="a2wBiSaveStateBadge"[^>]*aria-live="polite"/);
});

test('css distingue bottone salvataggio inattivo vs dirty attivo', () => {
  assert.match(biCss, /\.a2w-bi-save-btn:disabled:not\(\.is-saving\)/);
  assert.match(biCss, /\.a2w-bi-save-btn\.is-dirty:not\(:disabled\)/);
  assert.match(biCss, /--a2w-action-primary/);
});

test('brand identity senza riepilogo collassabile o anteprima pass wallet', () => {
  assert.doesNotMatch(indexHtml, /a2wBiSummaryDisclosure/);
  assert.doesNotMatch(indexHtml, /a2w-bi-summary-disclosure/);
  assert.doesNotMatch(indexHtml, /a2w-bi-preview-column/);
  assert.doesNotMatch(indexHtml, /a2w-bi-preview-tabs/);
  assert.doesNotMatch(indexHtml, /a2w-bi-pass-preview/);
  assert.doesNotMatch(biCss, /\.a2w-bi-summary-disclosure/);
  assert.doesNotMatch(biCss, /\.a2w-bi-pass-preview/);
});

test('brand identity layout: colonna unica con sezioni a griglia interna', () => {
  assert.doesNotMatch(indexHtml, /id="a2wBiPreviewMobileToggle"/);
  assert.match(biCss, /\.a2w-bi-layout[\s\S]*display:\s*block/);
  assert.match(biCss, /\.a2w-bi-layout[\s\S]*width:\s*100%/);
  assert.match(biCss, /\.a2w-bi-main[\s\S]*flex-direction:\s*column/);
  assert.match(biCss, /\.a2w-bi-main[\s\S]*width:\s*100%/);
  assert.match(biCss, /\.a2w-bi-section[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(biCss, /\.a2w-bi-section \.a2w-bi-section__head[\s\S]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(biCss, /\.a2w-bi-contact-grid/);
  assert.match(biCss, /max-width:\s*1400px/);
});

test('media library layout: griglia fluida a tutta larghezza', () => {
  assert.match(indexHtml, /class="a2w-media-page"/);
  assert.match(indexHtml, /class="a2w-media-buckets-grid"/);
  assert.match(chromeCss, /\.a2w-media-page[\s\S]*max-width:\s*1400px/);
  assert.match(chromeCss, /\.a2w-media-buckets-grid[\s\S]*repeat\(auto-fit,\s*minmax\(340px,\s*1fr\)\)/);
  assert.match(chromeCss, /\.a2w-media-buckets-grid[\s\S]*align-items:\s*start/);
  assert.match(chromeCss, /\.content[\s\S]*max-width:\s*none/);
});

test('brand identity asset slots: compact library picker senza upload inline', () => {
  assert.match(indexHtml, /a2w-bi-asset-slot/);
  assert.match(indexHtml, /Scegli da libreria/);
  assert.match(indexHtml, /a2wBiBindAssetSlotActions/);
  assert.doesNotMatch(indexHtml, /a2wBiAssetBrowseBtn/);
  assert.doesNotMatch(indexHtml, /a2wBiAssetUploadInput/);
  assert.doesNotMatch(indexHtml, /a2w-bi-asset-dropzone/);
  assert.doesNotMatch(indexHtml, /function a2wBiBindAssetDropzone/);
  assert.doesNotMatch(indexHtml, /function a2wBiUploadAsset/);
  assert.match(biCss, /\.a2w-bi-asset-slot/);
  assert.match(biCss, /\.a2w-bi-section \.a2w-bi-assets-grid[\s\S]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(indexHtml, /a2w-bi-section--assets/);
  assert.match(indexHtml, /Seleziona gli asset dalla Media Library/);
});

test('media library include bucket wallet_icon', () => {
  assert.match(indexHtml, /id="mediaWalletIconGrid"/);
  assert.match(indexHtml, /512×512 px/);
  assert.match(indexHtml, /data-type="wallet_icon"/);
  assert.match(indexHtml, /<option value="wallet_icon">Icona notifiche Wallet<\/option>/);
});
