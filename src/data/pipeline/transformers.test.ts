import assert from 'node:assert/strict';
import test from 'node:test';
import {
  toTier,
  toMilitaryTier,
  toTradeTier,
  toStabilityTier,
  toRuleOfLawTier,
  toCohesionDelta,
  toCohesionValue,
  isValidIndicatorValue,
} from './transformers';
import type { CountryIndicators } from '../../types';

test('toTier returns correct tier based on thresholds', () => {
  // Thresholds: [lowMax, highMin] = [10, 20]
  assert.equal(toTier(5, [10, 20]), 'low');
  assert.equal(toTier(10, [10, 20]), 'low');
  assert.equal(toTier(15, [10, 20]), 'medium');
  assert.equal(toTier(20, [10, 20]), 'high');
  assert.equal(toTier(25, [10, 20]), 'high');
});

test('toTier handles null and undefined values', () => {
  assert.equal(toTier(null, [10, 20]), null);
  assert.equal(toTier(undefined, [10, 20]), null);
});

test('toMilitaryTier uses correct thresholds [1.2, 3.0]', () => {
  assert.equal(toMilitaryTier(0.5), 'low');
  assert.equal(toMilitaryTier(1.2), 'low');
  assert.equal(toMilitaryTier(2.0), 'medium');
  assert.equal(toMilitaryTier(3.0), 'high');
  assert.equal(toMilitaryTier(4.5), 'high');
  assert.equal(toMilitaryTier(null), null);
});

test('toTradeTier uses correct thresholds [35, 80]', () => {
  assert.equal(toTradeTier(20), 'low');
  assert.equal(toTradeTier(35), 'low');
  assert.equal(toTradeTier(50), 'medium');
  assert.equal(toTradeTier(80), 'high');
  assert.equal(toTradeTier(95), 'high');
  assert.equal(toTradeTier(null), null);
});

test('toStabilityTier uses correct thresholds [-0.5, 0.5]', () => {
  assert.equal(toStabilityTier(-1.5), 'low');
  assert.equal(toStabilityTier(-0.5), 'low');
  assert.equal(toStabilityTier(0), 'medium');
  assert.equal(toStabilityTier(0.5), 'high');
  assert.equal(toStabilityTier(1.5), 'high');
  assert.equal(toStabilityTier(null), null);
});

test('toRuleOfLawTier uses correct thresholds [-0.75, 0.75]', () => {
  assert.equal(toRuleOfLawTier(-1.5), 'low');
  assert.equal(toRuleOfLawTier(-0.75), 'low');
  assert.equal(toRuleOfLawTier(0), 'medium');
  assert.equal(toRuleOfLawTier(0.75), 'high');
  assert.equal(toRuleOfLawTier(1.5), 'high');
  assert.equal(toRuleOfLawTier(null), null);
});

test('toCohesionDelta applies GDP growth multiplier correctly', () => {
  // GDP growth of 3% with no inflation/unemployment: 3 * 1.6 = 4.8
  assert.ok(Math.abs(toCohesionDelta(3, null, null) - 4.8) < 0.0001);
  // GDP growth of -2%: -2 * 1.6 = -3.2
  assert.ok(Math.abs(toCohesionDelta(-2, null, null) + 3.2) < 0.0001);
});

test('toCohesionDelta clamps GDP contribution within bounds', () => {
  // Very high GDP growth should be clamped to MAX_GDP_DELTA (8)
  assert.equal(toCohesionDelta(10, null, null), 8);
  // Very low GDP growth should be clamped to MIN_GDP_DELTA (-10)
  assert.equal(toCohesionDelta(-10, null, null), -10);
});

test('toCohesionDelta applies inflation penalty when above safe band', () => {
  // Inflation at 10% (safe band) = no penalty
  assert.equal(toCohesionDelta(0, 10, null), 0);
  // Inflation at 20%: excess = 10, penalty = 10 * 0.6 = 6
  assert.equal(toCohesionDelta(0, 20, null), -6);
  // Inflation at 35%: excess = 25, penalty capped at MAX_INFLATION_PENALTY (12)
  assert.equal(toCohesionDelta(0, 35, null), -12);
});

test('toCohesionDelta applies unemployment penalty when above safe band', () => {
  // Unemployment at 5% (safe band) = no penalty
  assert.equal(toCohesionDelta(0, null, 5), 0);
  // Unemployment at 15%: excess = 10, penalty = 10 * 0.4 = 4
  assert.equal(toCohesionDelta(0, null, 15), -4);
  // Unemployment at 35%: excess = 30, penalty capped at MAX_UNEMPLOYMENT_PENALTY (10)
  assert.equal(toCohesionDelta(0, null, 35), -10);
});

