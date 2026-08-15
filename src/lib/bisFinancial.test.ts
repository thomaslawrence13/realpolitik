import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateBisSeries,
  creditGapBand,
  parseSdmxSeries,
  type SdmxJson,
} from './bisFinancial.js';

/**
 * SDMX-JSON encodes series keys as colon-joined *indexes* into the dimension
 * table, so the country is only recoverable through that table. This fixture
 * deliberately orders countries so that a positional shortcut (e.g. assuming
 * index order matches alphabetical order) produces visibly wrong attribution.
 */
const SDMX: SdmxJson = {
  data: {
    structure: {
      dimensions: {
        series: [
          { id: 'FREQ', values: [{ id: 'Q' }] },
          { id: 'BORROWERS_CTY', values: [{ id: 'KR' }, { id: 'US' }, { id: 'XM' }] },
          { id: 'TC_BORROWERS', values: [{ id: 'P' }] },
          { id: 'TC_LENDERS', values: [{ id: 'A' }] },
          { id: 'CG_DTYPE', values: [{ id: 'C' }] },
        ],
        observation: [{ id: 'TIME_PERIOD', values: [{ id: '2025-Q3' }, { id: '2025-Q4' }] }],
      },
    },
    dataSets: [
      {
        series: {
          '0:0:0:0:0': { observations: { '1': [-8.0122, 0, 0, null] } },
          '0:1:0:0:0': { observations: { '0': [-12.4, 0, 0, null], '1': [-11.5378, 0, 0, null] } },
          '0:2:0:0:0': { observations: { '1': [-3.2, 0, 0, null] } },
        },
      },
    ],
  },
};

test('parseSdmxSeries resolves dimensions through the table, not by position', () => {
  const points = parseSdmxSeries(SDMX);
  assert.equal(points.length, 4);

  const korea = points.filter((point) => point.dimensions['BORROWERS_CTY'] === 'KR');
  assert.equal(korea.length, 1);
  assert.equal(korea[0]?.value, -8.0122);
  assert.equal(korea[0]?.period, '2025-Q4');
  // The gap type must survive: reading the trend (B) instead of the gap (C)
  // silently publishes a ~200% "gap".
  assert.equal(korea[0]?.dimensions['CG_DTYPE'], 'C');
});

test('a malformed or unresolvable series key is skipped, not guessed', () => {
  const broken: SdmxJson = {
    data: {
      structure: SDMX.data!.structure,
      dataSets: [
        {
          series: {
            // Index 9 does not exist in the country dimension.
            '0:9:0:0:0': { observations: { '0': [1.5] } },
            // Too few dimensions for this structure.
            '0:0': { observations: { '0': [2.5] } },
          },
        },
      ],
    },
  };
  assert.deepEqual(parseSdmxSeries(broken), []);
});

test('the newest period wins per series and country', () => {
  const perCountry = aggregateBisSeries(
    [{ key: 'creditToGdpGap', countryDimension: 'BORROWERS_CTY', points: parseSdmxSeries(SDMX) }],
    new Set(['KR', 'US']),
  );

  // The US has two observations; the 2025-Q4 one must win over 2025-Q3.
  assert.equal(perCountry['US']?.creditToGdpGap?.value, -11.5378);
  assert.equal(perCountry['US']?.creditToGdpGap?.period, '2025-Q4');
  assert.equal(perCountry['KR']?.creditToGdpGap?.value, -8.0122);
});

test('aggregates and untracked areas are dropped', () => {
  const perCountry = aggregateBisSeries(
    [{ key: 'creditToGdpGap', countryDimension: 'BORROWERS_CTY', points: parseSdmxSeries(SDMX) }],
    new Set(['KR', 'US', 'XM']),
  );

  // XM is the euro area. Even when "tracked", it is an aggregate and must not
  // be attributed to a country card.
  assert.equal(perCountry['XM'], undefined);
  assert.deepEqual(Object.keys(perCountry).sort(), ['KR', 'US']);
});

test('the country dimension differs by dataflow and is addressed by id', () => {
  // WS_CBPOL uses REF_AREA rather than BORROWERS_CTY; addressing by id keeps
  // one aggregator working for both.
  const policy: SdmxJson = {
    data: {
      structure: {
        dimensions: {
          series: [
            { id: 'FREQ', values: [{ id: 'M' }] },
            { id: 'REF_AREA', values: [{ id: 'GB' }] },
          ],
          observation: [{ id: 'TIME_PERIOD', values: [{ id: '2026-07' }] }],
        },
      },
      dataSets: [{ series: { '0:0': { observations: { '0': [4.25] } } } }],
    },
  };

  const perCountry = aggregateBisSeries(
    [{ key: 'policyRate', countryDimension: 'REF_AREA', points: parseSdmxSeries(policy) }],
    new Set(['GB']),
  );
  assert.equal(perCountry['GB']?.policyRate?.value, 4.25);
  assert.equal(perCountry['GB']?.policyRate?.period, '2026-07');
});

test('credit gap bands follow the Basel III buffer guide thresholds', () => {
  // The guide starts building the buffer at 2pp and maxes out at 10pp.
  assert.equal(creditGapBand(12), 'elevated');
  assert.equal(creditGapBand(10), 'elevated');
  assert.equal(creditGapBand(5), 'building');
  assert.equal(creditGapBand(2), 'building');
  assert.equal(creditGapBand(0), 'neutral');
  assert.equal(creditGapBand(-1.9), 'neutral');
  assert.equal(creditGapBand(-11.5), 'below-trend');
});
