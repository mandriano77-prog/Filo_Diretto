/**
 * Ads2Wallet — Push & Notifiche page (dark shell / isA2wDeploy only).
 */
(function (global) {
  'use strict';

  const A2W = global.A2W = global.A2W || {};
  let reachTimer = null;
  let pushPageBound = false;
  let insightsCache = null;

  function isActive() {
    return typeof isA2wDeploy === 'function' && isA2wDeploy()
      && document.documentElement.classList.contains('a2w-shell');
  }

  function escText(s) {
    if (typeof esc === 'function') return esc(s);
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function ensureA2wPushPageChrome() {
    const section = document.getElementById('push');
    if (!section || section.dataset.a2wPushChrome === '1') return;
    if (!isActive()) return;
    section.dataset.a2wPushChrome = '1';
    section.classList.add('a2w-push-page');

    const legacyHeader = section.querySelector('.a2w-push-legacy-header');
    const pageHeader = document.getElementById('a2wPushPageHeader');
    if (legacyHeader) legacyHeader.hidden = true;
    if (pageHeader) pageHeader.hidden = false;

    const previewCol = document.getElementById('a2wPushPreviewCol');
    if (previewCol) previewCol.hidden = false;

    const sendLegacy = section.querySelector('.a2w-push-send-legacy');
    const sendA2w = document.getElementById('a2wPushSendBtn');
    const draftBtn = document.getElementById('a2wPushDraftBtn');
    if (sendLegacy) sendLegacy.style.display = 'none';
    if (sendA2w) sendA2w.style.display = '';
    if (draftBtn) draftBtn.style.display = '';

    const adv = document.getElementById('a2wPushAdvanced');
    const audSec = document.getElementById('a2wPushAudienceSection');
    const chSec = document.getElementById('a2wPushChannelSection');
    if (adv) adv.open = false;

    const campRadio = section.querySelector('.a2w-push-radio--campaign');
    if (campRadio) {
      const showCamp = typeof isLegacyCampaignsUiEnabled === 'function' && isLegacyCampaignsUiEnabled();
      campRadio.hidden = !showCamp;
      if (!showCamp) {
        const allRadio = section.querySelector('input[name="a2wPushAudienceMode"][value="all"]');
        if (allRadio) allRadio.checked = true;
      }
    }
    syncAudienceModeUi();
    syncChannelFromToggles();
    updateCharCounters();
    updatePreview();
    scheduleReachUpdate();
    bindPushPageEvents();
    loadPreviewBrandLogo();
  }

  function patchUseAudienceInPush() {
    if (typeof useAudienceInPush !== 'function' || useAudienceInPush.__a2wPatched) return;
    const original = useAudienceInPush;
    function wrapped(id) {
      original(id);
      if (!isActive()) return;
      const radio = document.querySelector('input[name="a2wPushAudienceMode"][value="audience"]');
      if (radio) radio.checked = true;
      syncAudienceModeUi();
      scheduleReachUpdate();
    }
    wrapped.__a2wPatched = true;
    global.useAudienceInPush = wrapped;
  }

  function bindPushPageEvents() {
    if (pushPageBound) return;
    pushPageBound = true;
    patchUseAudienceInPush();

    document.querySelectorAll('input[name="a2wPushAudienceMode"]').forEach((el) => {
      el.addEventListener('change', () => {
        syncAudienceModeUi();
        scheduleReachUpdate();
      });
    });

    const campaignSel = document.getElementById('pushCampaignTarget');
    const audienceSel = document.getElementById('pushAudienceTarget');
    if (campaignSel) campaignSel.addEventListener('change', scheduleReachUpdate);
    if (audienceSel) audienceSel.addEventListener('change', scheduleReachUpdate);

    ['a2wPushChApple', 'a2wPushChGoogle'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => {
        syncChannelFromToggles();
        scheduleReachUpdate();
      });
    });

    const titleEl = document.getElementById('pushTitle');
    const msgEl = document.getElementById('pushMessage');
    if (titleEl) {
      titleEl.addEventListener('input', () => {
        updateCharCounters();
        updatePreview();
      });
    }
    if (msgEl) {
      msgEl.addEventListener('input', () => {
        updateCharCounters();
        updatePreview();
      });
    }

    document.querySelectorAll('.a2w-push-preview-os-btn').forEach((btn) => {
      btn.addEventListener('click', () => setPreviewOs(btn.dataset.os || 'ios'));
    });

    const sendBtn = document.getElementById('a2wPushSendBtn');
    if (sendBtn) {
      sendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        submitImmediatePushWithConfirm();
      });
    }

    const draftBtn = document.getElementById('a2wPushDraftBtn');
    if (draftBtn) {
      draftBtn.addEventListener('click', (e) => {
        e.preventDefault();
        savePushAsDraft();
      });
    }
  }

  function getAudienceMode() {
    const checked = document.querySelector('input[name="a2wPushAudienceMode"]:checked');
    return checked ? checked.value : 'all';
  }

  function syncAudienceModeUi() {
    if (!isActive()) return;
    const mode = getAudienceMode();
    const campWrap = document.getElementById('a2wPushCampaignWrap');
    const audWrap = document.getElementById('a2wPushAudienceWrap');
    const campSel = document.getElementById('pushCampaignTarget');
    const audSel = document.getElementById('pushAudienceTarget');

    if (campWrap) campWrap.hidden = mode !== 'campaign';
    if (audWrap) audWrap.hidden = mode !== 'audience';

    if (mode === 'all') {
      if (campSel) campSel.value = '';
      if (audSel) audSel.value = '';
    } else if (mode === 'campaign' && audSel) {
      audSel.value = '';
    } else if (mode === 'audience' && campSel) {
      campSel.value = '';
    }
  }

  function syncChannelFromToggles() {
    const apple = document.getElementById('a2wPushChApple');
    const google = document.getElementById('a2wPushChGoogle');
    const sel = document.getElementById('pushChannel');
    if (!sel) return;
    const aOn = apple ? apple.checked : true;
    const gOn = google ? google.checked : false;
    let val = 'apple';
    if (aOn && gOn) val = 'all';
    else if (gOn) val = 'google';
    else if (aOn) val = 'apple';
    else val = 'apple';
    sel.value = val;
    if (!aOn && !gOn && apple) apple.checked = true;
  }

  function updateCharCounters() {
    const titleEl = document.getElementById('pushTitle');
    const msgEl = document.getElementById('pushMessage');
    const tCounter = document.getElementById('a2wPushCharTitle');
    const mCounter = document.getElementById('a2wPushCharMessage');
    const tLen = (titleEl && titleEl.value) ? titleEl.value.length : 0;
    const mLen = (msgEl && msgEl.value) ? msgEl.value.length : 0;
    if (tCounter) tCounter.textContent = `${tLen}/50`;
    if (mCounter) mCounter.textContent = `${mLen}/178`;
  }

  function setPreviewOs(os) {
    const ios = document.getElementById('a2wPushMockIos');
    const android = document.getElementById('a2wPushMockAndroid');
    document.querySelectorAll('.a2w-push-preview-os-btn').forEach((btn) => {
      const active = btn.dataset.os === os;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (ios) ios.classList.toggle('is-visible', os === 'ios');
    if (android) android.classList.toggle('is-visible', os === 'android');
  }

  function updatePreview() {
    const title = (document.getElementById('pushTitle')?.value || '').trim() || 'Titolo notifica';
    const message = (document.getElementById('pushMessage')?.value || '').trim() || 'Il messaggio apparirà qui.';
    ['Ios', 'Android'].forEach((suffix) => {
      const t = document.getElementById('a2wPushPreviewTitle' + suffix);
      const m = document.getElementById('a2wPushPreviewMsg' + suffix);
      if (t) t.textContent = title;
      if (m) m.textContent = message;
    });
  }

  async function loadPreviewBrandLogo() {
    const logos = [
      document.getElementById('a2wPushPreviewLogoIos'),
      document.getElementById('a2wPushPreviewLogoAndroid')
    ].filter(Boolean);
    if (!logos.length) return;
    const fallback = '/favicon.svg';
    let src = fallback;
    try {
      if (typeof brandId !== 'undefined' && brandId && typeof API !== 'undefined') {
        const res = await fetch(`${API}/brands/${brandId}`, { headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {} });
        if (res.ok) {
          const brand = await res.json();
          if (brand.logo_url) src = brand.logo_url;
          else if (brand.config && brand.config.logo_url) src = brand.config.logo_url;
        }
      }
    } catch (_) {}
    logos.forEach((img) => {
      img.src = src;
      img.onerror = () => { img.src = fallback; };
    });
  }

  function scheduleReachUpdate() {
    if (!isActive()) return;
    clearTimeout(reachTimer);
    reachTimer = setTimeout(updateReachBadge, 280);
  }

  async function fetchInsights() {
    if (!brandId || typeof API === 'undefined') return null;
    if (insightsCache && insightsCache.brandId === brandId) return insightsCache.data;
    try {
      const res = await fetch(`${API}/brands/${brandId}/audiences/insights`, {
        headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}
      });
      if (!res.ok) return null;
      const data = await res.json();
      insightsCache = { brandId, data };
      return data;
    } catch (_) {
      return null;
    }
  }

  async function countReach() {
    const badge = document.getElementById('a2wPushReachBadge');
    if (!badge || !brandId) return;
    const mode = getAudienceMode();
    const appleOn = document.getElementById('a2wPushChApple')?.checked !== false;
    const googleOn = document.getElementById('a2wPushChGoogle')?.checked === true;

    badge.innerHTML = 'Calcolo destinatari…';

    try {
      if (mode === 'audience') {
        const aid = document.getElementById('pushAudienceTarget')?.value;
        if (!aid) {
          badge.innerHTML = 'Seleziona un\'audience per stimare i destinatari.';
          return;
        }
        const res = await fetch(`${API}/audiences/${aid}`, {
          headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}
        });
        const data = await res.json().catch(() => ({}));
        const n = data.member_count ?? data.cached_count ?? '—';
        badge.innerHTML = `Raggiungerai <strong>${n}</strong> possessori del pass`;
        return;
      }

      const rules = {};
      if (mode === 'campaign') {
        const cid = document.getElementById('pushCampaignTarget')?.value;
        if (!cid) {
          badge.innerHTML = 'Seleziona una campagna per stimare i destinatari.';
          return;
        }
        rules.campaign_id = cid;
      }
      if (appleOn && !googleOn) rules.has_apple_push = true;
      if (googleOn && !appleOn) rules.wallet = 'google';

      const res = await fetch(`${API}/brands/${brandId}/audiences/preview`, {
        method: 'POST',
        headers: {
          ...(typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rules })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        badge.innerHTML = escText(data.error || 'Errore stima destinatari');
        return;
      }

      let n = data.count;
      if (mode === 'all' && appleOn && googleOn) {
        const ins = await fetchInsights();
        if (ins) {
          const apple = ins.apple_push_reachable ?? 0;
          const google = ins.google_wallet_saved ?? 0;
          n = Math.max(apple + google, data.count || 0);
        }
      }

      badge.innerHTML = `Raggiungerai <strong>${n ?? '—'}</strong> device`;
    } catch (_) {
      badge.innerHTML = 'Raggiungerai <strong>—</strong> device';
    }
  }

  async function updateReachBadge() {
    if (!isActive()) return;
    await countReach();
  }

  async function getReachCountForConfirm() {
    const badge = document.getElementById('a2wPushReachBadge');
    if (!badge) return null;
    const strong = badge.querySelector('strong');
    if (!strong) return null;
    const n = parseInt(strong.textContent, 10);
    return Number.isFinite(n) ? n : null;
  }

  async function submitImmediatePushWithConfirm() {
    const title = (document.getElementById('pushTitle')?.value || '').trim();
    const message = (document.getElementById('pushMessage')?.value || '').trim();
    if (!title || !message) {
      if (typeof toast === 'function') toast('Compila titolo e messaggio');
      else alert('Compila titolo e messaggio');
      return;
    }

    const mode = getAudienceMode();
    if (mode === 'campaign' && !document.getElementById('pushCampaignTarget')?.value) {
      if (typeof toast === 'function') toast('Seleziona una campagna');
      return;
    }
    if (mode === 'audience' && !document.getElementById('pushAudienceTarget')?.value) {
      if (typeof toast === 'function') toast('Seleziona un\'audience');
      return;
    }

    syncChannelFromToggles();
    await updateReachBadge();
    const n = await getReachCountForConfirm();
    const deviceLabel = n != null ? String(n) : 'i destinatari selezionati';

    let confirmed = true;
    if (global.A2W && A2W.UI && typeof A2W.UI.openConfirmDialog === 'function') {
      confirmed = await A2W.UI.openConfirmDialog({
        title: 'Conferma invio',
        description: `Stai per inviare a ${deviceLabel} device. Confermi?`,
        confirmLabel: 'Invia notifica'
      });
    } else if (typeof appConfirm === 'function') {
      confirmed = await appConfirm({
        title: 'Conferma invio',
        message: `Stai per inviare a ${deviceLabel} device. Confermi?`,
        confirmLabel: 'Invia'
      });
    } else {
      confirmed = confirm(`Stai per inviare a ${deviceLabel} device. Confermi?`);
    }

    if (!confirmed) return;
    if (typeof sendImmediatePush === 'function') await sendImmediatePush();
  }

  async function savePushAsDraft() {
    const title = (document.getElementById('pushTitle')?.value || '').trim();
    const message = (document.getElementById('pushMessage')?.value || '').trim();
    if (!title || !message) {
      if (typeof toast === 'function') toast('Compila titolo e messaggio per salvare una bozza');
      return;
    }
    if (!brandId) {
      if (typeof toast === 'function') toast('Seleziona un brand');
      return;
    }

    const mode = getAudienceMode();
    const campaignId = mode === 'campaign' ? (document.getElementById('pushCampaignTarget')?.value || null) : null;
    const audienceId = mode === 'audience' ? (document.getElementById('pushAudienceTarget')?.value || null) : null;
    syncChannelFromToggles();
    const channel = document.getElementById('pushChannel')?.value || 'apple';
    const updatePass = document.getElementById('pushUpdatePass')?.checked !== false;

    const body = {
      brand_id: brandId,
      title,
      message,
      update_pass: updatePass,
      channel,
      schedule_type: 'once',
      schedule_time: '09:00',
      active: false
    };
    if (audienceId) body.audience_id = audienceId;
    else if (campaignId) body.campaign_id = campaignId;

    const dateInput = document.getElementById('schedDate');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    body.date = (dateInput && dateInput.value)
      ? dateInput.value
      : tomorrow.toISOString().slice(0, 10);

    try {
      const res = await fetch(`${API}/push/scheduled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}) },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (typeof toast === 'function') toast(data.error || 'Impossibile salvare la bozza');
        return;
      }
      if (typeof toast === 'function') toast('Bozza salvata tra le notifiche programmate (in pausa)');
      if (typeof loadScheduledPush === 'function') loadScheduledPush();
    } catch (e) {
      if (typeof toast === 'function') toast(e.message || 'Errore salvataggio bozza');
    }
  }

  function formatCtr(log) {
    const sent = log.sent_count || 0;
    const opens = log.open_count ?? log.opens ?? null;
    if (opens == null || sent <= 0) return '—';
    const pct = ((opens / sent) * 100).toFixed(1);
    return `${opens} (${pct}%)`;
  }

  function renderPushHistoryTable(logs) {
    const el = document.getElementById('pushHistory');
    if (!el) return;

    if (!logs.length) {
      if (typeof renderEmptyState === 'function') {
        el.innerHTML = renderEmptyState({
          title: 'Nessuna notifica inviata',
          description: 'Le push inviate compariranno qui con canale, invii e CTR quando disponibile.',
          icon: 'inbox'
        });
      } else {
        el.innerHTML = '<p style="color:var(--text2)">Nessuna notifica inviata.</p>';
      }
      return;
    }

    const channelLabel = typeof pushChannelDisplayLabel === 'function'
      ? pushChannelDisplayLabel
      : (ch) => ch || 'apple';

    el.innerHTML = `<div class="a2w-push-history-table-wrap"><table class="table a2w-push-history-table">
      <thead><tr>
        <th>Data</th><th>Canale</th><th>Titolo</th><th>Messaggio</th>
        <th>Inviati</th><th>Aperture (CTR)</th><th>Stato</th><th>Azioni</th>
      </tr></thead>
      <tbody>${logs.map((l) => {
        const dt = new Date(l.sent_at || l.created_at).toLocaleString('it');
        const msg = escText(l.message || '');
        const truncated = msg.length > 80 ? msg.slice(0, 77) + '…' : msg;
        const sent = l.sent_count || 0;
        const ctr = formatCtr(l);
        const status = sent > 0 ? 'Inviata' : 'Nessun destinatario';
        const statusClass = sent > 0 ? 'a2w-push-status--ok' : 'a2w-push-status--muted';
        return `<tr data-push-log-id="${l.id}">
          <td class="a2w-push-col-date">${dt}</td>
          <td>${escText(channelLabel(l.channel || 'apple'))}</td>
          <td>${escText(l.title)}</td>
          <td class="a2w-push-col-message" title="${msg}">${truncated}</td>
          <td class="a2w-num">${sent}</td>
          <td class="a2w-num">${escText(ctr)}</td>
          <td><span class="a2w-push-status ${statusClass}">${status}</span></td>
          <td class="a2w-push-col-actions">
            <button type="button" class="btn small sec" data-action="detail" data-id="${l.id}">Dettaglio</button>
            <button type="button" class="btn small" data-action="duplicate" data-id="${l.id}">Duplica</button>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;

    el.querySelectorAll('[data-action="duplicate"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const row = logs.find((x) => String(x.id) === btn.dataset.id);
        if (!row) return;
        duplicatePushFromLog(row);
      });
    });
    el.querySelectorAll('[data-action="detail"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const row = logs.find((x) => String(x.id) === btn.dataset.id);
        if (!row) return;
        showPushLogDetail(row);
      });
    });
  }

  function duplicatePushFromLog(log) {
    switchPushTab('immediate');
    const titleEl = document.getElementById('pushTitle');
    const msgEl = document.getElementById('pushMessage');
    if (titleEl) titleEl.value = log.title || '';
    if (msgEl) msgEl.value = log.message || '';
    updateCharCounters();
    updatePreview();
    if (typeof toast === 'function') toast('Contenuto copiato nel modulo invio');
  }

  function showPushLogDetail(log) {
    const sent = log.sent_count || 0;
    const ctr = formatCtr(log);
    const ch = typeof pushChannelDisplayLabel === 'function'
      ? pushChannelDisplayLabel(log.channel || 'apple')
      : (log.channel || 'apple');
    const lines = [
      `Titolo: ${log.title}`,
      `Messaggio: ${log.message}`,
      `Canale: ${ch}`,
      `Inviati: ${sent}`,
      `Aperture (CTR): ${ctr}`,
      `Data: ${new Date(log.sent_at || log.created_at).toLocaleString('it')}`
    ];
    if (typeof appConfirm === 'function') {
      appConfirm({ title: 'Dettaglio notifica', message: lines.join('\n'), confirmLabel: 'Chiudi', tone: 'default' });
    } else {
      alert(lines.join('\n'));
    }
  }

  function patchLoadPushHistory() {
    if (typeof loadPushHistory !== 'function' || loadPushHistory.__a2wPatched) return;
    const original = loadPushHistory;
    async function wrapped() {
      if (!isActive()) return original.apply(this, arguments);
      if (!brandId) return;
      const res = await fetch(`${API}/push/history?brand_id=${brandId}&limit=50`);
      const logs = await res.json();
      renderPushHistoryTable(Array.isArray(logs) ? logs : []);
    }
    wrapped.__a2wPatched = true;
    global.loadPushHistory = wrapped;
  }

  function initA2wPushPage() {
    if (!isActive()) return;
    ensureA2wPushPageChrome();
    patchLoadPushHistory();
    if (typeof loadPushHistory === 'function') loadPushHistory();
  }

  function onPushSectionNav() {
    insightsCache = null;
    initA2wPushPage();
    scheduleReachUpdate();
  }

  A2W.push = A2W.push || {};
  A2W.push.init = initA2wPushPage;
  A2W.push.onSectionNav = onPushSectionNav;
  A2W.push.ensureChrome = ensureA2wPushPageChrome;
  A2W.push.updateReach = updateReachBadge;
  A2W.push.submitWithConfirm = submitImmediatePushWithConfirm;

  global.initA2wPushPage = initA2wPushPage;
  global.a2wOnPushSectionNav = onPushSectionNav;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      patchLoadPushHistory();
      if (document.getElementById('push')?.classList.contains('active')) initA2wPushPage();
    });
  } else {
    patchLoadPushHistory();
  }
})(window);
