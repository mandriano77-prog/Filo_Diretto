'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizePrivacyUpload,
  buildPrivacyDocumentConfigUpdate,
  buildPrivacyDocumentRemovalConfig,
  sanitizeBrandConfigForApi,
  customPrivacyDocPublicPath
} = require('../src/engine/brand-privacy-document');
const { resolveBrandPrivacyUrl } = require('../src/engine/brand-privacy-url');
const { buildDefaultPrivacyExportHtml } = require('../src/engine/privacy-default-export');

test('privacy upload stores document and public path', () => {
  const sample = Buffer.from('%PDF-1.4 sample').toString('base64');
  const brand = { slug: 'nti', config: {} };
  const config = buildPrivacyDocumentConfigUpdate(brand, {
    content_base64: sample,
    filename: 'informativa.pdf',
    mime_type: 'application/pdf'
  });
  assert.ok(config.privacy_document?.content_base64);
  assert.match(config.privacy_url, /privacy-doc\/nti/);
});

test('resolveBrandPrivacyUrl prefers uploaded document', () => {
  const brand = {
    slug: 'nti',
    config: {
      privacy_document: { content_base64: 'abc', mime_type: 'application/pdf', filename: 'x.pdf' }
    }
  };
  const url = resolveBrandPrivacyUrl(brand, { host: 'studio.example.com', protocol: 'https' });
  assert.match(url, /privacy-doc\/nti/);
});

test('sanitizeBrandConfigForApi strips document payload', () => {
  const cfg = sanitizeBrandConfigForApi({
    privacy_document: {
      content_base64: 'huge',
      filename: 'doc.pdf',
      mime_type: 'application/pdf',
      size_bytes: 4
    }
  });
  assert.equal(cfg.privacy_document.content_base64, undefined);
  assert.equal(cfg.privacy_document.filename, 'doc.pdf');
});

test('default privacy export includes brand name', () => {
  const html = buildDefaultPrivacyExportHtml({
    name: 'Nuova Telefonia Italiana',
    dpo_email: 'privacy@nti.it'
  });
  assert.match(html, /Nuova Telefonia Italiana/);
  assert.match(html, /privacy@nti\.it/);
});

test('removal clears custom privacy fields', () => {
  const cfg = buildPrivacyDocumentRemovalConfig({
    config: { privacy_url: '/privacy-doc/nti', privacy_document: { content_base64: 'x' } }
  });
  assert.equal(cfg.privacy_url, undefined);
  assert.equal(cfg.privacy_document, undefined);
});
