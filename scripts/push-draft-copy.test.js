'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { clampPushDraft, heuristicPushDraft } = require('../src/engine/push-draft-copy');
const { PUSH_MESSAGE_MAX, validatePushText } = require('../src/engine/push-text-limits');

test('clampPushDraft enforces title and message limits', () => {
  const draft = clampPushDraft({
    title: 'T'.repeat(40),
    message: 'M'.repeat(80),
  });
  assert.ok(draft.title.length <= 22);
  assert.ok(draft.message.length <= PUSH_MESSAGE_MAX);
  assert.equal(validatePushText(draft.title, draft.message).length, 0);
  assert.equal(draft.valid, true);
});

test('clampPushDraft sets pass link when url provided', () => {
  const draft = clampPushDraft({
    title: 'PROMO',
    message: 'Solo oggi',
    pass_link_url: 'https://example.com/offerta',
    pass_link_label: 'Vai all\'offerta',
  });
  assert.equal(draft.include_pass_link, true);
  assert.equal(draft.pass_link_url, 'https://example.com/offerta');
  assert.equal(draft.pass_link_label, 'Vai all\'offerta');
});

test('heuristicPushDraft returns reviewable copy', () => {
  const draft = heuristicPushDraft('Sconto 20% su occhiali. Valido fino a domenica.', { name: 'NTI' });
  assert.ok(draft.title.length > 0);
  assert.ok(draft.message.length > 0);
  assert.equal(validatePushText(draft.title, draft.message).length, 0);
  assert.ok(Array.isArray(draft.notes) && draft.notes.length);
});
