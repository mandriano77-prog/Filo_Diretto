const { buildPublicPathUrl } = require('./base-url');
const { parseBrandConfig } = require('./brand-privacy-url');

const MAX_PRIVACY_DOC_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['application/pdf', 'text/html', 'application/xhtml+xml']);

function escHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function customPrivacyDocPublicPath(slug, options = {}) {
  const safe = String(slug || '').trim();
  if (!safe) return '';
  return buildPublicPathUrl(`privacy-doc/${encodeURIComponent(safe)}`, options);
}

function getBrandPrivacyDocument(cfg) {
  const parsed = parseBrandConfig(cfg);
  const doc = parsed.privacy_document;
  if (!doc || typeof doc !== 'object') return null;
  const b64 = String(doc.content_base64 || '').trim();
  if (!b64) return null;
  return {
    content_base64: b64,
    mime_type: String(doc.mime_type || 'application/pdf').trim(),
    filename: String(doc.filename || 'informativa-privacy').trim(),
    uploaded_at: doc.uploaded_at || null,
    size_bytes: doc.size_bytes || Buffer.from(b64, 'base64').length
  };
}

function privacyDocumentMeta(cfg) {
  const doc = getBrandPrivacyDocument(cfg);
  if (!doc) return null;
  return {
    filename: doc.filename,
    mime_type: doc.mime_type,
    uploaded_at: doc.uploaded_at,
    size_bytes: doc.size_bytes
  };
}

function hasUploadedPrivacyDocument(cfg) {
  return !!getBrandPrivacyDocument(cfg);
}

function isDefaultPrivacyUrl(url, slug) {
  const value = String(url || '').trim();
  if (!value) return true;
  const slugPath = `/privacy/${String(slug || '').trim()}`;
  if (value === slugPath || value.endsWith(slugPath)) return true;
  const docPath = `/privacy-doc/${String(slug || '').trim()}`;
  if (value === docPath || value.endsWith(docPath)) return false;
  return false;
}

function decodeUploadBase64(raw) {
  let value = String(raw || '').trim();
  if (!value) return null;
  const comma = value.indexOf(',');
  if (value.startsWith('data:') && comma !== -1) value = value.slice(comma + 1);
  return value.replace(/\s/g, '');
}

function normalizePrivacyUpload({ content_base64, filename, mime_type }) {
  const b64 = decodeUploadBase64(content_base64);
  if (!b64) throw new Error('File non valido');
  let buffer;
  try {
    buffer = Buffer.from(b64, 'base64');
  } catch {
    throw new Error('File non valido');
  }
  if (!buffer.length) throw new Error('File vuoto');
  if (buffer.length > MAX_PRIVACY_DOC_BYTES) {
    throw new Error('Documento troppo grande (max 5 MB)');
  }

  const safeName = String(filename || 'informativa-privacy').trim() || 'informativa-privacy';
  const lower = safeName.toLowerCase();
  let mime = String(mime_type || '').trim().toLowerCase();
  if (!mime) {
    if (lower.endsWith('.pdf')) mime = 'application/pdf';
    else if (lower.endsWith('.html') || lower.endsWith('.htm')) mime = 'text/html';
  }
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error('Formato non supportato. Carica PDF o HTML.');
  }

  return {
    content_base64: b64,
    mime_type: mime,
    filename: safeName.replace(/[^\w.\-() ]+/g, '_').slice(0, 120),
    uploaded_at: new Date().toISOString(),
    size_bytes: buffer.length
  };
}

function buildPrivacyDocumentConfigUpdate(brand, uploadPayload) {
  const doc = normalizePrivacyUpload(uploadPayload);
  const slug = String(brand?.slug || '').trim();
  const config = { ...(parseBrandConfig(brand?.config) || {}) };
  config.privacy_document = doc;
  config.privacy_url = customPrivacyDocPublicPath(slug);
  return config;
}

function buildPrivacyDocumentRemovalConfig(brand) {
  const config = { ...(parseBrandConfig(brand?.config) || {}) };
  delete config.privacy_document;
  delete config.privacy_url;
  delete config.privacyUrl;
  return config;
}

function sanitizeBrandConfigForApi(config) {
  const parsed = parseBrandConfig(config);
  const next = { ...parsed };
  if (next.privacy_document?.content_base64) {
    next.privacy_document = privacyDocumentMeta(parsed);
  }
  return next;
}

function sanitizeBrandForApi(brand) {
  if (!brand || typeof brand !== 'object') return brand;
  return {
    ...brand,
    config: sanitizeBrandConfigForApi(brand.config)
  };
}

function servePrivacyDocumentResponse(res, brand) {
  const doc = getBrandPrivacyDocument(brand?.config);
  if (!doc) return res.status(404).send('Documento non trovato');
  const buffer = Buffer.from(doc.content_base64, 'base64');
  res.set('Content-Type', doc.mime_type);
  res.set('Cache-Control', 'public, max-age=300');
  const inline = doc.mime_type === 'text/html';
  const safeFilename = String(doc.filename || 'informativa-privacy').replace(/["\r\n]/g, '_');
  res.set(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename="${safeFilename}"`
  );
  return res.send(buffer);
}

module.exports = {
  MAX_PRIVACY_DOC_BYTES,
  customPrivacyDocPublicPath,
  getBrandPrivacyDocument,
  privacyDocumentMeta,
  hasUploadedPrivacyDocument,
  isDefaultPrivacyUrl,
  normalizePrivacyUpload,
  buildPrivacyDocumentConfigUpdate,
  buildPrivacyDocumentRemovalConfig,
  sanitizeBrandConfigForApi,
  sanitizeBrandForApi,
  servePrivacyDocumentResponse,
  escHtml
};
