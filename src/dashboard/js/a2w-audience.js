/**
 * Ads2Wallet — Audience page (KPI grid, tabs, campaign drill-down, segments).
 * Active only when isA2wDeploy() + a2w-shell.
 */
(function (global) {
  'use strict';

  const A2W = global.A2W = global.A2W || {};
  const { esc, createEl, appendChildren } = global.A2W.UI.utils;

  const WAI_SPARK_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M19 13l.75 2.25L22 16l-2.25.75L19 19l-.75-2.25L16 16l2.25-.75L19 13z"/></svg>';

  const state = {
    chromeReady: false,
    activeTab: 'overview',
    insightsCache: null,
    behaviorCache: null
  };

  function isEnabled() {
    if (typeof isA2wDeploy === 'function' && !isA2wDeploy()) return false;
    return document.documentElement.classList.contains('a2w-shell');
  }

  function getApiBase() {
    return typeof API !== 'undefined' ? API : '/api/v1';
  }

  function fetchAuthHeaders() {
    return typeof global.getAuthHeaders === 'function' ? global.getAuthHeaders() : {};
  }

  function toastMsg(msg) {
    if (typeof toast === 'function') toast(msg);
  }

  function createStat(label, value, tooltip) {
    if (global.A2W.UI && typeof global.A2W.UI.createStatCard === 'function') {
      return global.A2W.UI.createStatCard({ label: label, value: value, tooltip: tooltip });
    }
    const card = createEl('div', 'stat-card');
    card.innerHTML = '<div class="stat-num">' + esc(String(value)) + '</div><div class="stat-label">' + esc(label) + '</div>';
    return card;
  }

  function ensureChrome() {
    if (state.chromeReady) return;
    const section = document.getElementById('audiences');
    const host = document.getElementById('a2wAudienceChrome');
    if (!section || !host || !global.A2W.UI || !global.A2W.UI.createPageHeader) return;

    const legacyHeader = section.querySelector('.a2w-audience-legacy-header');
    if (legacyHeader) legacyHeader.hidden = true;

    const waiBtn = createEl('button', 'btn a2w-btn-primary', { type: 'button' });
    waiBtn.innerHTML = WAI_SPARK_SVG + ' <span>Segmenta con W.AI</span>';
    waiBtn.addEventListener('click', function () {
      if (typeof openWaiForAudience === 'function') openWaiForAudience();
    });

    host.appendChild(global.A2W.UI.createPageHeader({
      title: 'Audience',
      description: 'Segmenta i possessori dei pass, analizza comportamento e crea audience riusabili.',
      actions: waiBtn
    }));

    const tabs = createEl('div', 'a2w-audience-tabs', { role: 'tablist', 'aria-label': 'Sezioni audience' });
    [
      ['overview', 'Panoramica'],
      ['behavior', 'Comportamento'],
      ['saved', 'Audience salvate']
    ].forEach(function (pair, i) {
      const btn = createEl('button', 'a2w-audience-tabs__tab' + (i === 0 ? ' is-active' : ''), {
        type: 'button',
        role: 'tab',
        id: 'a2wAudTab_' + pair[0],
        'aria-selected': i === 0 ? 'true' : 'false',
        'aria-controls': 'audPanel_' + pair[0],
        text: pair[1]
      });
      btn.dataset.tab = pair[0];
      btn.addEventListener('click', function () { switchTab(pair[0]); });
      tabs.appendChild(btn);
    });
    host.appendChild(tabs);

    state.chromeReady = true;
  }

  function switchTab(tab) {
    state.activeTab = tab;
    ['overview', 'behavior', 'saved'].forEach(function (t) {
      const panel = document.getElementById('audPanel_' + t);
      if (panel) {
        if (t === tab) {
          panel.removeAttribute('hidden');
          panel.style.display = '';
        } else {
          panel.setAttribute('hidden', '');
          panel.style.display = 'none';
        }
      }
      const legacyBtn = document.getElementById('audTab_' + t);
      if (legacyBtn) {
        const on = t === tab;
        legacyBtn.classList.toggle('active', on);
        legacyBtn.setAttribute('aria-selected', on ? 'true' : 'false');
      }
      const a2wBtn = document.getElementById('a2wAudTab_' + t);
      if (a2wBtn) {
        const on = t === tab;
        a2wBtn.classList.toggle('is-active', on);
        a2wBtn.setAttribute('aria-selected', on ? 'true' : 'false');
      }
    });
    if (tab === 'behavior') loadBehavior();
    if (tab === 'saved') loadSavedList();
  }

  function retentionPct(insights) {
    const total = Number(insights.total_holders) || 0;
    const behavior = insights.behavior || state.behaviorCache || {};
    const active = Number(behavior.unique_holders_active) || 0;
    if (!total) return '—';
    return Math.round((active / total) * 100) + '%';
  }

  function renderOverviewKpis(insights) {
    const el = document.getElementById('audienceInsightsStats');
    if (!el) return;
    el.innerHTML = '';
    const cards = [
      ['Possessori pass', insights.total_holders ?? 0],
      ['Raggiungibili APNs', insights.apple_push_reachable ?? 0],
      ['Wallet installato', insights.installed_any_wallet ?? 0],
      ['Con email', insights.with_email ?? 0],
      ['Nuovi 7gg', insights.new_last_7_days ?? 0],
      ['Tasso retention 30gg', retentionPct(insights)]
    ];
    cards.forEach(function (c) {
      const tip = c[0] === 'Tasso retention 30gg'
        ? 'Possessori con eventi negli ultimi 30 giorni / totale possessori'
        : undefined;
      el.appendChild(createStat(c[0], c[1], tip));
    });
  }

  function renderCampaignList(camps, totalHolders) {
    const el = document.getElementById('audienceCampaignBreakdown');
    if (!el) return;
    const max = Math.max.apply(null, camps.map(function (c) { return Number(c.pass_count) || 0; }).concat([1]));
    const denom = totalHolders || max;

    if (!camps.length) {
      el.innerHTML = '<p class="a2w-audience-empty">Nessuna campagna con pass emessi.</p>';
      return;
    }

    el.innerHTML = '';
    camps.forEach(function (c) {
      const total = Number(c.pass_count) || 0;
      const apple = Number(c.apple_installs) || 0;
      const google = Number(c.google_installs) || 0;
      const pct = Math.min(100, Math.round((total / denom) * 100));

      const row = createEl('button', 'a2w-audience-campaign-row', {
        type: 'button',
        'aria-label': 'Filtra pass per campagna ' + (c.name || '')
      });
      row.addEventListener('click', function () {
        navToPassesByCampaign(c.id);
      });

      const name = createEl('span', 'a2w-audience-campaign-row__name', { text: c.name || 'Senza nome' });
      const counts = createEl('span', 'a2w-audience-campaign-row__counts', {
        text: total + ' total · ' + apple + ' Apple · ' + google + ' Google'
      });
      const bar = createEl('div', 'a2w-audience-campaign-row__bar');
      const fill = createEl('div', 'a2w-audience-campaign-row__bar-fill', { style: 'width:' + pct + '%' });
      bar.appendChild(fill);

      row.appendChild(name);
      row.appendChild(counts);
      row.appendChild(bar);
      el.appendChild(row);
    });
  }

  function renderHeatmapPlaceholder() {
    const grid = document.getElementById('audienceHeatmap');
    if (!grid) return;
    const days = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
    grid.innerHTML = '';
    grid.appendChild(createEl('span', 'a2w-audience-heatmap__label', { text: '' }));
    days.forEach(function (d) {
      grid.appendChild(createEl('span', 'a2w-audience-heatmap__label', { text: d }));
    });
    for (let h = 8; h <= 20; h += 2) {
      grid.appendChild(createEl('span', 'a2w-audience-heatmap__label', { text: h + ':00' }));
      for (let d = 0; d < 7; d++) {
        const intensity = 0.08 + (Math.sin(h + d) * 0.5 + 0.5) * 0.35;
        const cell = createEl('div', 'a2w-audience-heatmap__cell');
        cell.style.background = 'rgba(52, 211, 153, ' + intensity.toFixed(2) + ')';
        grid.appendChild(cell);
      }
    }
  }

  function renderHolderFunnel(insights, behavior) {
    const el = document.getElementById('audienceHolderFunnel');
    if (!el) return;
    const f = behavior.funnel || {};
    const issued = Number(insights.total_holders) || Number(f.created) || 0;
    const installed = Number(insights.installed_any_wallet) || Number(f.installed) || 0;
    const pushOn = Number(insights.apple_push_reachable) || 0;
    const clicks = Number(f.link_clicks) || Number(f.unique_clickers) || 0;

    const steps = [
      { label: 'Emesso', value: issued },
      { label: 'Installato', value: installed },
      { label: 'Push attiva', value: pushOn },
      { label: 'Click', value: clicks }
    ];

    el.innerHTML = '';
    steps.forEach(function (step, i) {
      if (i > 0) {
        const arrow = createEl('span', 'a2w-audience-funnel__arrow', { text: '→', 'aria-hidden': 'true' });
        el.appendChild(arrow);
      }
      const box = createEl('div', 'a2w-audience-funnel__step');
      const pct = issued > 0 ? Math.round((step.value / issued) * 100) : 0;
      box.appendChild(createEl('div', 'a2w-audience-funnel__step-value', { text: String(step.value) }));
      box.appendChild(createEl('div', 'a2w-audience-funnel__step-label', {
        text: step.label + (issued ? ' · ' + pct + '%' : '')
      }));
      el.appendChild(box);
    });
  }

  function renderTopLinks(links) {
    const el = document.getElementById('audienceTopLinks');
    if (!el) return;
    if (!links.length) {
      el.innerHTML = '<p class="a2w-audience-empty">Nessun click registrato nel periodo.</p>';
      return;
    }
    el.innerHTML = '';
    links.forEach(function (l) {
      const row = createEl('div', 'a2w-audience-link-row');
      const label = esc(l.target_label || l.target_key || 'Link');
      const url = (l.target_url || '').slice(0, 48);
      row.innerHTML = '<span>' + label + (url ? ' <span style="opacity:0.65;font-size:11px;">' + esc(url) + '</span>' : '') + '</span><strong>' + (l.clicks || 0) + '</strong>';
      el.appendChild(row);
    });
  }

  function summarizeRules(a) {
    if (a.description) return a.description;
    const r = a.rules || {};
    const parts = [];
    if (r.campaign_id) parts.push('Campagna');
    if (r.wallet && r.wallet !== 'any') parts.push('Wallet: ' + r.wallet);
    if (r.behavior) parts.push('Comportamento');
    if (a.query_spec) parts.push('W.AI');
    return parts.length ? parts.join(' · ') : 'Regole salvate';
  }

  function buildSegmentActionMenu(a) {
    if (!global.A2W.UI || !global.A2W.UI.createActionMenu) return null;
    const id = a.id;
    return global.A2W.UI.createActionMenu({
      label: 'Azioni segmento ' + (a.name || ''),
      items: [
        {
          icon: A2W.icons && A2W.icons.tag,
          label: 'Modifica',
          onClick: function () {
            if (typeof editAudience === 'function') editAudience(id);
          }
        },
        {
          icon: A2W.icons && A2W.icons.copy,
          label: 'Duplica',
          onClick: function () { duplicateAudience(id); }
        },
        {
          icon: A2W.icons && A2W.icons.install,
          label: 'Usa in push',
          onClick: function () {
            if (typeof useAudienceInPush === 'function') useAudienceInPush(id);
          }
        },
        {
          icon: A2W.icons && A2W.icons.download,
          label: 'Esporta',
          onClick: function () {
            if (typeof exportAudienceCsv === 'function') exportAudienceCsv(id);
          }
        },
        {
          icon: A2W.icons && A2W.icons.delete,
          label: 'Elimina',
          destructive: true,
          onClick: function () {
            if (typeof deleteAudienceItem === 'function') deleteAudienceItem(id);
          }
        }
      ]
    });
  }

  function renderSegments(list) {
    const el = document.getElementById('audiencesList');
    if (!el) return;

    if (!list.length) {
      if (typeof renderEmptyState === 'function') {
        el.innerHTML = renderEmptyState({
          title: 'Nessuna audience salvata',
          description: 'Crea segmenti manuali o salva i risultati da W.AI.',
          ctaLabel: 'Crea segmento manuale',
          ctaOnclick: 'openAudienceEditor()',
          icon: 'users'
        });
      } else {
        el.innerHTML = '<p class="a2w-audience-empty">Nessuna audience salvata.</p>';
      }
      return;
    }

    el.innerHTML = '';
    list.forEach(function (a) {
      const card = createEl('article', 'a2w-audience-segment-card');
      card.appendChild(createEl('div', 'a2w-audience-segment-card__name', { text: a.name || '' }));
      card.appendChild(createEl('div', 'a2w-audience-segment-card__summary', { text: summarizeRules(a) }));
      const updated = a.updated_at ? new Date(a.updated_at).toLocaleDateString('it-IT') : '—';
      card.appendChild(createEl('div', 'a2w-audience-segment-card__meta', {
        text: (a.member_count ?? '—') + ' possessori · agg. ' + updated
      }));
      const actions = createEl('div', 'a2w-audience-segment-card__actions');
      const menu = buildSegmentActionMenu(a);
      if (menu) actions.appendChild(menu);
      card.appendChild(actions);
      el.appendChild(card);
    });
  }

  function renderSavedToolbar() {
    if (document.getElementById('a2wAudienceSavedToolbar')) return;
    const el = document.getElementById('audiencesList');
    if (!el) return;
    const wrap = createEl('div', 'a2w-audience-saved-toolbar', { id: 'a2wAudienceSavedToolbar' });
    wrap.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:12px;';
    const cta = createEl('button', 'btn a2w-btn-primary', { type: 'button', text: 'Crea segmento manuale' });
    cta.addEventListener('click', function () {
      if (typeof openAudienceEditor === 'function') openAudienceEditor();
    });
    wrap.appendChild(cta);
    el.parentNode.insertBefore(wrap, el);
  }

  async function fetchInsights(days) {
    const q = days ? '?days=' + encodeURIComponent(days) : '';
    const res = await fetch(getApiBase() + '/brands/' + global.brandId + '/audiences/insights' + q, {
      headers: fetchAuthHeaders()
    });
    if (!res.ok) throw new Error('insights');
    return res.json();
  }

  async function loadBehavior() {
    if (!global.brandId) return;
    try {
      const days = document.getElementById('audBehaviorDays')?.value || 30;
      const data = await fetchInsights(days);
      state.behaviorCache = data.behavior || {};
      if (!state.insightsCache) state.insightsCache = data;
      renderHeatmapPlaceholder();
      renderHolderFunnel(state.insightsCache || data, state.behaviorCache);
      renderTopLinks((state.behaviorCache.top_link_clicks) || []);
      const note = document.getElementById('audienceHeatmapNote');
      if (note) {
        note.textContent = 'Dati orari non ancora esposti dall\'API — griglia dimostrativa. Periodo: ' + days + ' giorni.';
      }
    } catch (e) {
      console.error('A2W.audience.loadBehavior', e);
    }
  }

  async function loadSavedList() {
    if (!global.brandId) return;
    try {
      if (typeof loadPushAudienceSelect === 'function') await loadPushAudienceSelect();
      const res = await fetch(getApiBase() + '/brands/' + global.brandId + '/audiences', {
        headers: fetchAuthHeaders()
      });
      const list = res.ok ? await res.json() : [];
      global.audiencesCache = list;
      renderSavedToolbar();
      renderSegments(list);
    } catch (e) {
      console.error('A2W.audience.loadSavedList', e);
    }
  }

  async function load() {
    if (!isEnabled() || !global.brandId) return;
    ensureChrome();
    switchTab(state.activeTab);

    try {
      if (typeof loadPushAudienceSelect === 'function') await loadPushAudienceSelect();
      const insights = await fetchInsights(30);
      state.insightsCache = insights;
      state.behaviorCache = insights.behavior || null;
      renderOverviewKpis(insights);
      renderCampaignList(insights.by_campaign || [], insights.total_holders || 0);

      const listRes = await fetch(getApiBase() + '/brands/' + global.brandId + '/audiences', {
        headers: fetchAuthHeaders()
      });
      global.audiencesCache = listRes.ok ? await listRes.json() : [];
      if (state.activeTab === 'saved') {
        renderSavedToolbar();
        renderSegments(global.audiencesCache);
      }
      if (state.activeTab === 'behavior') loadBehavior();
    } catch (e) {
      console.error('A2W.audience.load', e);
      const kpi = document.getElementById('audienceInsightsStats');
      if (kpi) kpi.innerHTML = '<p class="a2w-audience-empty">Errore caricamento audience.</p>';
    }
  }

  function navToPassesByCampaign(campaignId) {
    if (!global.brandId || !campaignId) return;
    if (typeof applyPassCampaignFilter === 'function') {
      applyPassCampaignFilter(campaignId);
    }
    if (typeof nav === 'function') nav('passes');
  }

  async function duplicateAudience(id) {
    const a = (global.audiencesCache || []).find(function (x) { return x.id === id; });
    if (!a) return toastMsg('Audience non trovata');
    const name = (a.name || 'Audience') + ' (copia)';
    const body = {
      name: name,
      description: a.description || '',
      rules: a.rules || {}
    };
    if (a.query_spec) body.query_spec = a.query_spec;
    const res = await fetch(getApiBase() + '/brands/' + global.brandId + '/audiences', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, fetchAuthHeaders()),
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) return toastMsg(data.error || 'Duplicazione non riuscita');
    toastMsg('Segmento duplicato');
    loadSavedList();
    if (typeof loadPushAudienceSelect === 'function') loadPushAudienceSelect();
  }

  A2W.audience = {
    isEnabled: isEnabled,
    load: load,
    switchTab: switchTab,
    loadBehavior: loadBehavior,
    renderSegments: renderSegments,
    navToPassesByCampaign: navToPassesByCampaign,
    duplicateAudience: duplicateAudience
  };

  global.navToPassesByCampaign = navToPassesByCampaign;

  function init() {
    document.addEventListener('DOMContentLoaded', function () {
      if (isEnabled() && global.brandId && document.getElementById('audiences')?.classList.contains('active')) {
        ensureChrome();
      }
    });
  }

  init();
})(typeof window !== 'undefined' ? window : global);
