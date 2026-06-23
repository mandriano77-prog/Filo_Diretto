/**
 * FD-06 — FiloDiretto form dirty state (brand identity v2 + template save guard).
 */
(function () {
  'use strict';

  function isFiloFormDirtyApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }

  function isHrContext() {
    if (typeof window.isHrDashboard === 'function') return window.isHrDashboard();
    return false;
  }

  function isBrandIdentityActive() {
    var section = document.getElementById('brand-identity');
    return !!(section && section.classList.contains('active'));
  }

  function patchBrandIdentityV2Flag() {
    if (window.__fdBiV2Patched) return;
    window.__fdBiV2Patched = true;
    var orig = window.isA2wBrandIdentityV2Enabled;
    window.isA2wBrandIdentityV2Enabled = function () {
      if (isFiloFormDirtyApp()) return true;
      if (typeof orig === 'function') return orig();
      return false;
    };
  }

  var TPL_FIELD_IDS = [
    'tplName', 'tplDescription', 'tplHeaderLabel', 'tplHeaderValue',
    'tplSecLabel', 'tplSecValue', 'tplAuxLabel', 'tplAuxValue',
    'tplLink1Label', 'tplLink1Url', 'tplLink2Label', 'tplLink2Url',
    'tplLink3Label', 'tplLink3Url', 'tplRegolamento', 'tplContatti',
    'hrFixedLinkLabel', 'hrFixedLinkUrl'
  ];

  function serializeTemplateModalState() {
    var parts = [document.getElementById('templateEditId')?.value || ''];
    TPL_FIELD_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      parts.push(el ? el.value : '');
    });
    try {
      parts.push(String(window.tplWalletIconMediaId || ''));
    } catch (_) {}
    return parts.join('\u0001');
  }

  function ensureTemplateDirtyUi() {
    var modal = document.getElementById('templateModal');
    if (!modal) return null;
    var saveBtn = modal.querySelector('button[onclick*="saveTemplate"]');
    if (!saveBtn) return null;
    if (!saveBtn.id) saveBtn.id = 'fdTplSaveBtn';

    var bar = modal.querySelector('.fd-form-dirty-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'fd-form-dirty-bar';
      var badge = document.createElement('span');
      badge.className = 'fd-form-dirty-badge';
      badge.id = 'fdTplDirtyBadge';
      badge.textContent = 'Salvato';
      bar.appendChild(badge);
      saveBtn.parentNode.insertBefore(bar, saveBtn);
      bar.appendChild(saveBtn);
    }
    return {
      saveBtn: saveBtn,
      badge: document.getElementById('fdTplDirtyBadge')
    };
  }

  function syncTemplateDirtyState() {
    if (!isFiloFormDirtyApp() || !isHrContext()) return;
    if (isSectionReadOnly()) return;
    var ui = ensureTemplateDirtyUi();
    if (!ui) return;
    var dirty = serializeTemplateModalState() !== (window.__fdTplBaseline || '');
    ui.saveBtn.disabled = !dirty;
    if (!dirty) {
      ui.saveBtn.title = 'Nessuna modifica da salvare';
    } else {
      ui.saveBtn.removeAttribute('title');
    }
    if (ui.badge) {
      ui.badge.textContent = dirty ? 'Modifiche non salvate' : 'Salvato';
      ui.badge.classList.toggle('is-dirty', dirty);
    }
  }

  function resetTemplateBaseline() {
    window.__fdTplBaseline = serializeTemplateModalState();
    syncTemplateDirtyState();
  }

  function bindTemplateModalDirty() {
    var modal = document.getElementById('templateModal');
    if (!modal || modal.dataset.fdDirtyBound === '1') return;
    modal.dataset.fdDirtyBound = '1';
    modal.addEventListener('input', syncTemplateDirtyState);
    modal.addEventListener('change', syncTemplateDirtyState);
  }

  function patchTemplateFlows() {
    if (window.__fdTplDirtyPatched) return;
    window.__fdTplDirtyPatched = true;

    var origOpen = window.openTemplateModal;
    if (typeof origOpen === 'function') {
      window.openTemplateModal = async function () {
        await origOpen.apply(this, arguments);
        if (!isFiloFormDirtyApp()) return;
        bindTemplateModalDirty();
        resetTemplateBaseline();
      };
    }

    var origEdit = window.editTemplate;
    if (typeof origEdit === 'function') {
      window.editTemplate = async function () {
        await origEdit.apply(this, arguments);
        if (!isFiloFormDirtyApp()) return;
        bindTemplateModalDirty();
        resetTemplateBaseline();
      };
    }

    var origSave = window.saveTemplate;
    if (typeof origSave === 'function') {
      window.saveTemplate = async function () {
        await origSave.apply(this, arguments);
        if (!isFiloFormDirtyApp()) return;
        resetTemplateBaseline();
        if (typeof window.fdRefreshBrandChecklist === 'function') window.fdRefreshBrandChecklist();
      };
    }
  }

  var BI_SECTION_DEFS = {
    base: {
      key: 'base',
      selector: '#brand-identity .a2w-bi-section--base',
      fields: ['biName', 'biSlug', 'biTagline', 'biSettore', 'biLang']
    },
    contacts: {
      key: 'contacts',
      selector: '#brand-identity .a2w-bi-section--contacts',
      fields: ['biHomepage', 'biSupportEmail', 'biSupportPhone', 'biDpoEmail', 'biEmergencyPhone']
    },
    social: {
      key: 'social',
      selector: '#brand-identity .a2w-bi-section--social',
      fields: ['biSocialInstagram', 'biSocialFacebook', 'biSocialLinkedin', 'biSocialTiktok', 'biSocialX']
    }
  };

  var biSectionState = {
    base: { baseline: '', dirty: false, saving: false, lastSavedAt: null },
    contacts: { baseline: '', dirty: false, saving: false, lastSavedAt: null },
    social: { baseline: '', dirty: false, saving: false, lastSavedAt: null }
  };

  function isSectionReadOnly() {
    if (window.FdRbac && typeof window.FdRbac.isActiveSectionReadOnly === 'function') {
      return window.FdRbac.isActiveSectionReadOnly();
    }
    return document.body && document.body.classList.contains('fd-rbac-readonly');
  }

  function removeBottomSaveBar() {
    var bar = document.getElementById('fdBiStickyBar');
    if (bar) bar.remove();
    document.body.classList.remove('fd-bi-bottom-bar-visible');
    var section = document.getElementById('brand-identity');
    if (section) section.classList.remove('brand-identity--fd-bottom-save');
    var footer = document.getElementById('fdBiFormFooter');
    if (footer) footer.remove();
  }

  function hideGlobalBrandSaveChrome() {
    var headerActions = document.querySelector('#brand-identity .a2w-bi-header__actions');
    if (headerActions) {
      headerActions.hidden = true;
      headerActions.setAttribute('aria-hidden', 'true');
    }
    var saveBtn = document.getElementById('a2wBiSaveBtn');
    if (saveBtn) saveBtn.hidden = true;
    var badge = document.getElementById('a2wBiSaveStateBadge');
    if (badge) badge.hidden = true;
  }

  function serializeSectionFields(sectionKey) {
    var def = BI_SECTION_DEFS[sectionKey];
    if (!def || typeof window.a2wBiCollectFormData !== 'function') return '';
    var data = window.a2wBiCollectFormData();
    var map = {
      biName: data.name,
      biSlug: data.slug,
      biTagline: data.tagline,
      biSettore: data.settore,
      biLang: data.lang,
      biHomepage: data.homepage,
      biSupportEmail: data.supportEmail,
      biSupportPhone: data.supportPhone,
      biDpoEmail: data.dpoEmail,
      biEmergencyPhone: data.emergencyPhone,
      biSocialInstagram: data.socialInstagram,
      biSocialFacebook: data.socialFacebook,
      biSocialLinkedin: data.socialLinkedin,
      biSocialTiktok: data.socialTiktok,
      biSocialX: data.socialX
    };
    return def.fields.map(function (id) { return map[id] || ''; }).join('\u0001');
  }

  function resetSectionBaseline(sectionKey) {
    biSectionState[sectionKey].baseline = serializeSectionFields(sectionKey);
    biSectionState[sectionKey].dirty = false;
  }

  function resetAllSectionBaselines() {
    Object.keys(BI_SECTION_DEFS).forEach(resetSectionBaseline);
  }

  function syncSectionDirtyState(sectionKey) {
    var state = biSectionState[sectionKey];
    if (!state) return;
    state.dirty = serializeSectionFields(sectionKey) !== state.baseline;
  }

  function syncAllSectionDirtyState() {
    Object.keys(BI_SECTION_DEFS).forEach(function (key) {
      syncSectionDirtyState(key);
      syncSectionSaveUi(key);
    });
    syncGlobalDirtyFromSections();
  }

  function syncGlobalDirtyFromSections() {
    if (!window.brandIdentityState) return;
    var anyDirty = Object.keys(BI_SECTION_DEFS).some(function (key) {
      return biSectionState[key].dirty;
    });
    window.brandIdentityState.dirty = anyDirty;
  }

  function formatSectionSavedLabel(sectionKey) {
    var state = biSectionState[sectionKey];
    if (state.dirty) return 'Modifiche non salvate';
    if (state.saving) return 'Salvataggio…';
    if (state.lastSavedAt && typeof window.formatRelativeSavedLabel === 'function') {
      var rel = window.formatRelativeSavedLabel(state.lastSavedAt);
      if (rel && rel.label) return rel.label.indexOf('✓') >= 0 ? rel.label : rel.label + ' ✓';
    }
    if (state.lastSavedAt) return 'Salvato ✓';
    if (!window.brandId && sectionKey === 'base') return '';
    return 'Salvato ✓';
  }

  function sectionSaveDisabledReason(sectionKey) {
    var state = biSectionState[sectionKey];
    if (isSectionReadOnly()) return 'Sola lettura';
    if (state.saving) return 'Salvataggio in corso';
    if (!state.dirty) return 'Nessuna modifica da salvare';
    if (sectionKey !== 'base' && !window.brandId) return 'Salva prima le informazioni base';
    if (sectionKey === 'base' && window.brandIdentityState && window.brandIdentityState.slugChecking) {
      return 'Verifica slug in corso';
    }
    if (sectionKey === 'base' && window.brandIdentityState && window.brandIdentityState.slugAvailable === false) {
      return 'Slug non disponibile';
    }
    var errors = collectSectionErrors(sectionKey);
    var count = Object.keys(errors).length;
    if (count > 0) return count === 1 ? '1 campo da correggere' : count + ' campi da correggere';
    return '';
  }

  function collectSectionErrors(sectionKey) {
    if (typeof window.a2wBiValidate !== 'function' || typeof window.a2wBiCollectFormData !== 'function') {
      return {};
    }
    var def = BI_SECTION_DEFS[sectionKey];
    var allErrors = window.a2wBiValidate(window.a2wBiCollectFormData());
    var errors = {};
    def.fields.forEach(function (fieldId) {
      if (allErrors[fieldId]) errors[fieldId] = allErrors[fieldId];
    });
    if (sectionKey === 'base' || !window.brandId) {
      if (allErrors.biName) errors.biName = allErrors.biName;
      if (allErrors.biSlug) errors.biSlug = allErrors.biSlug;
    }
    return errors;
  }

  function syncSectionSaveUi(sectionKey) {
    var def = BI_SECTION_DEFS[sectionKey];
    if (!def) return;
    var bar = document.getElementById('fdBiSectionSave-' + sectionKey);
    if (!bar) return;
    var state = biSectionState[sectionKey];
    var btn = document.getElementById('fdBiSectionSaveBtn-' + sectionKey);
    var status = document.getElementById('fdBiSectionSaveStatus-' + sectionKey);
    var reason = sectionSaveDisabledReason(sectionKey);

    bar.classList.toggle('is-dirty', !!state.dirty && !state.saving);
    bar.classList.toggle('is-saving', !!state.saving);
    bar.classList.toggle('is-clean', !state.dirty && !state.saving);

    if (btn) {
      btn.disabled = !!reason;
      btn.textContent = state.saving ? 'Salvataggio…' : 'Salva';
      if (reason) btn.title = reason;
      else btn.removeAttribute('title');
    }
    if (status) {
      status.textContent = formatSectionSavedLabel(sectionKey);
      status.classList.toggle('is-dirty', !!state.dirty && !state.saving);
      status.classList.toggle('is-saving', !!state.saving);
      status.classList.toggle('is-clean', !state.dirty && !state.saving);
    }
  }

  function ensureSectionSaveBar(sectionKey) {
    var def = BI_SECTION_DEFS[sectionKey];
    var sectionEl = document.querySelector(def.selector);
    if (!sectionEl) return;
    var barId = 'fdBiSectionSave-' + sectionKey;
    if (document.getElementById(barId)) return;

    var bar = document.createElement('div');
    bar.id = barId;
    bar.className = 'fd-bi-section-save';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Salvataggio sezione');
    bar.innerHTML =
      '<span class="fd-bi-section-save__status is-clean" id="fdBiSectionSaveStatus-' + sectionKey + '" aria-live="polite"></span>' +
      '<button type="button" class="fd-btn fd-btn--secondary fd-btn--sm fd-bi-section-save__btn" ' +
      'id="fdBiSectionSaveBtn-' + sectionKey + '" data-fd-section-save="' + sectionKey + '" disabled>Salva</button>';
    var saveHost = sectionEl.querySelector('.fd-bi-section-body') || sectionEl;
    saveHost.appendChild(bar);

    document.getElementById('fdBiSectionSaveBtn-' + sectionKey).addEventListener('click', function () {
      saveBrandIdentitySection(sectionKey);
    });
    syncSectionSaveUi(sectionKey);
  }

  function ensureAllSectionSaveBars() {
    if (!isFiloFormDirtyApp() || !isBrandIdentityActive()) return;
    removeBottomSaveBar();
    hideGlobalBrandSaveChrome();
    Object.keys(BI_SECTION_DEFS).forEach(ensureSectionSaveBar);
    syncAllSectionDirtyState();
  }

  function buildBrandConfigFromForm(data) {
    var config = {
      settore: data.settore,
      homepage: data.homepage,
      language: data.lang,
      support: {
        email: data.supportEmail,
        phone: data.supportPhone
      },
      social: {
        instagram: data.socialInstagram,
        facebook: data.socialFacebook,
        linkedin: data.socialLinkedin,
        tiktok: data.socialTiktok,
        x: data.socialX
      }
    };
    if (typeof window.isBrandIdentityPassFieldsExcluded === 'function' && !window.isBrandIdentityPassFieldsExcluded()) {
      config.tagline = data.tagline;
    }
    return config;
  }

  async function saveBrandIdentitySection(sectionKey) {
    var state = biSectionState[sectionKey];
    if (!state || state.saving || !state.dirty || isSectionReadOnly()) return;
    if (sectionKey !== 'base' && !window.brandId) {
      if (typeof window.toast === 'function') window.toast('Salva prima le informazioni base');
      return;
    }

    var data = window.a2wBiCollectFormData();
    var errors = collectSectionErrors(sectionKey);
    if (typeof window.a2wBiClearErrors === 'function') window.a2wBiClearErrors();
    Object.keys(errors).forEach(function (fieldId) {
      if (window.brandIdentityState) window.brandIdentityState.touched[fieldId] = true;
      if (typeof window.a2wBiSetFieldError === 'function') {
        window.a2wBiSetFieldError(fieldId, errors[fieldId]);
      }
    });
    if (Object.keys(errors).length > 0) {
      syncSectionSaveUi(sectionKey);
      if (typeof window.toast === 'function') window.toast('Correggi i campi evidenziati');
      return;
    }

    if (sectionKey === 'base' && window.brandIdentityState && window.brandIdentityState.slugAvailable === false) {
      if (typeof window.a2wBiSetFieldError === 'function') {
        window.a2wBiSetFieldError('biSlug', 'Slug già in uso');
      }
      syncSectionSaveUi(sectionKey);
      return;
    }

    state.saving = true;
    if (window.brandIdentityState) window.brandIdentityState.saving = true;
    syncSectionSaveUi(sectionKey);

    try {
      var name = data.name;
      var slug = data.slug || (typeof window.a2wBiSlugify === 'function' ? window.a2wBiSlugify(name) : name);
      var config = buildBrandConfigFromForm(data);
      var hrScalars = (typeof window.isBrandIdentityPassFieldsExcluded === 'function' && window.isBrandIdentityPassFieldsExcluded()) ? {
        hr_email: data.supportEmail || null,
        hr_phone: data.supportPhone || null,
        dpo_email: data.dpoEmail || null,
        emergency_phone: data.emergencyPhone || null
      } : {};
      var assets = null;
      if (typeof window.isBrandIdentityPassFieldsExcluded === 'function' && !window.isBrandIdentityPassFieldsExcluded() && window.brandIdentityState) {
        assets = {
          logo: window.brandIdentityState.selectedAssets.logo?.id || null,
          wallet_icon: window.brandIdentityState.selectedAssets.wallet_icon?.id || null,
          strip: window.brandIdentityState.selectedAssets.strip?.id || null,
          thumbnail: window.brandIdentityState.selectedAssets.thumbnail?.id || null,
          background: window.brandIdentityState.selectedAssets.background?.id || null
        };
      }

      if (!window.brandId) {
        var productLine = typeof window.getLockedProductLine === 'function'
          ? window.getLockedProductLine()
          : (typeof window.getUnscopedDashboardProductLine === 'function' ? window.getUnscopedDashboardProductLine() : null);
        var fixedColors = window.BRAND_PASS_FIXED_COLORS || {
          backgroundColor: '#0D0B1A',
          foregroundColor: '#FFFFFF',
          labelColor: '#A78BFA'
        };
        var createConfig = Object.assign({}, fixedColors, config, {
          brand_identity_last_saved_at: new Date().toISOString(),
          product_line: productLine
        });
        if (assets) createConfig.brand_identity_assets = assets;
        var createRes = await fetch(window.API + '/brands', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.assign({ name: name, slug: slug, config: createConfig }, hrScalars))
        });
        var newBrand = await createRes.json().catch(function () { return {}; });
        if (!createRes.ok || !newBrand.id) {
          if (typeof window.a2wBiSetFieldError === 'function') {
            window.a2wBiSetFieldError('biSlug', 'Slug non disponibile o dati non validi');
          }
          if (typeof window.toast === 'function') window.toast('Errore creazione brand');
          return;
        }
        window.brandId = newBrand.id;
        if (typeof window.syncBrandUrl === 'function') window.syncBrandUrl();
        if (typeof window.toast === 'function') window.toast('Brand creato!');
        if (typeof window.loadBrands === 'function') await window.loadBrands();
      } else {
        var headers = typeof window.getAuthHeaders === 'function' ? window.getAuthHeaders() : {};
        var existing = await fetch(window.API + '/brands/' + window.brandId, { headers: headers }).then(function (r) { return r.json(); });
        var mergedConfig = Object.assign({}, existing.config || {}, config, {
          brand_identity_last_saved_at: new Date().toISOString()
        });
        if (assets) mergedConfig.brand_identity_assets = assets;
        var saveRes = await fetch(window.API + '/brands/' + window.brandId, {
          method: 'PUT',
          headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
          body: JSON.stringify(Object.assign({ name: name, slug: slug, config: mergedConfig }, hrScalars))
        });
        if (!saveRes.ok) {
          var err = await saveRes.json().catch(function () { return {}; });
          if (/slug|duplicate|unique/i.test(err.error || '')) {
            if (typeof window.a2wBiSetFieldError === 'function') {
              window.a2wBiSetFieldError('biSlug', 'Slug già in uso');
            }
          }
          throw new Error(err.error || 'Errore salvataggio identità');
        }
        if (typeof window.toast === 'function') window.toast('Sezione salvata');
      }

      state.lastSavedAt = Date.now();
      if (window.brandIdentityState) window.brandIdentityState.lastSavedAt = state.lastSavedAt;
      if (typeof window.applyBrandTheme === 'function') window.applyBrandTheme();
      if (typeof window.loadBrandIdentity === 'function') await window.loadBrandIdentity();
      if (typeof window.fdRefreshBrandChecklist === 'function') window.fdRefreshBrandChecklist();
    } catch (e) {
      if (typeof window.toast === 'function') window.toast(e.message || 'Errore salvataggio identità');
    } finally {
      state.saving = false;
      if (window.brandIdentityState) window.brandIdentityState.saving = false;
      syncAllSectionDirtyState();
    }
  }

  function patchBrandIdentitySaveUi() {
    if (window.__fdBiSectionSavePatched) return;
    window.__fdBiSectionSavePatched = true;
    removeBottomSaveBar();
    hideGlobalBrandSaveChrome();

    if (typeof window.a2wBiSyncDirtyState === 'function') {
      var origDirty = window.a2wBiSyncDirtyState;
      window.a2wBiSyncDirtyState = function () {
        origDirty.apply(this, arguments);
        syncAllSectionDirtyState();
      };
    }

    if (typeof window.loadBrandIdentity === 'function' && !window.__fdBiSectionLoadPatched) {
      window.__fdBiSectionLoadPatched = true;
      var origLoad = window.loadBrandIdentity;
      window.loadBrandIdentity = async function () {
        await origLoad.apply(this, arguments);
        resetAllSectionBaselines();
        Object.keys(BI_SECTION_DEFS).forEach(function (key) {
          if (window.brandIdentityState && window.brandIdentityState.lastSavedAt) {
            biSectionState[key].lastSavedAt = window.brandIdentityState.lastSavedAt;
          }
        });
        ensureAllSectionSaveBars();
      };
    }
  }

  function patchNavForSectionSave() {
    if (window.__fdBiNavSectionPatched || typeof window.nav !== 'function') return;
    window.__fdBiNavSectionPatched = true;
    var orig = window.nav;
    window.nav = function (id) {
      var out = orig.apply(this, arguments);
      var done = function () {
        ensureAllSectionSaveBars();
      };
      if (out && typeof out.then === 'function') return out.then(done);
      setTimeout(done, 80);
      return out;
    };
  }

  function initFdFormDirty() {
    if (!isFiloFormDirtyApp()) return;
    patchBrandIdentityV2Flag();
    patchTemplateFlows();
    patchBrandIdentitySaveUi();
    patchNavForSectionSave();
    bindTemplateModalDirty();
    document.getElementById('brand-identity')?.classList.add('brand-identity--fd-dirty');
    removeBottomSaveBar();
    ensureAllSectionSaveBars();
  }

  window.fdInitFormDirty = initFdFormDirty;
  window.fdSyncBrandIdentitySectionSaves = ensureAllSectionSaveBars;
  window.saveBrandIdentitySection = saveBrandIdentitySection;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdFormDirty);
  } else {
    initFdFormDirty();
  }
})();
