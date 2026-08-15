import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RISK_THRESHOLDS,
  DEBT_RISK,
  TIER_VALUES,
} from './constants';

test('RISK_THRESHOLDS are ordered correctly', () => {
  assert.ok(RISK_THRESHOLDS.medium < RISK_THRESHOLDS.high);
  assert.ok(RISK_THRESHOLDS.high <= 100);
});

test('DEBT_RISK constants are positive and ordered', () => {
  assert.ok(DEBT_RISK.thresholdPct > 0);
  assert.ok(DEBT_RISK.maxContribution > 0);
  assert.ok(DEBT_RISK.multiplier > 0);
});

test('TIER_VALUES are ordered correctly', () => {
  assert.ok(TIER_VALUES.low < TIER_VALUES.medium);
  assert.ok(TIER_VALUES.medium < TIER_VALUES.high);
});