test('toCohesionDelta combines all factors', () => {
  // GDP 2%, inflation 12%, unemployment 8%
  // GDP: 2 * 1.6 = 3.2
  // Inflation: excess = 2, penalty = 2 * 0.6 = 1.2
  // Unemployment: excess = 3, penalty = 3 * 0.4 = 1.2
  // Total: 3.2 - 1.2 - 1.2 = 0.8
  assert.ok(Math.abs(toCohesionDelta(2, 12, 8) - 0.8) < 0.0001);
});

test('toCohesionValue clamps result between 0 and 100', () => {
  const baseline: CountryIndicators['cohesion'] = 50;
  // GDP 10% gives delta of 8 (clamped from 16), so 50 + 8 = 58
  assert.equal(toCohesionValue(baseline, 10, null, null), 58);
  // Extreme case: GDP -10 (-10 clamped), inflation 35 (-12 penalty), unemployment 35 (-10 penalty)
  // Total delta: -10 - 12 - 10 = -32, so 50 - 32 = 18
  assert.equal(toCohesionValue(baseline, -10, 35, 35), 18);
  // To get to 0, we need a larger negative delta
  // Starting from baseline 10, with max negative delta (-32): 10 - 32 = 0 (clamped)
  const lowBaseline: CountryIndicators['cohesion'] = 10;
  assert.equal(toCohesionValue(lowBaseline, -10, 35, 35), 0);
  // To get to 100, start from baseline 92, with max positive delta (+8): 92 + 8 = 100
  const highBaseline: CountryIndicators['cohesion'] = 92;
  assert.equal(toCohesionValue(highBaseline, 10, null, null), 100);
});

test('isValidIndicatorValue validates cohesion range [0, 100]', () => {
  assert.equal(isValidIndicatorValue('cohesion', 0), true);
  assert.equal(isValidIndicatorValue('cohesion', 50), true);
  assert.equal(isValidIndicatorValue('cohesion', 100), true);
  assert.equal(isValidIndicatorValue('cohesion', -1), false);
  assert.equal(isValidIndicatorValue('cohesion', 101), false);
  assert.equal(isValidIndicatorValue('cohesion', NaN), false);
});

test('isValidIndicatorValue validates tier values', () => {
  const tierIndicators: (keyof CountryIndicators)[] = [
    'tradeExposure',
    'militaryTreatyLevel',
    'conflictPressure',
    'sanctionsExposure',
    'ideology',
    'borderDisputes',
    'regimeStability',
    'conflictHistory',
    'tradeDependence',
  ];

  for (const indicator of tierIndicators) {
    assert.equal(isValidIndicatorValue(indicator, 'low'), true);
    assert.equal(isValidIndicatorValue(indicator, 'medium'), true);
    assert.equal(isValidIndicatorValue(indicator, 'high'), true);
    assert.equal(isValidIndicatorValue(indicator, 'invalid' as any), false);
    assert.equal(isValidIndicatorValue(indicator, null as any), false);
  }
});

test('isValidIndicatorValue rejects unknown indicators', () => {
  assert.equal(isValidIndicatorValue('cohesion' as any, 50), true);
  // @ts-expect-error Testing invalid key
  assert.equal(isValidIndicatorValue('unknown', 'value'), false);
});

test('toCohesionDelta handles null and undefined values correctly', () => {
  // All null/undefined should return 0
  assert.equal(toCohesionDelta(null, null, null), 0);
  assert.equal(toCohesionDelta(undefined, undefined, undefined), 0);
  
  // Only GDP provided
  assert.ok(Math.abs(toCohesionDelta(5, null, null) - 8.0) < 0.0001);
  
  // Only inflation provided
  assert.equal(toCohesionDelta(null, 15, null), -3);
  
  // Only unemployment provided
  assert.equal(toCohesionDelta(null, null, 10), -2);
  
  // GDP and inflation, no unemployment
  assert.ok(Math.abs(toCohesionDelta(3, 12, null) - 3.6) < 0.0001);
  
  // GDP and unemployment, no inflation
  assert.ok(Math.abs(toCohesionDelta(3, null, 8) - 3.6) < 0.0001);
  
  // Inflation and unemployment, no GDP (with floating point tolerance)
  assert.ok(Math.abs(toCohesionDelta(null, 12, 8) + 2.4) < 0.0001);
});

