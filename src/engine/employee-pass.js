/**
 * Unified employee_pass data model + cross-wallet serializers (Apple / Google / Samsung).
 * Single source for Filo Diretto HR pass content parity.
 */

/** Canonical pass type in DB / API / UI for HR employee passes. */
const EMPLOYEE_PASS_TYPE = 'employee_pass';
/** Apple Wallet pass.json top-level key (implementation detail only). */
const APPLE_EMPLOYEE_PASS_STRUCTURE = 'storeCard';
/** Pass back link text — compact labels for Wallet (Deal / PGA / COIN). */
const HUB_EMPLOYEE_LINK_TEXT = 'DEAL · PGA · COIN';

const HR_BG_DEFAULT = '#8B5CF6';
const HR_LABEL_DEFAULT = '#A78BFA';
const HR_FG_DEFAULT = '#FFFFFF';

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseFieldValues(instance) {
  const raw = instance?.field_values;
  if (!raw) return {};
  if (typeof raw === 'object') return { ...raw };
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function resolveMemberProfile(memberRow, instance) {
  if (memberRow) {
    const first = memberRow.first_name || '';
    const last = memberRow.last_name || '';
    const fullName = [first, last].filter(Boolean).join(' ').trim() || memberRow.full_name || null;
    return {
      id: memberRow.id,
      full_name: fullName,
      employee_id: memberRow.employee_id || null,
      department: memberRow.department || null,
      office_location: memberRow.office_location || null,
      hire_date: memberRow.hire_date || null,
      manager_name: memberRow.manager_name || null,
      manager_email: memberRow.manager_email || null
    };
  }
  const fv = parseFieldValues(instance);
  const fullName = [fv.nome || fv.name, fv.cognome || fv.surname].filter(Boolean).join(' ').trim()
    || fv.display_name || fv.full_name
    || [fv.first_name, fv.last_name].filter(Boolean).join(' ').trim() || null;
  return {
    id: instance?.id || null,
    full_name: fullName || null,
    employee_id: fv.matricola || fv.badge_id || fv.employee_id || null,
    department: fv.department || fv.reparto || null,
    office_location: fv.office_location || fv.sede || null,
    hire_date: fv.hire_date || null,
    manager_name: fv.manager_name || null,
    manager_email: fv.manager_email || null
  };
}

function resolveVariableLink(instance, template, brandConfig = {}) {
  const now = new Date();
  if (instance?.dynamic_link_url) {
    const exp = instance.dynamic_link_expires_at ? new Date(instance.dynamic_link_expires_at) : null;
    if (!exp || exp > now) {
      return { label: instance.dynamic_link_label || 'AZIONE RICHIESTA', url: instance.dynamic_link_url };
    }
  }
  if (template?.back_fixed_link_url) {
    return { label: template.back_fixed_link_label || 'LINK UTILE', url: template.back_fixed_link_url };
  }
  const pushOut = brandConfig.pushLinkOut;
  if (pushOut?.url) return { label: pushOut.label || 'Scopri di più', url: pushOut.url };
  return null;
}

function parseJsonArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseColor(color) {
  const rgbMatch = String(color || '').match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (rgbMatch) {
    return { r: parseInt(rgbMatch[1], 10), g: parseInt(rgbMatch[2], 10), b: parseInt(rgbMatch[3], 10) };
  }
  let hex = String(color || '').replace('#', '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  return {
    r: parseInt(hex.substring(0, 2), 16) || 0,
    g: parseInt(hex.substring(2, 4), 16) || 0,
    b: parseInt(hex.substring(4, 6), 16) || 0
  };
}

function colorToRgbString(color) {
  if (!color) return null;
  if (String(color).trim().toLowerCase().startsWith('rgb')) return String(color).trim();
  const c = parseColor(color);
  return `rgb(${c.r}, ${c.g}, ${c.b})`;
}

function isCoinPassField(label, key) {
  const l = String(label || '').trim().toUpperCase();
  const k = String(key || '').trim().toLowerCase();
  return k === 'coin_balance' || k === 'coin' || l === 'COIN' || /^COIN\b/.test(l);
}

function buildAnnouncementAuxField(brandConfig) {
  const ann = brandConfig?.pushAnnouncement;
  if (!ann || !ann.message) return null;
  const title = String(ann.title || 'NOVITA').trim().toUpperCase().slice(0, 30) || 'NOVITA';
  const ts = Number(ann.ts || Date.now());
  // Make value unique per push while keeping visible text stable.
  const marker = '\u200B'.repeat((ts % 10) + 1);
  const value = String(ann.message || '').trim().slice(0, 30);
  if (!value) return null;
  return {
    key: 'announcement',
    label: title,
    value: value + marker,
    changeMessage: '%@'
  };
}

function rgbToHex(color) {
  if (!color) return HR_BG_DEFAULT;
  if (String(color).startsWith('#')) return String(color);
  const c = parseColor(color);
  return `#${[c.r, c.g, c.b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function isLegacyGreenPassAccent(color) {
  if (!color) return false;
  const normalized = String(color).trim().toLowerCase().replace(/\s/g, '');
  const legacy = [
    '#00d4aa', '#00d4a9', '#3cdfff', '#d4e600',
    'rgb(0,212,170)', 'rgb(0,212,169)', 'rgb(60,223,255)', 'rgb(212,230,0)'
  ];
  if (legacy.includes(normalized)) return true;
  const c = parseColor(color);
  if (c.g > 150 && c.r < 100 && c.b >= 100 && c.b <= 220) return true;
  if (c.r > 180 && c.g > 200 && c.b < 100) return true;
  return false;
}

function resolveEmployeePassColors(template, brandConfig) {
  const line = String(brandConfig?.product_line || '').toLowerCase();
  const fgHex = brandConfig?.foregroundColor || null;
  const defaultForeground = template?.style?.foregroundColor || HR_FG_DEFAULT;
  let foregroundColor = fgHex && !isLegacyGreenPassAccent(fgHex)
    ? colorToRgbString(fgHex)
    : (isLegacyGreenPassAccent(defaultForeground) ? HR_FG_DEFAULT : colorToRgbString(defaultForeground) || HR_FG_DEFAULT);
  if (line === 'hr') foregroundColor = colorToRgbString(HR_FG_DEFAULT);

  const bgHex = brandConfig?.backgroundColor || template?.style?.backgroundColor || null;
  const backgroundColor = bgHex
    ? colorToRgbString(bgHex)
    : (line === 'hr' ? colorToRgbString(HR_BG_DEFAULT) : 'rgb(13, 11, 26)');

  const lblHex = brandConfig?.labelColor || template?.style?.labelColor || null;
  let labelColor = foregroundColor;
  if (line === 'hr') {
    labelColor = colorToRgbString(
      lblHex && !isLegacyGreenPassAccent(lblHex) ? lblHex : HR_LABEL_DEFAULT
    );
  } else if (lblHex && !isLegacyGreenPassAccent(lblHex)) {
    labelColor = colorToRgbString(lblHex);
  }

  return {
    foregroundColor,
    backgroundColor,
    labelColor,
    hexBackgroundColor: rgbToHex(backgroundColor)
  };
}

function makeHrLinkField(key, label, url, linkText) {
  const safeLabel = escapeHtml(label);
  const safeUrl = escapeHtml(url);
  const displayHost = url.replace(/^https?:\/\//i, '');
  const renderedText = String(linkText || '').trim() || safeLabel || escapeHtml(displayHost);
  return {
    key,
    label: String(label || '').toUpperCase().slice(0, 64),
    value: url,
    attributedValue: `<a href="${safeUrl}">${renderedText}</a>`
  };
}

/** Template-level HR retro fields with brand fallback (per-template config). */
function resolveHrBackSource(template, brand) {
  const tplRes = parseJsonArray(template?.back_resources);
  const tplDocs = parseJsonArray(template?.back_documents);
  const brandRes = parseJsonArray(brand?.back_resources);
  const brandDocs = parseJsonArray(brand?.back_documents);
  return {
    hr_email: template?.hr_email ?? brand?.hr_email ?? null,
    hr_phone: template?.hr_phone ?? brand?.hr_phone ?? null,
    dpo_email: template?.dpo_email ?? brand?.dpo_email ?? null,
    emergency_phone: template?.emergency_phone ?? brand?.emergency_phone ?? null,
    back_resources: tplRes.length ? tplRes : brandRes,
    back_documents: tplDocs.length ? tplDocs : brandDocs
  };
}

function buildAnnouncementBackSection(brandConfig) {
  const ann = brandConfig?.pushAnnouncement;
  if (!ann || !ann.message) return null;
  const label = String(ann.title || 'NOVITA').trim().toUpperCase().slice(0, 64) || 'NOVITA';
  const body = String(ann.message || '').trim();
  if (!body) return null;
  return {
    kind: 'text',
    key: 'announcement_full',
    label,
    body
  };
}

function makeHrSupportField(key, label, emails) {
  const list = (emails || []).map((e) => String(e).trim()).filter(Boolean);
  if (!list.length) return null;
  const plainLines = list.join('\n');
  const attributedValue = list
    .map((email) => {
      const safeEmail = escapeHtml(email);
      return `<a href="mailto:${safeEmail}">${safeEmail}</a>`;
    })
    .join('<br/>');
  return {
    key,
    label: String(label || '').toUpperCase().slice(0, 64),
    value: plainLines.slice(0, 500),
    attributedValue
  };
}

/** Single SUPPORT block — label + stacked mailto links (same card area as HUB). */
function buildSupportBackSection(hrBack) {
  const emails = [];
  if (hrBack.hr_email) emails.push(String(hrBack.hr_email).trim());
  if (hrBack.dpo_email) emails.push(String(hrBack.dpo_email).trim());
  if (!emails.length) return null;

  return {
    kind: 'support',
    key: 'support',
    label: 'SUPPORT',
    body: emails.join('\n'),
    emails
  };
}

function buildBackSections({ brand, template, instance, member, brandConfig = {}, portalUrl = null, hubUrl = null }) {
  const sections = [];
  const hrBack = resolveHrBackSource(template, brand);

  // Promo teaser is on pass front (auxiliary) — back stays HUB / SUPPORT / AREA RISERVATA only.

  if (hubUrl) {
    sections.push({
      kind: 'link',
      key: 'hub_employee',
      label: 'HUB DIPENDENTE',
      url: hubUrl,
      linkText: HUB_EMPLOYEE_LINK_TEXT
    });
  }

  const support = buildSupportBackSection(hrBack);
  if (support) sections.push(support);

  if (portalUrl) {
    sections.push({
      kind: 'link',
      key: 'portal_profile',
      label: 'AREA RISERVATA',
      url: portalUrl,
      linkText: 'Apri profilo personale'
    });
  }

  return sections;
}

function walletImageUrls({ apiBase, brand, template }) {
  if (!apiBase) return {};
  const tplId = template?.id;
  const slug = brand?.slug;
  const urls = {};
  if (slug) urls.logo = `${apiBase}/brands/by-slug/${encodeURIComponent(slug)}/logo`;
  if (slug) urls.stripBrand = `${apiBase}/brands/by-slug/${encodeURIComponent(slug)}/strip`;
  if (tplId) {
    urls.stripTemplate = `${apiBase}/templates/${tplId}/wallet-image/strip`;
    urls.thumbnail = `${apiBase}/templates/${tplId}/wallet-image/thumbnail`;
    urls.background = `${apiBase}/templates/${tplId}/wallet-image/background`;
  }
  const tplImages = template?.style?.images || {};
  urls.strip = tplImages.strip && tplId ? urls.stripTemplate : urls.stripBrand;
  return urls;
}

/**
 * Build unified employee_pass from DB rows.
 */
function buildEmployeePass({ brand, template, instance, member, brandConfig, apiBase, portalUrl = null, hubUrl = null, pgaUrl = null, meUrl = null, coinBalance = null }) {
  const cfg = brandConfig || brand?.config || {};
  const profile = resolveMemberProfile(member, instance);
  const colors = resolveEmployeePassColors(template, cfg);
  const images = walletImageUrls({ apiBase, brand, template });
  const tplImages = template?.style?.images || {};

  // Front layout: strip on top; nome + reparto + COIN on secondary (matricola resta solo in DB/HR).
  const secondary = [];
  if (profile.full_name) {
    secondary.push({ key: 'name', label: 'DIPENDENTE', value: profile.full_name });
  }
  if (profile.department) {
    secondary.push({ key: 'reparto', label: 'REPARTO', value: String(profile.department).trim() });
  }
  const coinValue =
    coinBalance != null && Number.isFinite(Number(coinBalance))
      ? Math.max(0, Math.floor(Number(coinBalance)))
      : 0;
  secondary.push({
    key: 'coin_balance',
    label: 'COIN',
    value: String(coinValue),
    changeMessage: 'Hai %@ coin'
  });

  const auxiliary = [];
  const annField = buildAnnouncementAuxField(cfg);
  if (annField) auxiliary.push(annField);

  const backSections = buildBackSections({
    brand,
    template,
    instance,
    member,
    brandConfig: cfg,
    portalUrl,
    hubUrl
  });

  const primary = [];

  const barcodeValue = instance?.serial_number || '';

  return {
    member_id: member?.id || instance?.member_id || null,
    brand_id: brand?.id || null,
    pass_instance_id: instance?.id || null,
    serial_number: instance?.serial_number || null,
    brandName: brand?.name || '',
    headerHint: resolvePassHeaderHint(template, cfg),
    logoText: '',
    programName: (template?.name || brand?.name || '').slice(0, 64),
    templateName: template?.name || '',
    passType: EMPLOYEE_PASS_TYPE,
    profile,
    colors,
    images,
    hasTemplateImages: {
      strip: !!tplImages.strip,
      thumbnail: !!tplImages.thumbnail,
      background: !!tplImages.background,
      logo: !!tplImages.logo
    },
    front: { primary, secondary, auxiliary },
    backSections,
    barcode: { value: barcodeValue }
  };
}

function sectionsToAppleBackFields(sections) {
  return sections.map((s) => {
    if (s.kind === 'link') {
      if (s.doc) {
        const safeUrl = escapeHtml(s.url);
        return {
          key: s.key,
          label: String(s.label).toUpperCase().slice(0, 64),
          value: s.url,
          attributedValue: `<a href="${safeUrl}">Apri documento</a>`
        };
      }
      return makeHrLinkField(s.key, s.label, s.url, s.linkText);
    }
    if (s.kind === 'support') {
      return makeHrSupportField(s.key, s.label, s.emails || String(s.body || '').split('\n'));
    }
    return {
      key: s.key,
      label: String(s.label || '').toUpperCase().slice(0, 64),
      value: String(s.body || '').slice(0, 500)
    };
  });
}

function resolvePassHeaderHint(template, brandConfig) {
  const tplH = template?.fields?.headerFields?.[0];
  const brandH = brandConfig?.pass_header_hint;
  const label = String(tplH?.label ?? brandH?.label ?? '').trim();
  const value = String(tplH?.value ?? brandH?.value ?? '').trim();
  const key = String(tplH?.key ?? brandH?.key ?? '').trim();
  if (isCoinPassField(label, key)) return null;
  if (!label && !value) return null;
  return {
    key: 'info_hint',
    label: label.toUpperCase().slice(0, 64),
    value: value.slice(0, 64),
    textAlignment: 'PKTextAlignmentRight'
  };
}

/** Apple Wallet — pass.json storeCard slice (employee pass layout). */
function toApplePass(employeePass) {
  const passStructure = {
    headerFields: employeePass.headerHint ? [employeePass.headerHint] : [],
    primaryFields: employeePass.front.primary || [],
    secondaryFields: employeePass.front.secondary || [],
    auxiliaryFields: employeePass.front.auxiliary || []
  };
  if (employeePass.backSections?.length) {
    passStructure.backFields = sectionsToAppleBackFields(employeePass.backSections);
  }

  return {
    logoText: '',
    organizationName: employeePass.brandName,
    description: employeePass.templateName,
    foregroundColor: employeePass.colors.foregroundColor,
    backgroundColor: employeePass.colors.backgroundColor,
    labelColor: employeePass.colors.labelColor,
    passStructure,
    barcode: {
      format: 'PKBarcodeFormatQR',
      message: employeePass.barcode.value,
      messageEncoding: 'iso-8859-1'
    }
  };
}

function googleImageRef(uri, description) {
  if (!uri) return null;
  return {
    sourceUri: { uri },
    contentDescription: { defaultValue: { language: 'it', value: description || '' } }
  };
}

function buildGoogleFrontTextModules(employeePass) {
  const modules = [];
  if (employeePass.headerHint && (employeePass.headerHint.label || employeePass.headerHint.value)) {
    modules.push({
      id: 'header_hint',
      header: employeePass.headerHint.label || 'INFO',
      body: String(employeePass.headerHint.value || '').slice(0, 500)
    });
  }
  (employeePass.front.secondary || []).forEach((f, i) => {
    modules.push({
      id: `front_sec_${i}`,
      header: f.label,
      body: String(f.value).slice(0, 500)
    });
  });
  (employeePass.front.auxiliary || []).forEach((f, i) => {
    modules.push({
      id: `front_aux_${i}`,
      header: f.label,
      body: String(f.value).slice(0, 500)
    });
  });
  return modules;
}

/** Google Wallet — generic/loyalty class + object fragments */
function toGooglePass(employeePass, { passKind = 'generic' } = {}) {
  const textModulesData = [];
  const linksModuleData = { uris: [] };
  const hasFrontAnnouncement = (employeePass.front.auxiliary || []).some((f) => f.key === 'announcement');

  employeePass.backSections.forEach((s, idx) => {
    if (s.kind === 'link') {
      linksModuleData.uris.push({
        id: s.key || `link_${idx}`,
        uri: s.url,
        description: String(s.linkText || s.label || '').slice(0, 100)
      });
    } else if (s.kind === 'support' && Array.isArray(s.contacts)) {
      s.contacts.forEach((contact, contactIdx) => {
        linksModuleData.uris.push({
          id: `${s.key || 'support'}_${contactIdx}`,
          uri: `mailto:${contact.email}`,
          description: String(contact.label || 'Support').slice(0, 100)
        });
      });
      textModulesData.push({
        id: s.key || `text_${idx}`,
        header: s.label,
        body: String(s.body).slice(0, 500)
      });
    } else if (s.body && !(s.key === 'announcement_full' && hasFrontAnnouncement)) {
      textModulesData.push({
        id: s.key || `text_${idx}`,
        header: s.label,
        body: String(s.body).slice(0, 500)
      });
    }
  });

  const classPatch = {};
  const logoUri = employeePass.images.logo;
  const stripUri = employeePass.images.strip;
  const thumbUri = employeePass.images.thumbnail;

  if (passKind === 'loyalty') {
    if (logoUri) classPatch.programLogo = googleImageRef(logoUri, employeePass.brandName);
  } else {
    if (logoUri) classPatch.logo = googleImageRef(logoUri, employeePass.brandName);
    if (stripUri) classPatch.heroImage = googleImageRef(stripUri, 'Strip');
  }

  classPatch.hexBackgroundColor = employeePass.colors.hexBackgroundColor;
  if (!logoUri) {
    classPatch.programName = employeePass.programName;
  }

  const objectPatch = {
    hexBackgroundColor: employeePass.colors.hexBackgroundColor,
    barcode: {
      type: 'QR_CODE',
      value: employeePass.barcode.value
    },
    textModulesData: [...buildGoogleFrontTextModules(employeePass), ...textModulesData],
    linksModuleData
  };

  if (passKind === 'loyalty') {
    objectPatch.accountName = (employeePass.profile.full_name || 'Membro').slice(0, 64);
  } else {
    objectPatch.cardTitle = {
      defaultValue: {
        language: 'it',
        value: (employeePass.programName || employeePass.brandName || 'Pass dipendente').slice(0, 64)
      }
    };
    objectPatch.subheader = { defaultValue: { language: 'it', value: employeePass.brandName } };
    objectPatch.header = {
      defaultValue: { language: 'it', value: employeePass.profile.full_name || 'Membro' }
    };
    if (thumbUri && employeePass.hasTemplateImages.thumbnail) {
      objectPatch.mainImage = googleImageRef(thumbUri, 'Thumbnail');
    }
  }

  return { classPatch, objectPatch };
}

/** Samsung Wallet — loyalty card attributes (no dedicated thumbnail slot) */
function toSamsungPass(employeePass) {
  const contents = [];
  employeePass.backSections.forEach((s) => {
    if (s.kind === 'link') {
      contents.push({ title: s.label, content: s.url });
    } else if (s.kind === 'support') {
      contents.push({ title: s.label, content: s.body });
    } else if (s.body) {
      contents.push({ title: s.label, content: s.body });
    }
  });

  const links = employeePass.backSections.flatMap((s) => {
    if (s.kind === 'link') return [{ name: s.label, url: s.url }];
    if (s.kind === 'support' && Array.isArray(s.contacts)) {
      return s.contacts.map((c) => ({ name: c.label, url: `mailto:${c.email}` }));
    }
    return [];
  });

  const frontContents = [];
  (employeePass.front.secondary || []).forEach((f) => {
    frontContents.push({ title: f.label, content: f.value });
  });
  (employeePass.front.auxiliary || []).forEach((f) => {
    frontContents.push({ title: f.label, content: f.value });
  });

  return {
    title: (employeePass.profile.full_name || employeePass.brandName).slice(0, 64),
    cardSubTitle: 'Pass dipendente',
    providerName: employeePass.brandName.slice(0, 32),
    logoImage: employeePass.images.logo,
    bannerImage: employeePass.images.strip,
    bgColor: employeePass.colors.hexBackgroundColor,
    noticeDesc: [...frontContents, ...contents].length
      ? `<p>${[...frontContents, ...contents].map((c) => `${escapeHtml(c.title)}: ${escapeHtml(c.content)}`).join('<br>')}</p>`
      : `<p>${escapeHtml(employeePass.templateName)}</p>`,
    links,
    barcode: {
      type: 'qr',
      value: employeePass.barcode.value
    }
  };
}

function isHrEmployeePass(brand) {
  const line = String(brand?.config?.product_line || 'hr').toLowerCase();
  return line === 'hr';
}

module.exports = {
  EMPLOYEE_PASS_TYPE,
  APPLE_EMPLOYEE_PASS_STRUCTURE,
  HUB_EMPLOYEE_LINK_TEXT,
  buildEmployeePass,
  toApplePass,
  toGooglePass,
  toSamsungPass,
  isHrEmployeePass,
  resolveEmployeePassColors,
  walletImageUrls,
  buildBackSections,
  resolveHrBackSource,
  sectionsToAppleBackFields,
  resolveMemberProfile,
  resolveVariableLink,
  escapeHtml
};
