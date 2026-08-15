import assert from 'node:assert/strict';
import test from 'node:test';
import { relationshipEvidenceTimeline } from './relationshipEvidence';
import type { CountryRelationship } from '../types';

const relationship = {
  countryId: 'canada',
  displayName: 'Canada',
  mapName: 'Canada',
  cooperation: 80,
  hostility: 10,
  dependency: 50,
  deterrence: 70,
  tension: 40,
  notes: '',
  lastUpdated: '2026-01-01',
  sources: [],
  dataQuality: {
    computedLastUpdated: '2026-02-01',
    degradedReasons: [],
    dimensions: [
      { dimension: 'cooperation', sourceId: 'pact', observedAt: '2026-01-01', confidence: 0.9, stale: false, method: 'snapshot' },
      { dimension: 'dependency', sourceId: 'trade', observedAt: '2026-02-01', confidence: 0.8, stale: false, method: 'derived' },
    ],
  },
} satisfies CountryRelationship;

test('relationship evidence is ordered by the observed timestamp', () => {
  const points = relationshipEvidenceTimeline(relationship);
  assert.deepEqual(points.map((point) => point.dimension), ['dependency', 'cooperation']);
  assert.equal(points[0]?.value, 50);
  assert.equal(points[0]?.sourceId, 'trade');
});
