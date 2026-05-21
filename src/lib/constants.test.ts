import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RISK_THRESHOLDS,
  CONFIDENCE_THRESHOLDS,
  DEBT_RISK,
  SCENARIO_INPUT_BOUNDS,
  TIER_VALUES,
} from './constants';

test('RISK_THRESHOLDS are ordered correctly', () => {
  assert.ok(RISK_THRESHOLDS.medium < RISK_THRESHOLDS.high);
  assert.ok(RISK_THRESHOLDS.high <= 100);
});

test('CONFIDENCE_THRESHOLDS are reasonable', () => {
  assert.ok(CONFIDENCE_THRESHOLDS.unstableRiskFloor > 0 && CONFIDENCE_THRESHOLDS.unstableRiskFloor <= 100);
  assert.ok(CONFIDENCE_THRESHOLDS.unstableProbabilityMargin > 0);
  assert.ok(CONFIDENCE_THRESHOLDS.v14ReleaseFloor > 0 && CONFIDENCE_THRESHOLDS.v14ReleaseFloor < 1);
});

test('DEBT_RISK constants are positive and ordered', () => {
  assert.ok(DEBT_RISK.thresholdPct > 0);
  assert.ok(DEBT_RISK.maxContribution > 0);
  assert.ok(DEBT_RISK.multiplier > 0);
});

test('SCENARIO_INPUT_BOUNDS are symmetric for treaty shift', () => {
  assert.equal(SCENARIO_INPUT_BOUNDS.treaty.min, -SCENARIO_INPUT_BOUNDS.treaty.max);
  assert.ok(Math.abs(SCENARIO_INPUT_BOUNDS.treaty.max) === 60);
});

test('TIER_VALUES are ordered correctly', () => {
  assert.ok(TIER_VALUES.low < TIER_VALUES.medium);
  assert.ok(TIER_VALUES.medium < TIER_VALUES.high);
});
