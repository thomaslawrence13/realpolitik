/**
 * Raw World Bank audit payload — write and read.
 *
 * `npm run ingest` keeps every observation it saw, not just the newest value
 * per country, so a disputed number can be traced back to the response it came
 * from. That audit trail is worth keeping; storing it as 6.4 MB of
 * pretty-printed JSON was not. It is never imported by the app, so nobody
 * reading the repository benefits from the indentation, while everyone cloning
 * it pays for the bytes.
 *
 * Gzipped it is ~250 KB — a 96% reduction with the same content. Both readers
 * (`validateDataset`, `buildHistoricalSeries`) are Node scripts, so
 * decompression costs nothing at runtime and nothing in the client bundle.
 */

import fs from 'node:fs';
import zlib from 'node:zlib';

/** Committed path of the compressed audit payload, relative to the datasets dir. */
export const RAW_AUDIT_FILENAME = 'world_bank_latest.json.gz';

export interface RawAuditPayload<Point> {
  fetchedAt: string;
  indicators: Record<string, Point[]>;
}

/**
 * Write the audit payload, compressed.
 *
 * The JSON is minified before compressing: the file is no longer human-readable
 * once gzipped, so indentation buys nothing and still costs compression work.
 */
export const writeRawAudit = <Point>(filePath: string, payload: RawAuditPayload<Point>): void => {
  const json = Buffer.from(JSON.stringify(payload), 'utf8');
  fs.writeFileSync(filePath, zlib.gzipSync(json, { level: 9 }));
};

/**
 * Read the audit payload.
 *
 * Falls back to an uncompressed `world_bank_latest.json` when the gzipped file
 * is absent, so a working tree carrying an older ingest output still validates
 * instead of failing with a missing-file error that looks like a bug.
 */
export const readRawAudit = <Point>(filePath: string): RawAuditPayload<Point> => {
  if (fs.existsSync(filePath)) {
    return JSON.parse(zlib.gunzipSync(fs.readFileSync(filePath)).toString('utf8')) as RawAuditPayload<Point>;
  }
  const legacyPath = filePath.replace(/\.gz$/, '');
  if (fs.existsSync(legacyPath)) {
    return JSON.parse(fs.readFileSync(legacyPath, 'utf8')) as RawAuditPayload<Point>;
  }
  throw new Error(`raw audit payload not found at ${filePath} (or ${legacyPath}) — run npm run ingest`);
};
