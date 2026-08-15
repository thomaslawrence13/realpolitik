/**
 * Minimal ZIP reader for the single CSV entry inside a published data archive.
 *
 * Several publishers (UCDP, FAOSTAT) ship their bulk extracts as a zipped CSV,
 * and a dependency-free reader keeps the refresh scripts free of a supply-chain
 * addition for something the standard library already covers via `zlib`.
 *
 * Only the two methods those archives actually use are supported — stored (0)
 * and deflate (8). An archive using anything else throws rather than returning
 * partial bytes, because a refresh that silently writes half a dataset is worse
 * than one that fails loudly.
 */

import zlib from 'node:zlib';

const EOCD_SIZE = 22;
const CENTRAL_DIR_SIGNATURE = 0x02014b50;

export interface ZipEntryMatch {
  /** Predicate choosing which entry to extract; defaults to the first `.csv`. */
  match?: (name: string) => boolean;
}

/**
 * Extract one text entry from a ZIP buffer.
 *
 * FAOSTAT archives carry several CSVs (data plus codebooks), so the caller can
 * pass a predicate; UCDP archives carry one and rely on the default.
 */
export const extractTextFromZip = (zip: Buffer, options: ZipEntryMatch = {}): string => {
  const match = options.match ?? ((name: string) => /\.csv$/i.test(name));

  if (zip.length < EOCD_SIZE) throw new Error('zip too small');
  if (zip[0] !== 0x50 || zip[1] !== 0x4b) throw new Error('not a zip (bad magic)');

  const eocdOffset = zip.length - EOCD_SIZE;
  const entryCount = zip.readUInt16LE(eocdOffset + 10);
  const cdSize = zip.readUInt32LE(eocdOffset + 12);
  const cdOffset = zip.readUInt32LE(eocdOffset + 16);
  const centralDir = zip.subarray(cdOffset, cdOffset + cdSize);

  let cursor = 0;
  const seen: string[] = [];
  for (let entryIndex = 0; entryIndex < entryCount; entryIndex++) {
    if (centralDir.readUInt32LE(cursor) !== CENTRAL_DIR_SIGNATURE) break;
    const method = centralDir.readUInt16LE(cursor + 10);
    const compressedSize = centralDir.readUInt32LE(cursor + 20);
    const uncompressedSize = centralDir.readUInt32LE(cursor + 24);
    const nameLength = centralDir.readUInt16LE(cursor + 28);
    const extraLength = centralDir.readUInt16LE(cursor + 30);
    const commentLength = centralDir.readUInt16LE(cursor + 32);
    const localOffset = centralDir.readUInt32LE(cursor + 42);
    const name = centralDir.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    seen.push(name);

    if (match(name)) {
      const local = zip.subarray(localOffset);
      // The local header repeats name/extra lengths and they can differ from
      // the central directory's, so the data offset is read from the local
      // header rather than assumed.
      const dataStart = local.readUInt16LE(26) + local.readUInt16LE(28) + 30;
      const raw = zip.subarray(localOffset + dataStart, localOffset + dataStart + compressedSize);
      const content = method === 0 ? raw : method === 8 ? zlib.inflateRawSync(raw) : undefined;
      if (!content) throw new Error(`unsupported zip method ${method} for ${name}`);
      if (content.length !== uncompressedSize) throw new Error(`zip size mismatch for ${name}`);
      return content.toString('utf8');
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error(`no matching entry found in zip (saw: ${seen.slice(0, 8).join(', ')})`);
};
