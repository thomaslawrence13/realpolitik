import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateEuByCountry, EU_PROGRAMME_LABELS, parseEuSanctionsXml } from './euSanctions.js';

/**
 * A miniature export covering the shapes that decide attribution: a person with
 * citizenship, an entity with a registered address, a dual national, an
 * unknown-country placeholder, and a designation implementing a UN listing.
 */
const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<export xmlns="http://eu.europa.ec/fpi/fsd/export" generationDate="2026-08-05T16:47:04.449+02:00">
  <sanctionEntity designationDate="2022-02-23" unitedNationId="" euReferenceNumber="EU.1.1" logicalId="101">
    <regulation regulationType="regulation" publicationDate="2022-02-23" programme="UKR" logicalId="1"/>
    <subjectType code="person" classificationCode="P"/>
    <nameAlias wholeName="Ivan Ivanov" strong="true" logicalId="11"/>
    <citizenship countryIso2Code="RU" countryDescription="RUSSIA" logicalId="1"/>
  </sanctionEntity>
  <sanctionEntity designationDate="2024-06-01" unitedNationId="" euReferenceNumber="EU.2.2" logicalId="102">
    <regulation regulationType="regulation" publicationDate="2024-06-01" programme="UKR" logicalId="2"/>
    <subjectType code="enterprise" classificationCode="E"/>
    <nameAlias wholeName="Some Bank JSC" strong="true" logicalId="12"/>
    <address city="Moscow" countryIso2Code="RU" countryDescription="RUSSIA" logicalId="2"/>
    <address city="Minsk" countryIso2Code="BY" countryDescription="BELARUS" logicalId="3"/>
  </sanctionEntity>
  <sanctionEntity designationDate="2020-01-15" unitedNationId="6908402" euReferenceNumber="EU.3.3" logicalId="103">
    <regulation regulationType="regulation" publicationDate="2020-01-15" programme="TAQA" logicalId="3"/>
    <subjectType code="enterprise" classificationCode="E"/>
    <nameAlias wholeName="Thematic Group" strong="true" logicalId="13"/>
  </sanctionEntity>
  <sanctionEntity designationDate="2019-03-03" unitedNationId="" euReferenceNumber="EU.4.4" logicalId="104">
    <regulation regulationType="regulation" publicationDate="2019-03-03" programme="IRN" logicalId="4"/>
    <subjectType code="person" classificationCode="P"/>
    <nameAlias wholeName="Unknown Origin" strong="true" logicalId="14"/>
    <citizenship countryIso2Code="00" countryDescription="UNKNOWN" logicalId="4"/>
  </sanctionEntity>
</export>`;

test('parseEuSanctionsXml reads stable ids, programmes and the EU export stamp', () => {
  const parsed = parseEuSanctionsXml(SAMPLE_XML);

  assert.equal(parsed.generatedAt, '2026-08-05T16:47:04.449+02:00');
  assert.equal(parsed.listings.length, 4);

  const person = parsed.listings.find((listing) => listing.logicalId === '101');
  assert.equal(person?.subjectType, 'person');
  assert.equal(person?.euReference, 'EU.1.1');
  assert.deepEqual(person?.programmes, ['UKR']);
  assert.deepEqual(person?.countries, ['RU']);
  assert.equal(person?.designationDate, '2022-02-23');
});

test('entities are attributed by registered address, persons by citizenship', () => {
  const { perCountry } = aggregateEuByCountry(parseEuSanctionsXml(SAMPLE_XML).listings);

  // Enterprises carry <address>, not <citizenship>; reading only citizenship
  // would silently drop a quarter of the real list.
  assert.equal(perCountry['RU']?.listingCount, 2);
  assert.equal(perCountry['RU']?.personCount, 1);
  assert.equal(perCountry['RU']?.enterpriseCount, 1);

  // A multi-country entity counts once per country, never twice for one.
  assert.equal(perCountry['BY']?.listingCount, 1);
  assert.equal(perCountry['BY']?.enterpriseCount, 1);
});

test('attribution is by identity, never by programme name', () => {
  const { perCountry } = aggregateEuByCountry(parseEuSanctionsXml(SAMPLE_XML).listings);

  // Both UKR-programme designations target Russian parties. Attributing by
  // programme would credit Ukraine with measures taken over Russian actions —
  // the failure this module exists to prevent.
  assert.equal(perCountry['UA'], undefined);
  assert.equal(perCountry['RU']?.programmes[0]?.programme, 'UKR');
  assert.equal(perCountry['RU']?.programmes[0]?.label, EU_PROGRAMME_LABELS['UKR']);
});

test('unknown-country and country-less designations are reported as unattributed', () => {
  const { perCountry, unattributedTotal } = aggregateEuByCountry(
    parseEuSanctionsXml(SAMPLE_XML).listings,
  );

  // The "00" placeholder must not become a country bucket.
  assert.equal(perCountry['00'], undefined);
  // The thematic entity with no address, plus the "00" person.
  assert.equal(unattributedTotal, 2);
});

test('designations implementing a UN listing keep the cross-list id', () => {
  const parsed = parseEuSanctionsXml(SAMPLE_XML);
  const linked = parsed.listings.filter((listing) => listing.unitedNationId !== null);

  assert.equal(linked.length, 1);
  assert.equal(linked[0]?.unitedNationId, '6908402');
  // Empty attributes must read as "no link", not as an id of "".
  assert.equal(parsed.listings.find((listing) => listing.logicalId === '101')?.unitedNationId, null);
});

test('newest designation date is tracked per country', () => {
  const { perCountry } = aggregateEuByCountry(parseEuSanctionsXml(SAMPLE_XML).listings);
  assert.equal(perCountry['RU']?.newestDesignation, '2024-06-01');
});
