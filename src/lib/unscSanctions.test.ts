import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateUnscByCountry,
  decodeXmlText,
  parseUnscConsolidatedXml,
  readXmlField,
  UNSC_COUNTRY_REGIMES,
} from './unscSanctions.js';

/**
 * A miniature Consolidated List with the shapes that actually break naive
 * parsing: nested `INDIVIDUAL_*` elements, an entity, a thematic regime with no
 * country subject, an entity-encoded name and a listing with no LISTED_ON.
 */
const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<CONSOLIDATED_LIST dateGenerated="2026-08-14T23:00:04.744Z">
  <INDIVIDUALS>
    <INDIVIDUAL>
      <DATAID>1</DATAID>
      <FIRST_NAME>ALPHA</FIRST_NAME>
      <UN_LIST_TYPE>DRC</UN_LIST_TYPE>
      <REFERENCE_NUMBER>CDi.001</REFERENCE_NUMBER>
      <LISTED_ON>2014-06-30</LISTED_ON>
      <INDIVIDUAL_ALIAS>
        <QUALITY>Good</QUALITY>
        <ALIAS_NAME>ALPHA THE OTHER</ALIAS_NAME>
      </INDIVIDUAL_ALIAS>
      <INDIVIDUAL_ADDRESS>
        <COUNTRY>Uganda</COUNTRY>
      </INDIVIDUAL_ADDRESS>
    </INDIVIDUAL>
    <INDIVIDUAL>
      <DATAID>2</DATAID>
      <FIRST_NAME>BETA &amp; CO</FIRST_NAME>
      <UN_LIST_TYPE>DRC</UN_LIST_TYPE>
      <REFERENCE_NUMBER>CDi.002</REFERENCE_NUMBER>
      <LISTED_ON>2020-02-01</LISTED_ON>
    </INDIVIDUAL>
    <INDIVIDUAL>
      <DATAID>3</DATAID>
      <UN_LIST_TYPE>Al-Qaida</UN_LIST_TYPE>
      <REFERENCE_NUMBER>QDi.001</REFERENCE_NUMBER>
      <LISTED_ON>2001-01-25</LISTED_ON>
    </INDIVIDUAL>
    <INDIVIDUAL>
      <DATAID>4</DATAID>
      <UN_LIST_TYPE>Taliban</UN_LIST_TYPE>
      <REFERENCE_NUMBER>TAi.001</REFERENCE_NUMBER>
    </INDIVIDUAL>
  </INDIVIDUALS>
  <ENTITIES>
    <ENTITY>
      <DATAID>5</DATAID>
      <UN_LIST_TYPE>DRC</UN_LIST_TYPE>
      <REFERENCE_NUMBER>CDe.001</REFERENCE_NUMBER>
      <LISTED_ON>2024-11-05</LISTED_ON>
      <ENTITY_ALIAS>
        <ALIAS_NAME>THE GROUP</ALIAS_NAME>
      </ENTITY_ALIAS>
      <ENTITY_ADDRESS>
        <COUNTRY>DRC</COUNTRY>
      </ENTITY_ADDRESS>
    </ENTITY>
  </ENTITIES>
</CONSOLIDATED_LIST>`;

test('decodeXmlText resolves predefined and numeric entities', () => {
  assert.equal(decodeXmlText('BETA &amp; CO'), 'BETA & CO');
  assert.equal(decodeXmlText('&lt;tag&gt;'), '<tag>');
  assert.equal(decodeXmlText('caf&#233;'), 'café');
  assert.equal(decodeXmlText('&#x41;'), 'A');
  // An unknown entity is left alone rather than silently dropped.
  assert.equal(decodeXmlText('a &nbsp; b'), 'a &nbsp; b');
});

test('readXmlField does not confuse a tag with its prefixed siblings', () => {
  const block = '<INDIVIDUAL_ALIAS><ALIAS_NAME>X</ALIAS_NAME></INDIVIDUAL_ALIAS><NAME>Y</NAME>';
  assert.equal(readXmlField(block, 'NAME'), 'Y');
  assert.equal(readXmlField(block, 'MISSING'), null);
});

test('parseUnscConsolidatedXml reads listings and the UN generation stamp', () => {
  const parsed = parseUnscConsolidatedXml(SAMPLE_XML);
  assert.equal(parsed.generatedAt, '2026-08-14T23:00:04.744Z');
  assert.equal(parsed.listings.length, 5);

  const individuals = parsed.listings.filter((listing) => listing.kind === 'individual');
  const entities = parsed.listings.filter((listing) => listing.kind === 'entity');
  assert.equal(individuals.length, 4);
  assert.equal(entities.length, 1);

  // Nested INDIVIDUAL_ALIAS / INDIVIDUAL_ADDRESS must not split the block or be
  // mistaken for a listing of their own.
  const alpha = parsed.listings.find((listing) => listing.dataId === '1');
  assert.equal(alpha?.regime, 'DRC');
  assert.equal(alpha?.referenceNumber, 'CDi.001');
  assert.equal(alpha?.listedOn, '2014-06-30');

  // A listing with no publication date keeps a null rather than a fake one.
  assert.equal(parsed.listings.find((listing) => listing.dataId === '4')?.listedOn, null);
});

test('aggregateUnscByCountry attributes regimes to their subject country', () => {
  const { perCountry } = aggregateUnscByCountry(parseUnscConsolidatedXml(SAMPLE_XML).listings);

  const drc = perCountry['CD'];
  assert.ok(drc);
  assert.equal(drc.listingCount, 3);
  assert.equal(drc.individualCount, 2);
  assert.equal(drc.entityCount, 1);
  assert.equal(drc.newestListedOn, '2024-11-05');
  assert.equal(drc.regimes.length, 1);
  assert.equal(drc.regimes[0]?.label, 'Democratic Republic of the Congo (1533)');

  // The 1988 Committee regime is Afghanistan's, despite being named "Taliban".
  assert.equal(perCountry['AF']?.listingCount, 1);
});

test('thematic regimes are reported globally, never attributed to a country', () => {
  const { perCountry, thematicRegimes, countryRegimeCount } = aggregateUnscByCountry(
    parseUnscConsolidatedXml(SAMPLE_XML).listings,
  );

  assert.deepEqual(thematicRegimes, [{ regime: 'Al-Qaida', listingCount: 1 }]);
  assert.equal(countryRegimeCount, 2);

  // Al-Qaida listings must not leak into any country bucket: attributing them
  // would invent a country ranking the Council never published.
  const attributed = Object.values(perCountry).reduce((sum, row) => sum + row.listingCount, 0);
  assert.equal(attributed, 4);
});

test('every country regime maps to a distinct ISO alpha-2 code', () => {
  const isoCodes = Object.values(UNSC_COUNTRY_REGIMES).map((target) => target.iso);
  for (const iso of isoCodes) assert.match(iso, /^[A-Z]{2}$/);
  // Guinea-Bissau's committee is keyed "GB" by the UN but must resolve to GW.
  assert.equal(UNSC_COUNTRY_REGIMES['GB']?.iso, 'GW');
});
