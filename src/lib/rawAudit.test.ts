import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { RAW_AUDIT_FILENAME, readRawAudit, writeRawAudit } from './rawAudit.js';

const withTempDir = (run: (dir: string) => void): void => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raw-audit-'));
  try {
    run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

const samplePayload = () => ({
  fetchedAt: '2026-08-15T00:00:00.000Z',
  indicators: {
    'NY.GDP.MKTP.CD': [
      { country: 'US', year: '2025', value: 1 },
      { country: 'DE', year: '2025', value: 2 },
    ],
    'SP.POP.TOTL': [{ country: 'US', year: '2025', value: 3 }],
  },
});

test('a written payload round-trips through compression unchanged', () => {
  withTempDir((dir) => {
    const file = path.join(dir, RAW_AUDIT_FILENAME);
    const payload = samplePayload();
    writeRawAudit(file, payload);

    // Lossless: the audit trail is the point of keeping this file at all.
    assert.deepEqual(readRawAudit(file), payload);
  });
});

test('compression is what makes the payload committable', () => {
  withTempDir((dir) => {
    const file = path.join(dir, RAW_AUDIT_FILENAME);
    // Repetitive rows, like the real payload's per-country year series.
    const payload = {
      fetchedAt: '2026-08-15T00:00:00.000Z',
      indicators: {
        'NY.GDP.MKTP.CD': Array.from({ length: 2000 }, (_, index) => ({
          country: 'US',
          year: String(2000 + (index % 25)),
          value: index,
        })),
      },
    };
    writeRawAudit(file, payload);

    const compressed = fs.statSync(file).size;
    const uncompressed = Buffer.byteLength(JSON.stringify(payload, null, 2), 'utf8');
    assert.ok(
      compressed < uncompressed / 5,
      `expected a >5x reduction, got ${uncompressed} → ${compressed} bytes`,
    );
  });
});

test('an uncompressed legacy file is still readable', () => {
  withTempDir((dir) => {
    const payload = samplePayload();
    // A working tree from before the change carries the plain .json; validation
    // should keep working rather than failing as if the file were missing.
    fs.writeFileSync(path.join(dir, 'world_bank_latest.json'), JSON.stringify(payload));

    assert.deepEqual(readRawAudit(path.join(dir, RAW_AUDIT_FILENAME)), payload);
  });
});

test('a missing payload names the command that produces it', () => {
  withTempDir((dir) => {
    assert.throws(
      () => readRawAudit(path.join(dir, RAW_AUDIT_FILENAME)),
      /npm run ingest/,
    );
  });
});