test('toCohesionDelta handles boundary values for safe bands', () => {
  // Inflation exactly at safe band boundary (10%)
  assert.equal(toCohesionDelta(0, 10, null), 0);
  assert.ok(Math.abs(toCohesionDelta(0, 10.0001, null) + 0.00006) < 0.000001);
  
  // Unemployment exactly at safe band boundary (5%)
  assert.equal(toCohesionDelta(0, null, 5), 0);
  assert.ok(Math.abs(toCohesionDelta(0, null, 5.0001) + 0.00004) < 0.000001);
  
  // Both at exact boundaries
  assert.equal(toCohesionDelta(0, 10, 5), 0);
});

test('toCohesionDelta handles negative GDP growth clamping', () => {
  // GDP -6.25 should give -10 after clamping (-6.25 * 1.6 = -10)
  assert.equal(toCohesionDelta(-6.25, null, null), -10);
  // GDP -7 should also give -10 (clamped)
  assert.equal(toCohesionDelta(-7, null, null), -10);
  // GDP -100 should give -10 (clamped)
  assert.equal(toCohesionDelta(-100, null, null), -10);
});

test('toCohesionDelta handles positive GDP growth clamping', () => {
  // GDP 5 should give 8 (5 * 1.6 = 8, exactly at limit)
  assert.equal(toCohesionDelta(5, null, null), 8);
  // GDP 6 should give 8 (clamped from 9.6)
  assert.equal(toCohesionDelta(6, null, null), 8);
  // GDP 100 should give 8 (clamped)
  assert.equal(toCohesionDelta(100, null, null), 8);
});

test('toCohesionDelta precision with decimal values', () => {
  // Test with decimal GDP growth
  assert.ok(Math.abs(toCohesionDelta(1.5, null, null) - 2.4) < 0.0001);
  assert.ok(Math.abs(toCohesionDelta(-1.5, null, null) + 2.4) < 0.0001);
  
  // Test with decimal inflation
  assert.ok(Math.abs(toCohesionDelta(0, 11.5, null) + 0.9) < 0.0001);
  
  // Test with decimal unemployment
  assert.ok(Math.abs(toCohesionDelta(0, null, 7.5) + 1.0) < 0.0001);
});

test('toCohesionValue handles edge baselines', () => {
  // Baseline at 0 with positive delta
  assert.equal(toCohesionValue(0, 5, null, null), 8);
  
  // Baseline at 100 with negative delta
  // GDP -5 gives -8, inflation 15 gives -3, unemployment 15 gives -4
  // Total: -8 - 3 - 4 = -15, so 100 - 15 = 85
  assert.equal(toCohesionValue(100, -5, 15, 15), 85);
  
  // Baseline at 50 with zero delta
  assert.equal(toCohesionValue(50, 0, 10, 5), 50);
  
  // Very small baseline with max negative delta
  assert.equal(toCohesionValue(5, -10, 35, 35), 0);
  
  // Very high baseline with max positive delta
  assert.equal(toCohesionValue(95, 10, null, null), 100);
});

test('toCohesionValue rounding behavior', () => {
  // Test that result is rounded to nearest integer
  // GDP 1.25 gives delta 2.0 (1.25 * 1.6 = 2.0)
  assert.equal(toCohesionValue(50, 1.25, null, null), 52);
  
  // GDP 1.3 gives delta 2.08 (1.3 * 1.6 = 2.08), rounds to 2
  assert.equal(toCohesionValue(50, 1.3, null, null), 52);
  
  // GDP 1.4 gives delta 2.24 (1.4 * 1.6 = 2.24), rounds to 2
  assert.equal(toCohesionValue(50, 1.4, null, null), 52);
  
  // GDP 1.5 gives delta 2.4 (1.5 * 1.6 = 2.4), rounds to 2
  assert.equal(toCohesionValue(50, 1.5, null, null), 52);
  
  // GDP 1.6 gives delta 2.56 (1.6 * 1.6 = 2.56), rounds to 3
  assert.equal(toCohesionValue(50, 1.6, null, null), 53);
});

