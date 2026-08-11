import assert from 'node:assert/strict';
import test from 'node:test';
import { countryIso3, iso3ToCountryId, pickObservation } from './imfWeoClient';
import { countryIso2 } from './worldBankClient';

test('pickObservation prefers the latest completed year over the current-year estimate', () => {
  const observation = pickObservation({ '2023': 1.1, '2024': 2.2, '2025': 3.3, '2026': 4.4 }, 2026);

  assert.ok(observation);
  assert.equal(observation.year, '2025');
  assert.equal(observation.value, 3.3);
  assert.equal(observation.projection, false);
});

test('pickObservation exposes the current-year figure as a separate outlook', () => {
  const observation = pickObservation({ '2025': 3.3, '2026': 4.4 }, 2026);

  assert.deepEqual(observation?.outlook, { value: 4.4, year: '2026' });
});

test('pickObservation discards years beyond the current one', () => {
  const observation = pickObservation({ '2025': 3.3, '2027': 9.9, '2031': 12.1 }, 2026);

  assert.equal(observation?.year, '2025');
  assert.equal(observation?.outlook, undefined);
});

test('pickObservation falls back to the current year, flagged as a projection', () => {
  const observation = pickObservation({ '2026': 4.4, '2027': 5.5 }, 2026);

  assert.equal(observation?.year, '2026');
  assert.equal(observation?.projection, true);
  assert.equal(observation?.outlook, undefined);
});

test('pickObservation skips null and malformed entries', () => {
  const observation = pickObservation(
    { '2024': null, notAYear: 5, '2025': null } as Record<string, number | null>,
    2026,
  );

  assert.equal(observation, null);
});

test('IMF economy codes round-trip and stay aligned with the tracked country set', () => {
  for (const [countryId, code] of Object.entries(countryIso3)) {
    assert.equal(iso3ToCountryId[code], countryId, `${code} should map back to ${countryId}`);
    assert.ok(countryIso2[countryId], `${countryId} should be a tracked country`);
  }
});

test('Kosovo uses the IMF economy code rather than the ISO alpha-3 code', () => {
  // The WEO publishes Kosovo as UVK; XKX returns nothing.
  assert.equal(countryIso3['kosovo'], 'UVK');
});

test('economies absent from the WEO are omitted rather than mapped to a wrong code', () => {
  // Neither reports to the WEO — they must fall through to curated data.
  assert.equal(countryIso3['cuba'], undefined);
  assert.equal(countryIso3['north-korea'], undefined);
  // Taiwan is the reason this source earns its keep: the World Bank omits it.
  assert.equal(countryIso3['taiwan'], 'TWN');
});
