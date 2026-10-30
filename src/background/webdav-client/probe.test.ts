import { describe, expect, it } from 'vitest';
import { createClient } from './client';
import { DAV_CONFIG, createDavServer, emptyState } from '../../../tests/fakes/webdav';

const lockConfig = { ...DAV_CONFIG, concurrency: 'collection-lock' };

describe('reaching a WebDAV server', () => {
  // fetch rejects an aborted request with a DOMException, whose numeric code
  // must not pass for one of the client's own failure codes.
  it('reports a request that outlasts its timeout as a timeout', async () => {
    const hanging = createClient(DAV_CONFIG, {
      timeoutMs: 5,
      fetch: (_url, init) => new Promise((_resolve, reject) => {
        if (init.signal) init.signal.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
      })
    });

    await expect(hanging.readState()).rejects.toMatchObject({ code: 'timeout' });
  });

  it('reports a failed fetch as a network error', async () => {
    const unreachable = createClient(DAV_CONFIG, { fetch: () => Promise.reject(new TypeError('Failed to fetch')) });

    await expect(unreachable.readState()).rejects.toMatchObject({ code: 'network-error' });
  });
});

describe('the connection test', () => {
  it('finds conditional writes and a MOVE lock on a conforming server, and leaves no probe files', async () => {
    const server = createDavServer();

    expect(await createClient(DAV_CONFIG, { fetch: server.fetch }).testConnection())
      .toEqual({ ok: true, concurrency: 'conditional', lockStrategy: 'collection-move' });
    expect([...server.files.keys()].some((path) => path.includes('probe-'))).toBe(false);
  });

  it('falls back to the collection lock on a server that ignores conditions', async () => {
    const server = createDavServer();
    server.ignoreConditions = true;

    expect((await createClient(DAV_CONFIG, { fetch: server.fetch }).testConnection()).concurrency).toBe('collection-lock');
  });

  it('handles racy MKCOL and a provider-specific 409 with a non-overwriting MOVE', async () => {
    const server = createDavServer();
    server.ignoreConditions = true;
    server.unsafeCollections = true;
    server.moveConflictStatus = 409;

    expect(await createClient(DAV_CONFIG, { fetch: server.fetch }).testConnection())
      .toEqual({ ok: true, concurrency: 'collection-lock', lockStrategy: 'collection-move' });
  });

  it('refuses a server whose MOVE overwrites, or loses a contender behind a 409', async () => {
    const server = createDavServer();
    server.ignoreConditions = true;
    server.unsafeCollections = true;
    server.moveConflictStatus = 409;
    server.ignoreMoveOverwrite = true;

    await expect(createClient(DAV_CONFIG, { fetch: server.fetch }).testConnection())
      .rejects.toMatchObject({ code: 'conditional-write-unsupported', diagnostic: { phase: 'move-race' } });
    server.ignoreMoveOverwrite = false;
    server.loseMoveSource = true;
    await expect(createClient(DAV_CONFIG, { fetch: server.fetch }).testConnection()).rejects.toMatchObject({ diagnostic: { phase: 'move-owner' } });
  });

  it('accepts MKCOL instead of MOVE only when it passes its own race test', async () => {
    const server = createDavServer();
    server.ignoreConditions = true;
    server.unsafeCollections = true;
    server.moveUnsupported = true;

    await expect(createClient(DAV_CONFIG, { fetch: server.fetch }).testConnection()).rejects.toMatchObject({
      code: 'conditional-write-unsupported', diagnostic: { revision: 'dav-lock-5', phase: 'directory-race', statuses: [201, 201] }
    });
    server.unsafeCollections = false;
    expect((await createClient(DAV_CONFIG, { fetch: server.fetch }).testConnection()).lockStrategy).toBe('collection-create');
    server.brokenDelete = true;
    await expect(createClient(DAV_CONFIG, { fetch: server.fetch }).testConnection()).rejects.toThrow(/conditional-write-unsupported/);
  });

  // Existing sync folders also answer 405, so only a fresh path proves the
  // server refuses folder creation.
  it('reports a refused MKCOL on a fresh path apart from concurrency', async () => {
    const server = createDavServer();
    server.refuseCollections = true;
    const attempts = [
      () => createClient(DAV_CONFIG, { fetch: server.fetch }).testConnection(),
      () => createClient(lockConfig, { fetch: server.fetch }).writeState(emptyState(), null)
    ];

    for (const attempt of attempts) {
      await expect(attempt()).rejects.toMatchObject({
        code: 'folder-create-refused', diagnostic: { revision: 'dav-lock-5', phase: 'state-lock-create', statuses: [405] }
      });
    }
  });

  // Real servers refuse the losing MOVE with 405 (nginx), 423 (Go x/net/webdav)
  // or 500 (Apache, WsgiDAV, Nextcloud). Ownership checks decide, not the code.
  it.each([405, 423, 500])('passes the race test with a verified %i refusal', async (status) => {
    const server = createDavServer();
    server.moveConflictStatus = status;

    expect(await createClient(DAV_CONFIG, { fetch: server.fetch }).testConnection())
      .toEqual({ ok: true, concurrency: 'conditional', lockStrategy: 'collection-move' });
  });

  it('claims the lock in turn when both overlapping MOVEs are refused, but only while both keep their content', async () => {
    const server = createDavServer();
    server.refuseMoves = 2;

    expect((await createClient(DAV_CONFIG, { fetch: server.fetch }).testConnection()).lockStrategy).toBe('collection-move');
    server.refuseMoves = 2;
    server.loseMoveSource = true;
    await expect(createClient(DAV_CONFIG, { fetch: server.fetch }).testConnection()).rejects.toMatchObject({ diagnostic: { phase: 'move-race' } });
  });
});