test('toTier boundary conditions with various threshold sets', () => {
  // Test with zero thresholds
  assert.equal(toTier(-1, [0, 0]), 'low');
  assert.equal(toTier(0, [0, 0]), 'low');
  assert.equal(toTier(0.0001, [0, 0]), 'high');
  assert.equal(toTier(1, [0, 0]), 'high');
  
  // Test with negative thresholds
  assert.equal(toTier(-10, [-5, -2]), 'low');
  assert.equal(toTier(-5, [-5, -2]), 'low');
  assert.equal(toTier(-3, [-5, -2]), 'medium');
  assert.equal(toTier(-2, [-5, -2]), 'high');
  assert.equal(toTier(0, [-5, -2]), 'high');
  
  // Test with large thresholds
  assert.equal(toTier(1000, [5000, 10000]), 'low');
  assert.equal(toTier(5000, [5000, 10000]), 'low');
  assert.equal(toTier(7500, [5000, 10000]), 'medium');
  assert.equal(toTier(10000, [5000, 10000]), 'high');
  assert.equal(toTier(15000, [5000, 10000]), 'high');
});

test('toMilitaryTier boundary values', () => {
  assert.equal(toMilitaryTier(1.19), 'low');
  assert.equal(toMilitaryTier(1.2), 'low');
  assert.equal(toMilitaryTier(1.21), 'medium');
  assert.equal(toMilitaryTier(2.99), 'medium');
  assert.equal(toMilitaryTier(3.0), 'high');
  assert.equal(toMilitaryTier(3.01), 'high');
});

test('toTradeTier boundary values', () => {
  assert.equal(toTradeTier(34.9), 'low');
  assert.equal(toTradeTier(35), 'low');
  assert.equal(toTradeTier(35.1), 'medium');
  assert.equal(toTradeTier(79.9), 'medium');
  assert.equal(toTradeTier(80), 'high');
  assert.equal(toTradeTier(80.1), 'high');
});

test('toStabilityTier boundary values', () => {
  assert.equal(toStabilityTier(-0.51), 'low');
  assert.equal(toStabilityTier(-0.5), 'low');
  assert.equal(toStabilityTier(-0.49), 'medium');
  assert.equal(toStabilityTier(0.49), 'medium');
  assert.equal(toStabilityTier(0.5), 'high');
  assert.equal(toStabilityTier(0.51), 'high');
});

test('toRuleOfLawTier boundary values', () => {
  assert.equal(toRuleOfLawTier(-0.76), 'low');
  assert.equal(toRuleOfLawTier(-0.75), 'low');
  assert.equal(toRuleOfLawTier(-0.74), 'medium');
  assert.equal(toRuleOfLawTier(0.74), 'medium');
  assert.equal(toRuleOfLawTier(0.75), 'high');
  assert.equal(toRuleOfLawTier(0.76), 'high');
});

test('isValidIndicatorValue edge cases for cohesion', () => {
  // Boundary values
  assert.equal(isValidIndicatorValue('cohesion', 0), true);
  assert.equal(isValidIndicatorValue('cohesion', 100), true);
  
  // Decimal values within range
  assert.equal(isValidIndicatorValue('cohesion', 50.5), true);
  assert.equal(isValidIndicatorValue('cohesion', 0.1), true);
  assert.equal(isValidIndicatorValue('cohesion', 99.9), true);
  
  // Negative values
  assert.equal(isValidIndicatorValue('cohesion', -0.1), false);
  assert.equal(isValidIndicatorValue('cohesion', -100), false);
  
  // Values over 100
  assert.equal(isValidIndicatorValue('cohesion', 100.1), false);
  assert.equal(isValidIndicatorValue('cohesion', 150), false);
  
  // Special numeric values
  assert.equal(isValidIndicatorValue('cohesion', Infinity), false);
  assert.equal(isValidIndicatorValue('cohesion', -Infinity), false);
});

test('isValidIndicatorValue with various invalid inputs for tier indicators', () => {
  const indicator: keyof CountryIndicators = 'tradeExposure';
  
  // Invalid string values (cast to any to bypass type checking)
  assert.equal(isValidIndicatorValue(indicator, '' as any), false);
  assert.equal(isValidIndicatorValue(indicator, 'LOW' as any), false);
  assert.equal(isValidIndicatorValue(indicator, 'Low' as any), false);
  assert.equal(isValidIndicatorValue(indicator, 'invalid' as any), false);
  
  // Numeric values
  assert.equal(isValidIndicatorValue(indicator, 0 as any), false);
  assert.equal(isValidIndicatorValue(indicator, 1 as any), false);
  assert.equal(isValidIndicatorValue(indicator, NaN as any), false);
  
  // Objects and arrays
  assert.equal(isValidIndicatorValue(indicator, {} as any), false);
  assert.equal(isValidIndicatorValue(indicator, [] as any), false);
});
