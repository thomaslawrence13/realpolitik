import assert from 'node:assert/strict';
import test from 'node:test';
import zlib from 'node:zlib';
import { extractTextFromZip } from './zip.js';

/**
 * Build a minimal but structurally real ZIP so the reader is exercised against
 * actual byte offsets rather than a mock. Publishers ship both stored and
 * deflated entries, so both are covered.
 */
const buildZip = (entries: Array<{ name: string; content: string; deflate: boolean }>): Buffer => {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const raw = Buffer.from(entry.content, 'utf8');
    const stored = entry.deflate ? zlib.deflateRawSync(raw) : raw;
    const name = Buffer.from(entry.name, 'utf8');

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(entry.deflate ? 8 : 0, 8);
    localHeader.writeUInt32LE(stored.length, 18);
    localHeader.writeUInt32LE(raw.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    locals.push(localHeader, name, stored);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(entry.deflate ? 8 : 0, 10);
    centralHeader.writeUInt32LE(stored.length, 20);
    centralHeader.writeUInt32LE(raw.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, name);

    offset += localHeader.length + name.length + stored.length;
  }

  const localBytes = Buffer.concat(locals);
  const centralBytes = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBytes.length, 12);
  eocd.writeUInt32LE(localBytes.length, 16);

  return Buffer.concat([localBytes, centralBytes, eocd]);
};

test('reads a deflated CSV entry', () => {
  const zip = buildZip([{ name: 'data.csv', content: 'a,b\n1,2\n', deflate: true }]);
  assert.equal(extractTextFromZip(zip), 'a,b\n1,2\n');
});

test('reads a stored (uncompressed) CSV entry', () => {
  const zip = buildZip([{ name: 'data.csv', content: 'x,y\n3,4\n', deflate: false }]);
  assert.equal(extractTextFromZip(zip), 'x,y\n3,4\n');
});

test('a predicate selects the data file from an archive of codebooks', () => {
  // FAOSTAT archives ship the data alongside AreaCodes/ItemCodes/Flags files,
  // and the data file is not first in the directory.
  const zip = buildZip([
    { name: 'Food_Security_Data_E_AreaCodes.csv', content: 'area\n', deflate: true },
    { name: 'Food_Security_Data_E_All_Data_(Normalized).csv', content: 'real,data\n', deflate: true },
    { name: 'Food_Security_Data_E_Flags.csv', content: 'flag\n', deflate: true },
  ]);

  assert.equal(extractTextFromZip(zip, { match: (name) => /All_Data.*\.csv$/i.test(name) }), 'real,data\n');
  // The default predicate takes the first CSV, which here is the codebook.
  assert.equal(extractTextFromZip(zip), 'area\n');
});

test('a missing entry throws and names what it did see', () => {
  const zip = buildZip([{ name: 'readme.txt', content: 'nothing here', deflate: false }]);
  assert.throws(() => extractTextFromZip(zip), /no matching entry found/);
});

test('a non-zip buffer is rejected rather than parsed as garbage', () => {
  assert.throws(() => extractTextFromZip(Buffer.from('this is not a zip file at all')), /bad magic/);
  assert.throws(() => extractTextFromZip(Buffer.alloc(4)), /too small/);
});
