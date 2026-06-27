'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FD = path.join(ROOT, 'src', 'filodiretto');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function readFd(name) {
  return fs.readFileSync(path.join(FD, name), 'utf8');
}

test('Log Attività H1 sync distinguishes Analytics vs Log Attività', () => {
  const js = readFd('fd-analytics.js');
  assert.match(js, /tab === 'activity-log' \? 'Log Attività' : 'Analytics'/);
  assert.match(js, /fdSyncAnalyticsHrChrome/);
  assert.match(js, /h1\.textContent = titleText/);
});

test('activity log translates event types to Italian', () => {
  const js = readFd('fd-activity-log.js');
  assert.match(js, /pass_fetched: 'Pass recuperato'/);
  assert.match(js, /pass_downloaded: 'Pass scaricato'/);
  assert.match(js, /samsung_wallet_link_generated/);
  assert.match(js, /eventTypeLabel/);
  assert.match(js, /data-event-type/);
});

test('activity log details column uses tooltip and table wrap', () => {
  const js = readFd('fd-activity-log.js');
  const css = readFd('fd-activity-log.css');
  assert.match(js, /fd-activity-log-details__text/);
  assert.match(js, /title="/);
  assert.match(css, /fd-activity-log-details__text/);
  assert.match(css, /fd-analytics-activity-table-wrap|fd-table-wrap/);
});

test('activity log pass id copy control', () => {
  const js = readFd('fd-activity-log.js');
  assert.match(js, /fd-activity-id-copy/);
  assert.match(js, /data-copy-value/);
  assert.match(js, /navigator\.clipboard/);
});

test('Utenti badges distinguish protected vs active', () => {
  const js = readFd('fd-users.js');
  const css = readFd('fd-users.css');
  assert.match(js, /fd-users-protected/);
  assert.match(js, /fd-users-status--active/);
  assert.match(css, /\.fd-users-protected/);
  assert.match(css, /\.fd-users-status--active/);
  assert.doesNotMatch(css, /\.fd-users-protected[\s\S]*\.fd-users-status--active/);
});

test('Utenti brand id copy button', () => {
  const js = readFd('fd-users.js');
  assert.match(js, /fd-users-copy/);
  assert.match(js, /data-copy-id/);
});

test('Utenti admin can create a separated HR tenant with first manager', () => {
  const js = readFd('fd-users.js');
  const css = readFd('fd-users.css');
  assert.match(js, /fdOpenTenantWizard/);
  assert.match(js, /fdTenantWizardBtn/);
  assert.match(js, /postJson\('\/brands'/);
  assert.match(js, /postJson\('\/templates'/);
  assert.match(js, /postJson\('\/users'/);
  assert.match(js, /role: 'manager'/);
  assert.match(js, /brand_id: brand\.id/);
  assert.match(css, /\.fd-tenant-wizard__panel/);
});

test('Utenti tenant wizard translates duplicate db errors into clear actions', () => {
  const js = readFd('fd-users.js');
  assert.match(js, /humanizeTenantWizardError/);
  assert.match(js, /users_email_key/);
  assert.match(js, /brands_slug_key/);
  assert.match(js, /Ho creato il brand, ma la mail/);
  assert.match(js, /selezionalo dal menu in alto/);
});

test('Home exposes brand setup checklist for managers and admins', () => {
  const js = readFd('fd-home.js');
  const css = readFd('fd-home.css');
  assert.match(js, /fdOpenBrandSetupWizard/);
  assert.match(js, /Setup brand/);
  assert.match(js, /data-fd-action="setup-brand"/);
  assert.match(js, /data-fd-action="tenant-wizard"/);
  assert.match(css, /\.fd-home-onboarding--focus/);
});

test('Engagement Coin KPIs always show numeric values', () => {
  const js = readFd('fd-pga-engagement.js');
  assert.match(js, /formatKpiNumber/);
  assert.match(js, /renderKpiSkeleton/);
  assert.match(js, /fd-pga-kpi__value/);
  assert.match(js, /exportEngagementCsv/);
});

test('nav maps activity-log to analytics tab with Italian breadcrumb', () => {
  const subnav = read('src/dashboard/js/dashboard-subnav.js');
  assert.match(subnav, /'activity-log': \{ section: 'analytics', tab: 'activity-log' \}/);
  assert.match(subnav, /return 'Log Attività'/);
});
