// Ids for items Options saves (custom site searches, aggregate searches):
// random where the browser has crypto.randomUUID, unique enough otherwise.
function createPersistentId(prefix: string): string {
  const safePrefix = String(prefix || 'item').replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'item';
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return `${safePrefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${safePrefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export { createPersistentId };
