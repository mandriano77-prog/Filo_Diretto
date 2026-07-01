'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'src/dashboard/index.html'), 'utf8');
const controller = fs.readFileSync(path.join(root, 'src/dashboard/js/a2w-setup-checklist.js'), 'utf8');
const component = fs.readFileSync(path.join(root, 'src/dashboard/js/components/ui/setup-checklist.js'), 'utf8');

test('welcome espone mount setup checklist HR (root senza script A2W legacy)', () => {
  assert.match(indexHtml, /id="a2wSetupChecklistRoot"/);
  assert.match(indexHtml, /shouldKeepWelcomeAsHome/);
  assert.doesNotMatch(indexHtml, /a2w-setup-checklist\.js/);
});

test('setup checklist definisce i 4 step richiesti', () => {
  assert.match(controller, /Configura identità brand/);
  assert.match(controller, /Crea un template pass/);
  assert.match(controller, /Pubblica una landing page/);
  assert.match(controller, /Raccogli i primi contatti/);
  assert.match(controller, /brand-identity/);
  assert.match(controller, /openCampaignModal/);
});

test('brand nuovo = 0 pass, 0 contatti, 0 campagne', () => {
  assert.match(controller, /passCount === 0/);
  assert.match(controller, /contactCount === 0/);
  assert.match(controller, /campaignCount === 0/);
  assert.match(controller, /isNewBrand/);
});

test('componente UI checklist con stati done e azione', () => {
  assert.match(component, /createSetupChecklist/);
  assert.match(component, /is-done/);
  assert.match(component, /is-pending/);
  assert.match(component, /onStepClick/);
});
