/**
 * UUID utility for canonical entity identification and deterministic UUID mapping.
 * RFC 4122 compliant v4 generation and deterministic mapping for legacy IDs.
 */

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

/**
 * Deterministically maps a string (such as legacy match_1234 or sample_match_1)
 * into a valid RFC 4122 v4 UUID string that PostgreSQL will accept without syntax errors.
 */
export function toCanonicalUUID(id: string): string {
  if (!id) return generateUUID();
  if (isValidUUID(id)) return id;

  // Simple deterministic hash to 32 hex chars
  let hash1 = 0x811c9dc5;
  let hash2 = 0x9e3779b9;
  for (let i = 0; i < id.length; i++) {
    const code = id.charCodeAt(i);
    hash1 ^= code;
    hash1 = Math.imul(hash1, 0x01000193);
    hash2 ^= code;
    hash2 = Math.imul(hash2, 0x5bd1e995);
  }

  const h1 = (hash1 >>> 0).toString(16).padStart(8, '0');
  const h2 = (hash2 >>> 0).toString(16).padStart(8, '0');
  const h3 = ((hash1 ^ hash2) >>> 0).toString(16).padStart(8, '0');
  const h4 = (Math.imul(hash1, hash2) >>> 0).toString(16).padStart(8, '0');

  const combined = (h1 + h2 + h3 + h4).slice(0, 32);

  // Format as 8-4-4-4-12 with valid version (4) and variant (a)
  return `${combined.slice(0, 8)}-${combined.slice(8, 12)}-4${combined.slice(13, 16)}-a${combined.slice(17, 20)}-${combined.slice(20, 32)}`;
}
