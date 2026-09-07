import { createHash } from 'node:crypto';
/** Allow only the exact bitmap payloads declared by scene image nodes. */
export function auditEmbeddedMedia(expected, actual) {
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const expectedHashes = new Set(expected.map(hash)), actualHashes = new Set(actual.map(hash));
  const missing = [...expectedHashes].filter(value => !actualHashes.has(value));
  const unexpected = [...actualHashes].filter(value => !expectedHashes.has(value));
  return { accepted: missing.length === 0 && unexpected.length === 0, expectedUnique: expectedHashes.size, actualUnique: actualHashes.size, missing, unexpected };
}
