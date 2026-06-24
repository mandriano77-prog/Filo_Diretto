'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeRules,
  hasActiveRules,
  buildAudienceFilter,
  parseTenureYears,
  passTenureYearsSql,
  passHireDateSql
} = require('../src/engine/audiences');

test('parseTenureYears clamps and rejects invalid values', () => {
  assert.equal(parseTenureYears(5), 5);
  assert.equal(parseTenureYears('3'), 3);
  assert.equal(parseTenureYears(99), 60);
  assert.equal(parseTenureYears(-1), null);
  assert.equal(parseTenureYears(''), null);
});

test('normalizeRules keeps HR demographic filters', () => {
  const r = normalizeRules({
    department: ' Direzione ',
    office_location: 'Como',
    min_tenure_years: '5',
    max_tenure_years: 20
  });
  assert.equal(r.department, 'Direzione');
  assert.equal(r.office_location, 'Como');
  assert.equal(r.min_tenure_years, 5);
  assert.equal(r.max_tenure_years, 20);
});

test('hasActiveRules accepts HR-only filters', () => {
  assert.equal(hasActiveRules({ department: 'IT' }), true);
  assert.equal(hasActiveRules({ office_location: 'Milano' }), true);
  assert.equal(hasActiveRules({ min_tenure_years: 3 }), true);
});

test('buildAudienceFilter adds department, city and tenure SQL', () => {
  const { whereExtra, params } = buildAudienceFilter({
    department: 'Direzione',
    office_location: 'Como',
    min_tenure_years: 5,
    max_tenure_years: 15
  });
  assert.match(whereExtra, /field_values->>'reparto'/);
  assert.match(whereExtra, /field_values->>'sede'/);
  assert.match(whereExtra, /hire_date/);
  assert.match(whereExtra, /age\(CURRENT_DATE/);
  assert.deepEqual(params, ['Direzione', 'Como', 5, 15]);
});

test('tenure SQL uses hire_date from members or field_values', () => {
  assert.match(passHireDateSql('p'), /members WHERE pass_id = p\.id/);
  assert.match(passHireDateSql('p'), /field_values->>'hire_date'/);
  assert.match(passTenureYearsSql('p'), /EXTRACT\(YEAR FROM age/);
});
