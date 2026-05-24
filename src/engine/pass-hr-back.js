/**
 * Filo Diretto — HR pass back fields (5 sections + dynamic link).
 */

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function isHrPassBrand(brand) {
  const line = String(brand?.config?.product_line || process.env.DASHBOARD_PRODUCT_LINE || '').toLowerCase();
  return line === 'hr';
}

/**
 * Virtual member from DB row or pass field_values (backward compatible).
 */
function resolveMemberProfile(memberRow, instance) {
  if (memberRow) {
    const first = memberRow.first_name || '';
    const last = memberRow.last_name || '';
    const fullName = [first, last].filter(Boolean).join(' ').trim()
      || memberRow.full_name
      || null;
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
    || fv.display_name
    || fv.full_name
    || [fv.first_name, fv.last_name].filter(Boolean).join(' ').trim()
    || null;

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
      return {
        label: instance.dynamic_link_label || 'AZIONE RICHIESTA',
        url: instance.dynamic_link_url
      };
    }
  }

  if (template?.back_fixed_link_url) {
    return {
      label: template.back_fixed_link_label || 'LINK UTILE',
      url: template.back_fixed_link_url
    };
  }

  // Transition: legacy brand-wide push link (Ads2Wallet)
  const pushOut = brandConfig.pushLinkOut;
  if (pushOut?.url) {
    return {
      label: pushOut.label || 'Scopri di più',
      url: pushOut.url
    };
  }

  return null;
}

function makeHrLinkField(key, label, url) {
  const safeLabel = escapeHtml(label);
  const safeUrl = escapeHtml(url);
  const displayHost = url.replace(/^https?:\/\//i, '');
  return {
    key,
    label: String(label || '').toUpperCase().slice(0, 64),
    value: url,
    attributedValue: `<a href="${safeUrl}">${safeLabel || escapeHtml(displayHost)}</a>`
  };
}

/**
 * Build ordered backFields for HR wallet passes.
 */
function buildHrBackFields({ brand, template, instance, member, brandConfig = {} }) {
  const profile = resolveMemberProfile(member, instance);
  const backFields = [];

  const variableLink = resolveVariableLink(instance, template, brandConfig);
  if (variableLink?.url) {
    backFields.push(makeHrLinkField('link_dynamic', variableLink.label, variableLink.url));
  }

  if (profile.full_name) {
    backFields.push({ key: 'name', label: 'DIPENDENTE', value: profile.full_name });
  }
  if (profile.employee_id) {
    backFields.push({ key: 'matricola', label: 'MATRICOLA', value: `#${profile.employee_id}` });
  }
  if (profile.department) {
    backFields.push({ key: 'reparto', label: 'REPARTO', value: profile.department });
  }
  if (profile.office_location) {
    backFields.push({ key: 'sede', label: 'SEDE', value: profile.office_location });
  }

  const activatedAt = instance?.activated_at || instance?.created_at;
  if (activatedAt) {
    backFields.push({
      key: 'active',
      label: 'ATTIVO DA',
      value: new Date(activatedAt).toLocaleDateString('it-IT', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    });
  }

  if (profile.manager_name) {
    const mgr = profile.manager_email
      ? `${profile.manager_name} · ${profile.manager_email}`
      : profile.manager_name;
    backFields.push({ key: 'manager', label: 'MANAGER DIRETTO', value: mgr });
  }

  if (brand?.hr_email) {
    backFields.push({ key: 'hr_email', label: 'PEOPLE OPERATIONS', value: brand.hr_email });
  }
  if (brand?.hr_phone) {
    backFields.push({ key: 'hr_phone', label: 'TELEFONO HR', value: brand.hr_phone });
  }
  if (brand?.dpo_email) {
    backFields.push({ key: 'dpo', label: 'PRIVACY / DPO', value: brand.dpo_email });
  }
  if (brand?.emergency_phone) {
    backFields.push({ key: 'emergency', label: 'EMERGENZE', value: brand.emergency_phone });
  }

  const resources = parseJsonArray(brand?.back_resources);
  resources.slice(0, 5).forEach((r, i) => {
    if (r?.label && r?.url) {
      backFields.push(makeHrLinkField(`resource_${i}`, r.label, r.url));
    }
  });

  const documents = parseJsonArray(brand?.back_documents);
  documents.slice(0, 5).forEach((d, i) => {
    if (d?.label && d?.url) {
      const safeUrl = escapeHtml(d.url);
      backFields.push({
        key: `doc_${i}`,
        label: String(d.label).toUpperCase().slice(0, 64),
        value: d.url,
        attributedValue: `<a href="${safeUrl}">Apri documento</a>`
      });
    }
  });

  // TODO: link portale dipendente passwordless quando /portal/?t=TOKEN sarà attivo in produzione HR

  return backFields;
}

function resolveEmployeeIdForBarcode(memberRow, instance) {
  const profile = resolveMemberProfile(memberRow, instance);
  return profile.employee_id || profile.id || instance?.id || '';
}

module.exports = {
  escapeHtml,
  isHrPassBrand,
  resolveMemberProfile,
  resolveVariableLink,
  buildHrBackFields,
  resolveEmployeeIdForBarcode
};
