/**
 * Ads2Wallet shell — JS injection for dark deploy only (studio.ads2wallet.com).
 * Filodiretto (data-shell=light) is never touched.
 */
(function () {
  'use strict';

  function isA2wDeploy() {
    if (typeof isFiloShell === 'function' && isFiloShell()) return false;
    try {
      const locked = typeof getLockedProductLine === 'function' ? getLockedProductLine() : null;
      if (locked) return locked === 'ads';
    } catch (_) {}
    const h = (window.location.hostname || '').toLowerCase();
    if (h.includes('ads2wallet')) return true;
    const pl = typeof getDashboardProductLine === 'function' ? getDashboardProductLine() : null;
    return pl === 'ads';
  }

  function isA2wActive() {
    return isA2wDeploy() && document.documentElement.classList.contains('a2w-shell');
  }

  // UX-AUDIT[a2w]: activate ads shell chrome once per session
  function initA2wShell() {
    if (!isA2wDeploy()) return;
    const root = document.documentElement;
    root.classList.add('a2w-shell');
    const line = typeof getDashboardProductLine === 'function' ? getDashboardProductLine() : 'ads';
    root.setAttribute('data-product-line', line);
    initA2wUserMenuChrome();
    syncA2wHeaderChrome();
    syncA2wWaiPadding();
  }

  function initA2wUserMenuChrome() {
    const meta = document.querySelector('.user-menu-meta');
    if (!meta || meta.querySelector('.a2w-user-divider')) return;
    const role = document.getElementById('dashboardUserRole');
    if (!role) return;
    const divider = document.createElement('span');
    divider.className = 'a2w-user-divider';
    divider.setAttribute('aria-hidden', 'true');
    meta.insertBefore(divider, role);
    role.classList.add('a2w-admin-badge');
  }

  // UX-AUDIT[a2w]: breadcrumb brand block with 48px logo + fallback initials
  function syncA2wHeaderChrome() {
    if (!document.documentElement.classList.contains('a2w-shell')) return;
    const brandSpan = document.getElementById('breadcrumbBrand');
    if (!brandSpan) return;

    let wrap = brandSpan.closest('.a2w-breadcrumb-brand-wrap');
    if (!wrap) {
      wrap = document.createElement('span');
      wrap.className = 'a2w-breadcrumb-brand-wrap';
      brandSpan.parentNode.insertBefore(wrap, brandSpan);
      wrap.appendChild(brandSpan);
    }

    let logoSlot = document.getElementById('a2wBreadcrumbLogo');
    let fallback = document.getElementById('a2wBreadcrumbLogoFallback');
    const srcLogo = document.getElementById('headerBrandLogo');
    const brandName = (brandSpan.textContent || '').trim();

    if (!logoSlot) {
      logoSlot = document.createElement('img');
      logoSlot.id = 'a2wBreadcrumbLogo';
      logoSlot.className = 'a2w-breadcrumb-logo';
      logoSlot.alt = '';
      wrap.insertBefore(logoSlot, brandSpan);
    }
    if (!fallback) {
      fallback = document.createElement('span');
      fallback.id = 'a2wBreadcrumbLogoFallback';
      fallback.className = 'a2w-breadcrumb-logo a2w-breadcrumb-logo--fallback';
      fallback.setAttribute('aria-hidden', 'true');
      wrap.insertBefore(fallback, brandSpan);
    }

    if (srcLogo && srcLogo.src && srcLogo.style.display !== 'none') {
      logoSlot.src = srcLogo.src;
      logoSlot.style.display = '';
      fallback.style.display = 'none';
    } else if (brandName) {
      logoSlot.style.display = 'none';
      const parts = brandName.split(/\s+/).filter(Boolean);
      fallback.textContent = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : brandName.slice(0, 2).toUpperCase();
      fallback.style.display = 'inline-flex';
    } else {
      logoSlot.style.display = 'none';
      fallback.style.display = 'none';
    }
  }

  function syncA2wWaiPadding() {
    const btn = document.getElementById('waiBtn');
    const visible = btn && btn.style.display !== 'none' && getComputedStyle(btn).display !== 'none';
    document.documentElement.classList.toggle('a2w-wai-visible', !!visible);
  }

  // UX-AUDIT[a2w]: inject Analytics layout (DOM only on ads shell)
  function ensureA2wAnalyticsLayout() {
    const section = document.getElementById('analytics');
    if (!section || section.dataset.a2wLayout === '1') return;
    section.dataset.a2wLayout = '1';
    section.classList.add('a2w-analytics-page');

    const h1 = section.querySelector('h1.page-title');
    if (h1) {
      const header = document.createElement('header');
      header.className = 'a2w-page-header';
      header.innerHTML = [
        '<div class="a2w-page-header__main">',
        '  <ol class="a2w-page-breadcrumb" aria-label="Percorso pagina"><li>Dashboard</li><li aria-current="page">Analytics</li></ol>',
        '  <h1 class="a2w-page-header__title">Analytics</h1>',
        '  <p class="a2w-page-header__desc">KPI pass, trend download/install e performance campagne.</p>',
        '</div>',
        '<div class="a2w-page-header__actions">',
        '  <button type="button" class="btn small sec" id="a2wExportReportBtn" aria-label="Esporta report trend in PNG">Esporta report</button>',
        '</div>'
      ].join('');
      h1.replaceWith(header);
      const exportBtn = document.getElementById('a2wExportReportBtn');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          if (typeof exportAnalyticsChart === 'function') exportAnalyticsChart('trend', 'png');
        });
      }
    }

    const stats = document.getElementById('analyticsStats');
    if (stats) stats.classList.add('a2w-stats-grid');

    const chartsRow = section.querySelector('.form-row');
    if (chartsRow) chartsRow.classList.add('a2w-charts-grid');

    const trendCard = section.querySelector('.a2w-charts-grid .card');
    const actions = trendCard && trendCard.querySelector('.analytics-actions');
    if (actions && !actions.dataset.a2wSplit) {
      actions.dataset.a2wSplit = '1';
      actions.classList.add('a2w-trend-toolbar');

      const rangeSel = document.getElementById('analyticsTrendRange');
      const fromEl = document.getElementById('analyticsDateFrom');
      const toEl = document.getElementById('analyticsDateTo');
      const bothBtn = document.getElementById('analyticsMetricBothBtn');
      const dlBtn = document.getElementById('analyticsMetricDownloadBtn');
      const inBtn = document.getElementById('analyticsMetricInstallBtn');
      const exportBtns = [...actions.querySelectorAll('button')].filter((b) => {
        const oc = b.getAttribute('onclick') || '';
        return oc.includes('exportAnalyticsChart');
      });

      actions.textContent = '';

      const datesWrap = document.createElement('div');
      datesWrap.className = 'a2w-date-range';
      const periodLabel = document.createElement('span');
      periodLabel.className = 'a2w-field-label';
      periodLabel.textContent = 'Periodo';
      datesWrap.appendChild(periodLabel);

      const periodRow = document.createElement('div');
      periodRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;';
      if (rangeSel) periodRow.appendChild(rangeSel);

      const fromWrap = document.createElement('div');
      fromWrap.className = 'a2w-date-field';
      const fromLbl = document.createElement('label');
      fromLbl.className = 'a2w-field-label';
      fromLbl.htmlFor = 'analyticsDateFrom';
      fromLbl.textContent = 'Da';
      fromWrap.append(fromLbl, fromEl);

      const toWrap = document.createElement('div');
      toWrap.className = 'a2w-date-field';
      const toLbl = document.createElement('label');
      toLbl.className = 'a2w-field-label';
      toLbl.htmlFor = 'analyticsDateTo';
      toLbl.textContent = 'A';
      toWrap.append(toLbl, toEl);

      periodRow.append(fromWrap, toWrap);
      datesWrap.appendChild(periodRow);

      const controlsRow = document.createElement('div');
      controlsRow.className = 'a2w-trend-controls-row';

      const metricGroup = document.createElement('div');
      metricGroup.className = 'a2w-control-group';
      const metricLabel = document.createElement('span');
      metricLabel.className = 'a2w-control-label';
      metricLabel.textContent = 'Metrica';
      const segmented = document.createElement('div');
      segmented.className = 'a2w-segmented';
      segmented.setAttribute('role', 'group');
      segmented.setAttribute('aria-label', 'Metrica trend');
      [bothBtn, dlBtn, inBtn].forEach((btn) => { if (btn) segmented.appendChild(btn); });
      metricGroup.append(metricLabel, segmented);

      const exportGroup = document.createElement('div');
      exportGroup.className = 'a2w-control-group a2w-export-group';
      const exportLabel = document.createElement('span');
      exportLabel.className = 'a2w-control-label';
      exportLabel.textContent = 'Esporta come';
      const exportRow = document.createElement('div');
      exportRow.className = 'a2w-export-buttons';
      exportBtns.forEach((btn) => exportRow.appendChild(btn));
      exportGroup.append(exportLabel, exportRow);

      controlsRow.append(metricGroup, exportGroup);
      actions.append(datesWrap, controlsRow);
    }

    section.querySelectorAll(':scope > .card').forEach((card) => {
      if (card.querySelector('#analyticsTopCampaigns')) {
        card.classList.add('a2w-top-campaigns-card');
      }
    });

    const perfTitle = [...section.querySelectorAll('.sec-title')].find((el) => el.textContent.includes('Performance'));
    if (perfTitle) perfTitle.classList.add('a2w-section-heading');

    const table = document.getElementById('campaignAnalyticsTable');
    if (table && !table.closest('.a2w-table-wrap')) {
      const wrap = document.createElement('div');
      wrap.className = 'a2w-table-wrap';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
      table.classList.add('a2w-campaign-table');
      const ths = table.querySelectorAll('thead th');
      if (ths[1]) ths[1].classList.add('a2w-num');
      if (ths[2]) ths[2].classList.add('a2w-num');
      if (ths[3]) ths[3].classList.add('a2w-num');
      if (ths[5]) ths[5].classList.add('a2w-col-status');
    }
  }

  function renderA2wAnalyticsStats(analytics, campaigns, allPasses) {
    const el = document.getElementById('analyticsStats');
    if (!el) return;

    const totalDL = campaigns.reduce((s, c) => s + (c.total_downloads || 0), 0);
    const totalIN = campaigns.reduce((s, c) => s + (c.total_installs || 0), 0);
    const desktopDownloads = allPasses.filter((p) => {
      const ua = String(p.user_agent || '').toLowerCase();
      if (!ua) return false;
      return !/(iphone|ipad|ipod|android)/i.test(ua);
    }).length;

    const appleDv = analytics.appleDeviceCount ?? analytics.deviceCount ?? 0;
    const gwSaved = analytics.googleWalletSavedCount ?? 0;
    const swSaved = analytics.samsungWalletSavedCount ?? 0;
    const activeCampaigns = campaigns.filter((c) => c.active).length;
    const pausedCampaigns = campaigns.length - activeCampaigns;

    const gwHint = `<div class="a2w-stat-meta">Android: pass con salvataggio confermato</div>`;
    const swHint = `<div class="a2w-stat-meta">Confermati tramite Samsung Wallet</div>`;
    const appleHint = `<div class="a2w-stat-meta">iPhone/iPad distinti con pass in Wallet</div>`;

  el.innerHTML = `
      <div class="stat-card"><div class="stat-label">Pass totali</div><div class="stat-value">${analytics.totalPasses || 0}</div></div>
      <div class="stat-card"><div class="stat-label">Download totali</div><div class="stat-value">${totalDL}</div></div>
      <div class="stat-card"><div class="stat-label">Install totali</div><div class="stat-value">${totalIN}</div></div>
      <div class="stat-card">
        <div class="stat-label">Download da desktop
          <button type="button" class="a2w-info-tip" aria-label="Info download desktop" title="Separati dai KPI wallet confermati">ℹ</button>
        </div>
        <div class="stat-value">${desktopDownloads}</div>
      </div>
      <div class="stat-card"><div class="stat-label">Apple · dispositivi PassKit</div><div class="stat-value">${appleDv}</div>${appleHint}</div>
      <div class="stat-card"><div class="stat-label">Google Wallet · pass salvati</div><div class="stat-value">${gwSaved}</div>${gwHint}</div>
      <div class="stat-card"><div class="stat-label">Samsung Wallet · pass salvati</div><div class="stat-value">${swSaved}</div>${swHint}</div>
      <div class="stat-card">
        <div class="stat-label">Campagne</div>
        <div class="stat-value">${campaigns.length}</div>
        <div class="a2w-stat-meta">${activeCampaigns} attiv${activeCampaigns === 1 ? 'a' : 'e'} · ${pausedCampaigns} in pausa</div>
      </div>
    `;
  }

  function renderA2wTrendChart(passes) {
    const el = document.getElementById('analyticsTrendChart');
    if (!el || typeof formatLocalYMD !== 'function') return;

    const from = typeof analyticsDateFrom !== 'undefined' && analyticsDateFrom ? analyticsDateFrom : null;
    const to = typeof analyticsDateTo !== 'undefined' && analyticsDateTo ? analyticsDateTo : null;
    let dayKeys;
    if (from && to && typeof listDaysBetween === 'function') {
      dayKeys = listDaysBetween(from, to);
    } else if (typeof getAnalyticsDateRange === 'function') {
      const range = getAnalyticsDateRange();
      dayKeys = listDaysBetween(range.from, range.to);
    } else {
      dayKeys = [];
    }

    const labels = dayKeys.map((k) => new Date(`${k}T00:00:00`).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }));
    const downloads = [];
    const installs = [];
    const byDay = new Map(dayKeys.map((k) => [k, { dl: 0, in: 0 }]));
    for (const p of passes) {
      if (p.created_at) {
        const k = formatLocalYMD(p.created_at);
        if (k && byDay.has(k)) byDay.get(k).dl += 1;
      }
      if (p.install_date) {
        const k = formatLocalYMD(p.install_date);
        if (k && byDay.has(k)) byDay.get(k).in += 1;
      }
    }
    for (const key of dayKeys) {
      downloads.push(byDay.get(key).dl);
      installs.push(byDay.get(key).in);
    }

    const metric = typeof analyticsTrendMetric !== 'undefined' ? analyticsTrendMetric : 'both';
    const activeDownload = metric === 'both' || metric === 'download';
    const activeInstall = metric === 'both' || metric === 'install';
    const activeValues = [];
    if (activeDownload) activeValues.push(...downloads);
    if (activeInstall) activeValues.push(...installs);
    const maxVal = Math.max(1, ...activeValues);

    const width = 900;
    const height = 280;
    const left = 40;
    const bottom = 36;
    const top = 20;
    const right = 16;
    const plotW = width - left - right;
    const plotH = height - bottom - top;
    const step = dayKeys.length > 1 ? plotW / (dayKeys.length - 1) : plotW;
    const point = (idx, val) => `${(left + idx * step).toFixed(2)},${(top + (plotH - (val / maxVal) * plotH)).toFixed(2)}`;
    const dlPath = downloads.map((v, i) => `${i === 0 ? 'M' : 'L'} ${point(i, v)}`).join(' ');
    const inPath = installs.map((v, i) => `${i === 0 ? 'M' : 'L'} ${point(i, v)}`).join(' ');
    const tickEvery = dayKeys.length > 14 ? 3 : 2;
    const xTicks = labels.filter((_, i) => i % tickEvery === 0).map((l, i) => {
      const idx = i * tickEvery;
      const x = left + idx * step;
      return `<text x="${x.toFixed(2)}" y="${height - 8}" font-size="11" fill="rgba(255,255,255,0.5)" text-anchor="middle">${l}</text>`;
    }).join('');
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((fr) => {
      const y = top + plotH - (plotH * fr);
      const value = Math.round(maxVal * fr);
      return `
        <line x1="${left}" y1="${y.toFixed(2)}" x2="${(left + plotW).toFixed(2)}" y2="${y.toFixed(2)}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3 3"></line>
        <text x="${(left - 8)}" y="${(y + 4).toFixed(2)}" font-size="11" fill="rgba(255,255,255,0.5)" text-anchor="end">${value}</text>
      `;
    }).join('');

    el.innerHTML = `
      <svg id="analyticsTrendSvg" viewBox="0 0 ${width} ${height}" width="100%" height="280" role="img" aria-label="Trend download e install">
        <defs>
          <linearGradient id="trendDlGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#34D399"></stop>
            <stop offset="100%" stop-color="#10B981"></stop>
          </linearGradient>
          <linearGradient id="trendInGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#60a5fa"></stop>
            <stop offset="100%" stop-color="#3b82f6"></stop>
          </linearGradient>
        </defs>
        <rect x="${left}" y="${top}" rx="12" ry="12" width="${plotW}" height="${plotH}" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)"></rect>
        ${yTicks}
        ${activeDownload ? `<path d="${dlPath}" fill="none" stroke="url(#trendDlGrad)" stroke-width="3" stroke-linecap="round"></path>` : ''}
        ${activeInstall ? `<path d="${inPath}" fill="none" stroke="url(#trendInGrad)" stroke-width="3" stroke-linecap="round"></path>` : ''}
        ${xTicks}
      </svg>
      <div style="display:flex;gap:16px;font-size:12px;color:rgba(255,255,255,0.6);margin-top:8px;padding-bottom:4px;">
        ${activeDownload ? '<span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;background:#34D399;border-radius:50%;display:inline-block;"></span>Download</span>' : ''}
        ${activeInstall ? '<span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;background:#3b82f6;border-radius:50%;display:inline-block;"></span>Install</span>' : ''}
      </div>
    `;
    if (typeof updateAnalyticsMetricButtons === 'function') updateAnalyticsMetricButtons();
  }

  function renderA2wWalletSplit(passes) {
    const el = document.getElementById('analyticsWalletSplit');
    if (!el) return;

    const installedList = passes.filter((p) => !!(p.device_id || (typeof passGoogleSaved === 'function' && passGoogleSaved(p)) || (typeof passSamsungSaved === 'function' && passSamsungSaved(p))));
    const totalInstalled = installedList.length;

    if (!totalInstalled) {
      el.innerHTML = '<div class="a2w-wallet-empty">Nessuna installazione ancora</div>';
      return;
    }

    let samsung = 0;
    let google = 0;
    let apple = 0;
    let other = 0;
    for (const p of installedList) {
      const k = typeof walletSplitPrimaryKind === 'function' ? walletSplitPrimaryKind(p) : 'other';
      if (k === 'samsung') samsung++;
      else if (k === 'google') google++;
      else if (k === 'apple') apple++;
      else other++;
    }
    const total = Math.max(1, apple + google + samsung + other);
    const seg = (v) => ((v / total) * 100).toFixed(1);
    const fmtCount = (n, pct) => (n === 0 ? 'Nessuna installazione ancora' : `<strong style="color:var(--text)">${n}</strong> (${pct}%)`);

    el.innerHTML = `
      <div style="display:flex;height:16px;border-radius:999px;overflow:hidden;border:1px solid var(--border);background:var(--bg3);">
        <div style="width:${seg(apple)}%;background:linear-gradient(90deg,#86efac,#22c55e);" title="Apple ${apple}"></div>
        <div style="width:${seg(google)}%;background:linear-gradient(90deg,#60a5fa,#2563eb);" title="Google ${google}"></div>
        <div style="width:${seg(samsung)}%;background:linear-gradient(90deg,#93c5fd,#1428a0);" title="Samsung ${samsung}"></div>
        <div style="width:${seg(other)}%;background:linear-gradient(90deg,#c4b5fd,#8b5cf6);" title="Altro ${other}"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr;gap:8px;margin-top:12px;font-size:12px;color:var(--text2);padding-bottom:8px;">
        <div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#22c55e;margin-right:6px;"></span>Apple Wallet: ${fmtCount(apple, seg(apple))}</div>
        <div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#2563eb;margin-right:6px;"></span>Google Wallet: ${fmtCount(google, seg(google))}</div>
        <div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#1428a0;margin-right:6px;"></span>Samsung Wallet: ${fmtCount(samsung, seg(samsung))}</div>
        <div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#8b5cf6;margin-right:6px;"></span>Altro: ${fmtCount(other, seg(other))}</div>
        <div style="margin-top:4px;">Installati totali: <strong style="color:var(--text)">${totalInstalled}</strong></div>
      </div>
    `;
  }

  function renderA2wTopCampaigns(campaigns) {
    const el = document.getElementById('analyticsTopCampaigns');
    const card = el && el.closest('.a2w-top-campaigns-card');
    if (!el) return;

    if (!campaigns.length) {
      if (card) card.classList.remove('a2w-top-campaigns--single');
      el.innerHTML = '<p style="color:var(--text2);font-size:13px;">Nessuna campagna disponibile.</p>';
      return;
    }

    const ranked = [...campaigns]
      .map((c) => ({
        ...c,
        conv: c.total_downloads > 0 ? (c.total_installs / c.total_downloads) * 100 : 0
      }))
      .sort((a, b) => (b.conv - a.conv) || ((b.total_installs || 0) - (a.total_installs || 0)))
      .slice(0, 5);

    if (card) card.classList.toggle('a2w-top-campaigns--single', ranked.length <= 1);

    const maxConv = Math.max(1, ...ranked.map((r) => r.conv));
    el.innerHTML = `<div class="a2w-top-campaigns-inner">${ranked.map((r, idx) => {
      const w = ((r.conv / maxConv) * 100).toFixed(1);
      const rowColor = idx === 0 ? '#34D399' : idx === 1 ? '#3b82f6' : idx === 2 ? '#10b981' : '#a78bfa';
      return `
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;margin-bottom:4px;">
            <span style="color:var(--text);font-weight:600;">${typeof esc === 'function' ? esc(r.name) : r.name}</span>
            <span style="color:var(--text2);">${r.conv.toFixed(1)}% · ${r.total_installs || 0}/${r.total_downloads || 0}</span>
          </div>
          <div style="height:11px;border-radius:999px;background:var(--bg3);border:1px solid var(--border);overflow:hidden;">
            <div style="height:100%;width:${w}%;background:linear-gradient(90deg,${rowColor},#6ee7b7);"></div>
          </div>
        </div>
      `;
    }).join('')}</div>`;
  }

  function renderA2wCampaignTable(campaigns) {
    const tbody = document.querySelector('#campaignAnalyticsTable tbody');
    if (!tbody) return;
    if (!campaigns.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text2)">Nessuna campagna</td></tr>';
      return;
    }
    tbody.innerHTML = campaigns.map((c) => {
      const conv = c.total_downloads > 0 ? ((c.total_installs / c.total_downloads) * 100).toFixed(1) : '0';
      const name = typeof esc === 'function' ? esc(c.name) : c.name;
      const utm = typeof esc === 'function' ? esc(c.utm_source || '-') : (c.utm_source || '-');
      const badge = c.active
        ? '<span class="a2w-badge a2w-badge--active">Attiva</span>'
        : '<span class="a2w-badge a2w-badge--paused">Pausa</span>';
      return `<tr>
        <td>${name}</td>
        <td class="a2w-num">${c.total_downloads || 0}</td>
        <td class="a2w-num">${c.total_installs || 0}</td>
        <td class="a2w-num">${conv}%</td>
        <td>${utm}</td>
        <td class="a2w-col-status">${badge}</td>
      </tr>`;
    }).join('');
  }

  async function a2wLoadAnalytics() {
    if (!isA2wDeploy()) return;
    if (typeof brandId === 'undefined' || !brandId) return;
    ensureA2wAnalyticsLayout();

    const [analytics, campaigns, passes] = await Promise.all([
      fetchCachedJson(`${API}/analytics/${brandId}`, { headers: { ...getAuthHeaders() } }),
      fetchCachedJson(`${API}/campaigns?brand_id=${brandId}`, { headers: { ...getAuthHeaders() } }),
      fetchCachedJson(`${API}/passes?brand_id=${brandId}&limit=600`, { headers: { ...getAuthHeaders() } })
    ]);

    const allPasses = Array.isArray(passes) ? passes : [];
    renderA2wAnalyticsStats(analytics, campaigns, allPasses);
    if (typeof syncAnalyticsRangeControls === 'function') syncAnalyticsRangeControls();
    renderA2wTrendChart(allPasses);
    renderA2wWalletSplit(allPasses);
    renderA2wTopCampaigns(campaigns);
    renderA2wCampaignTable(campaigns);
  }

  window.initA2wShell = initA2wShell;
  window.syncA2wHeaderChrome = syncA2wHeaderChrome;
  window.syncA2wWaiPadding = syncA2wWaiPadding;
  window.isA2wDeploy = isA2wDeploy;
  window.isA2wActive = isA2wActive;
  window.a2wLoadAnalytics = a2wLoadAnalytics;
})();
