'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  PUSH_TITLE_MAX,
  PUSH_MESSAGE_MAX,
  validatePushText,
  PUSH_TEXT_AGENT_RULES,
} = require('../src/engine/push-text-limits');

test('push text limits constants', () => {
  assert.equal(PUSH_TITLE_MAX, 22);
  assert.equal(PUSH_MESSAGE_MAX, 52);
});

test('validatePushText rejects over-limit title', () => {
  const errors = validatePushText('A'.repeat(23), 'Ok');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'pushTitle');
});

test('validatePushText rejects over-limit message', () => {
  const errors = validatePushText('OK', 'M'.repeat(53));
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'pushMessage');
});

test('validatePushText accepts valid copy', () => {
  assert.equal(validatePushText('2x1 OCCHIALI', 'Solo questa settimana: 2x1 sugli occhiali').length, 0);
});

test('agent rules mention limits', () => {
  assert.match(PUSH_TEXT_AGENT_RULES, /22/);
  assert.match(PUSH_TEXT_AGENT_RULES, /52/);
});
