import assert from 'node:assert/strict';
import test from 'node:test';
import { historicalSeriesByCountryId } from './historicalSeries';

const MAJOR_COUNTRIES = ['united-states', 'germany', 'india', 'brazil', 'japan'];

test('major countries expose observed historical series', () => {
  for (const countryId of MAJOR_COUNTRIES) {
    const series = historicalSeriesByCountryId[countryId];
    assert.ok(series && series.length > 0, `${countryId} should have series`);
    for (const metric of series) {
      assert.ok(metric.points.length > 0, `${countryId} ${metric.metricId} should have points`);
      assert.ok(metric.label.length > 0);
      assert.match(metric.metadata.sourceId, /^world-bank/);
      assert.ok(metric.metadata.sourceUrl.startsWith('https://'));
      assert.match(metric.metadata.coverage, /% of tracked countries/);
      assert.ok(metric.metadata.confidenceFlags.length > 0);
      assert.ok(metric.metadata.frequency === 'annual');
    }
  }
});

test('series points are observed, sorted ascending, and within the last decade', () => {
  const nowYear = new Date().getUTCFullYear();
  for (const countryId of MAJOR_COUNTRIES) {
    for (const metric of historicalSeriesByCountryId[countryId] ?? []) {
      const years = metric.points.map((point) => Number.parseInt(point.period, 10));
      const sorted = years.slice().sort((a, b) => a - b);
      assert.deepEqual(years, sorted, `${countryId} ${metric.metricId} sorted ascending`);
      for (const point of metric.points) {
        assert.equal(point.quality, 'observed');
        assert.match(point.retrievalDate, /^\d{4}-\d{2}-\d{2}$/);
        assert.ok(Number.isFinite(point.value));
        const year = Number.parseInt(point.period, 10);
        assert.ok(year >= nowYear - 12 && year <= nowYear, `${countryId} ${metric.metricId} year ${year}`);
      }
    }
  }
});

test('each metric id maps to a distinct label and config', () => {
  const seen = new Set<string>();
  for (const countryId of MAJOR_COUNTRIES) {
    for (const series of historicalSeriesByCountryId[countryId] ?? []) {
      seen.add(`${series.metricId}:${series.label}`);
    }
  }
  assert.equal(seen.size, 8, 'eight distinct metrics expected');
});
