import assert from 'node:assert/strict';
import test from 'node:test';
import { countries } from './countryData';

const byCountry = new Map(countries.map((country) => [country.id, country]));

test('UN voting agreement overrides are applied to tracked countries', () => {
  const germany = byCountry.get('germany');
  assert.ok(germany, 'germany should exist');
  const source = germany.diplomatic?.unVotesSource;
  assert.ok(source, 'Germany should carry a measured voting source');
  assert.ok(source.rollCalls >= 24);
  assert.ok(source.retrievedAt.length === 10);
  assert.ok(source.sessions.length > 1);
  assert.ok(germany.diplomatic!.unVotingAlignmentBlocA >= 0 && germany.diplomatic!.unVotingAlignmentBlocA <= 100);
  assert.ok(germany.diplomatic!.unVotingAlignmentBlocB >= 0 && germany.diplomatic!.unVotingAlignmentBlocB <= 100);
});

test('OFAC sanctions registry is attached to sanctioned countries', () => {
  const russia = byCountry.get('russia')!;
  assert.ok(russia.sanctions, 'Russia should carry a sanctions registry');
  assert.ok(russia.sanctions.entryCount > 1000);
  assert.ok(russia.sanctions.topPrograms.includes('RUSSIA-EO14024'));
});

test('countries without a registry keep clean optional fields', () => {
  const taiwan = byCountry.get('taiwan');
  assert.ok(taiwan);
  assert.equal(taiwan.sanctions, undefined);
});