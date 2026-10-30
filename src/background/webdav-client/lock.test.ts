import { describe, expect, it } from 'vitest';
import * as settings from '../../domain/settings';
import { createClient } from './client';
import { STALE_LOCK_MS } from './errors';
import { DAV_CONFIG, LOCK_PATH, STATE_PATH, createDavServer, decode, emptyState, encode } from '../../../tests/fakes/webdav';
import type { DavServer } from '../../../tests/fakes/webdav';

const theme = settings.themeMode.key;
const language = settings.language.key;
const lockConfig = { ...DAV_CONFIG, concurrency: 'collection-lock' };
const ownerFile = `${LOCK_PATH}owner.txt`;

function isLockMove(init: RequestInit): boolean {
  return init.method === 'MOVE' && new URL(String(new Headers(init.headers).get('Destination'))).pathname === LOCK_PATH;
}

async function readEtag(client: ReturnType<typeof createClient>): Promise<string | null> {
  const snapshot = await client.readState();
  return snapshot ? snapshot.etag : null;
}

function owner(server: DavServer): string {
  const file = server.files.get(ownerFile);
  return file ? decode(file.bytes) : '';
}

describe('writing the state under the shared lock', () => {
  it('lets only one of two concurrent writers commit, and a losing contender never removes the lock', async () => {
    const server = createDavServer();
    server.ignoreConditions = true;
    server.etagMode = 'none';
    server.unsafeCollections = true;
    server.moveConflictStatus = 409;
    const writerA = createClient(lockConfig, { fetch: server.fetch });
    const writerB = createClient(lockConfig, { fetch: server.fetch });
    await writerA.ensureDirectories();
    await writerA.writeState(emptyState({ [theme]: 'light' }), null);
    const revision = await readEtag(writerA);
    const writes = await Promise.allSettled([
      writerA.writeState(emptyState({ [theme]: 'dark' }), revision), writerB.writeState(emptyState({ [theme]: 'system' }), revision)
    ]);

    expect(writes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    writes.forEach((result) => {
      if (result.status === 'rejected') expect(['remote-locked', 'remote-changed']).toContain(Reflect.get(result.reason, 'code'));
    });
    expect(server.directories.has(LOCK_PATH)).toBe(false);
    await expect(writerB.writeState(emptyState({ [theme]: 'light' }), revision)).rejects.toThrow(/remote-changed/);

    const saved = server.state();
    server.directories.add(LOCK_PATH);
    const deletes = () => server.requestCount('DELETE', (path) => path === LOCK_PATH);
    const before = deletes();
    await expect(writerB.writeState(emptyState(), await readEtag(writerB))).rejects.toThrow(/remote-locked/);
    expect(deletes()).toBe(before);
    expect(server.state()).toEqual(saved);
    expect(server.requestCount('MKCOL', (path) => path === LOCK_PATH)).toBe(0);
  });

  it.each([405, 423, 500])('treats a %i MOVE refusal as an ordinary lost race and cleans up the candidate', async (status) => {
    const server = createDavServer();
    server.moveConflictStatus = status;
    const first = createClient(lockConfig, { fetch: server.fetch });
    const second = createClient(lockConfig, { fetch: server.fetch });
    await first.ensureDirectories();
    await first.writeState(emptyState({ [theme]: 'light' }), null);
    const shared = await readEtag(first);
    const results = await Promise.allSettled([
      first.writeState(emptyState({ [theme]: 'dark' }), shared), second.writeState(emptyState({ [theme]: 'system' }), shared)
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    results.forEach((result) => {
      if (result.status === 'rejected') expect(['remote-locked', 'remote-changed']).toContain(Reflect.get(result.reason, 'code'));
    });
    expect(server.directories.has(LOCK_PATH)).toBe(false);
    expect([...server.directories].some((path) => path.includes('lock-candidate-'))).toBe(false);
  });

  it('never takes a refusal that still moved the candidate for a lost race', async () => {
    const server = createDavServer();
    server.etagMode = 'none';
    const client = createClient(lockConfig, { fetch: server.fetch });
    await client.ensureDirectories();
    server.refusalStillMoves = true;

    await expect(client.writeState(emptyState(), null)).rejects.toThrow(/conditional-write-unsupported/);
    expect(server.directories.has(LOCK_PATH)).toBe(true);
    expect(server.files.has(STATE_PATH)).toBe(false);
  });

  // Same-size rewrites within one second share a size/mtime ETag; the content
  // digest still exposes the change.
  it('keeps a stale writer from overwriting a change behind a colliding ETag', async () => {
    const server = createDavServer();
    server.etagMode = 'size';
    const staleWriter = createClient(DAV_CONFIG, { fetch: server.fetch });
    const freshWriter = createClient(DAV_CONFIG, { fetch: server.fetch });
    await staleWriter.ensureDirectories();
    await staleWriter.writeState(emptyState({ [theme]: 'light' }), null);
    const staleBase = await readEtag(staleWriter);
    await freshWriter.writeState(emptyState({ [theme]: 'dark1' }), await readEtag(freshWriter));

    expect(server.files.get(STATE_PATH)?.etag).toBe(`"size-${encode(JSON.stringify(emptyState({ [theme]: 'light' }))).byteLength}"`);
    await expect(staleWriter.writeState(emptyState({ [theme]: 'system' }), staleBase)).rejects.toThrow(/remote-changed/);
    expect(server.state().data[theme]).toBe('dark1');
  });

  it('does not write or remove the lock while its ownership is unconfirmed', async () => {
    const server = createDavServer();
    server.etagMode = 'none';
    server.beforeRequest = (path, init) => {
      if (path.endsWith('/owner.txt') && init.method === 'GET' && path.startsWith(LOCK_PATH)) throw new Error('claim confirmation lost');
    };

    await expect(createClient(lockConfig, { fetch: server.fetch }).writeState(emptyState(), null)).rejects.toThrow(/network-error/);
    expect(server.directories.has(LOCK_PATH)).toBe(true);
    expect(server.files.has(STATE_PATH)).toBe(false);
  });

  it('remembers an uncertain claim for later release and keeps its candidate', async () => {
    const server = createDavServer();
    server.beforeRequest = (_path, init) => {
      if (init.method === 'MOVE') throw new Error('claim may still finish later');
    };

    await expect(createClient(lockConfig, { fetch: server.fetch }).writeState(emptyState(), null))
      .rejects.toMatchObject({ code: 'lock-write-uncertain', staleLock: { uncertain: true } });
    expect(server.directories.size).toBeGreaterThan(0);
    expect(server.files.has(STATE_PATH)).toBe(false);
  });

  it('reports a committed write whose release failed as written, and never deletes a lock someone else now owns', async () => {
    const server = createDavServer();
    server.etagMode = 'none';
    server.afterPut = (path) => {
      if (path.endsWith('/state.json')) server.files.set(ownerFile, { bytes: encode('other-owner') });
    };
    const client = createClient(lockConfig, { fetch: server.fetch });
    const written = await client.writeState(emptyState(), null);

    expect(written.state).toEqual(emptyState());
    expect(written.staleLock).toMatchObject({ uncertain: false });
    expect(server.directories.has(LOCK_PATH)).toBe(true);
    expect(await client.releaseStaleLock(written.staleLock)).toBe(true);
    expect(server.directories.has(LOCK_PATH)).toBe(true);
  });

  it('keeps the lock of a write whose result is unknown, even from a restarted or upgraded client, until it is released', async () => {
    const server = createDavServer();
    server.ignoreConditions = true;
    server.etagMode = 'none';
    const client = createClient(lockConfig, { fetch: server.fetch });
    await client.ensureDirectories();
    server.afterPut = (path) => {
      if (path.endsWith('/state.json')) throw new Error('response lost after server commit');
    };

    await expect(client.writeState(emptyState({ [theme]: 'dark' }), null)).rejects.toThrow(/lock-write-uncertain/);
    expect(server.directories.has(LOCK_PATH)).toBe(true);
    server.afterPut = null;
    const restarted = createClient(lockConfig, { fetch: server.fetch });
    await expect(restarted.writeState(emptyState(), await readEtag(restarted))).rejects.toThrow(/remote-locked/);
    expect(server.state().data[theme]).toBe('dark');
    server.etagMode = 'strong';
    server.ignoreConditions = false;
    const upgraded = createClient(DAV_CONFIG, { fetch: server.fetch });
    await expect(upgraded.writeState(emptyState(), await readEtag(upgraded))).rejects.toThrow(/remote-locked/);

    server.directories.delete(LOCK_PATH);
    server.beforeRequest = (path, init) => {
      if (path === LOCK_PATH && init.method === 'DELETE') throw new Error('release response lost');
    };
    const unreleased = await restarted.writeState(emptyState({ [theme]: 'light' }), await readEtag(restarted));
    expect(server.state().data[theme]).toBe('light');
    expect(server.directories.has(LOCK_PATH)).toBe(true);
    server.beforeRequest = null;
    expect(await restarted.releaseStaleLock(unreleased.staleLock)).toBe(true);
    expect(server.directories.has(LOCK_PATH)).toBe(false);
  });

  it('keeps the reason a write failed when its release fails too', async () => {
    const server = createDavServer();
    server.etagMode = 'none';
    const client = createClient(lockConfig, { fetch: server.fetch });
    await client.ensureDirectories();
    server.beforeRequest = (path, init) => {
      if (isLockMove(init)) server.replaceState(emptyState({ [language]: 'ja' }));
      if (path === LOCK_PATH && init.method === 'DELETE') throw new Error('release response lost');
    };

    await expect(client.writeState(emptyState({ [theme]: 'dark' }), null))
      .rejects.toMatchObject({ code: 'remote-changed', staleLock: { uncertain: false } });
  });

  // A MOVE that reported success without moving the candidate cannot prove
  // exclusive ownership.
  it('releases a lock it cannot prove it owns, with its candidate', async () => {
    const server = createDavServer();
    server.etagMode = 'none';
    const client = createClient(lockConfig, { fetch: server.fetch });
    await client.ensureDirectories();
    server.beforeRequest = (path, init) => {
      const lockOwner = server.files.get(ownerFile);
      if (init.method === 'GET' && /\/lock-candidate-[-\w]+\/owner\.txt$/.test(path) && lockOwner) server.files.set(path, lockOwner);
    };

    await expect(client.writeState(emptyState(), null)).rejects.toMatchObject({ diagnostic: { phase: 'move-owner' } });
    server.beforeRequest = null;
    expect(server.files.has(ownerFile)).toBe(false);
    expect([...server.files.keys()].some((path) => path.includes('lock-candidate-'))).toBe(false);
    expect(server.files.has(STATE_PATH)).toBe(false);
  });

  it('rechecks that there is still no state after taking the lock for the first write', async () => {
    const server = createDavServer();
    server.ignoreConditions = true;
    server.etagMode = 'none';
    const client = createClient(lockConfig, { fetch: server.fetch });
    await client.ensureDirectories();
    server.beforeRequest = (_path, init) => {
      if (isLockMove(init)) server.replaceState(emptyState({ [language]: 'ja' }));
    };

    await expect(client.writeState(emptyState({ [theme]: 'dark' }), null)).rejects.toThrow(/remote-changed/);
    expect(server.state().data).toEqual({ [language]: 'ja' });
    expect(server.requestCount('PUT', (path) => path.endsWith('/state.json'))).toBe(0);
  });

  it.each([401, 403, 429, 507])('releases the lock after a definite %i rejection of the write', async (status) => {
    const server = createDavServer();
    server.etagMode = 'none';
    const client = createClient(lockConfig, { fetch: server.fetch });
    await client.ensureDirectories();
    server.rejectStatePut = status;

    await expect(client.writeState(emptyState(), null)).rejects.toThrow(new RegExp(`http-${status}`));
    expect(server.directories.has(LOCK_PATH)).toBe(false);
    expect(server.files.has(STATE_PATH)).toBe(false);
    server.rejectStatePut = 0;
    await client.writeState(emptyState(), null);
  });

  it('releases the lock after a rate-limited write, which never committed', async () => {
    const server = createDavServer();
    const client = createClient(DAV_CONFIG, { fetch: server.fetch });
    await client.ensureDirectories();
    server.refuseWith = { status: 503, when: (path, method) => method === 'PUT' && path.endsWith('/state.json') };

    await expect(client.writeState(emptyState(), null)).rejects.toSatisfy((cause) =>
      Reflect.get(Object(cause), 'code') === 'http-503' && !Reflect.get(Object(cause), 'staleLock'));
    expect(server.directories.has(LOCK_PATH)).toBe(false);
    server.refuseWith = null;
    await client.writeState(emptyState(), null);
  });
});

// Locks from terminated clients are broken once the server says their owner
// file is older than the stale-lock limit; younger ones are honored.
describe('stale locks', () => {
  async function staleSetup() {
    const server = createDavServer();
    server.etagMode = 'none';
    const client = createClient(lockConfig, { fetch: server.fetch });
    await client.ensureDirectories();
    const plantLock = (lockOwner: string, age: number) => {
      server.directories.add(LOCK_PATH);
      server.files.set(ownerFile, { bytes: encode(lockOwner), modified: Date.now() - age });
    };
    return { server, client, plantLock };
  }

  it('honors a recent lock and takes over a stale one', async () => {
    const { server, client, plantLock } = await staleSetup();
    plantLock('young-owner', STALE_LOCK_MS - 60 * 1000);

    await expect(client.writeState(emptyState({ [theme]: 'dark' }), null)).rejects.toThrow(/remote-locked/);
    expect(owner(server)).toBe('young-owner');
    plantLock('old-owner', STALE_LOCK_MS + 60 * 1000);
    await client.writeState(emptyState({ [theme]: 'dark' }), null);
    expect(server.state().data[theme]).toBe('dark');
    expect(server.directories.has(LOCK_PATH)).toBe(false);
    expect([...server.files.keys()].some((path) => path.includes('lock-stale-'))).toBe(false);
  });

  it('never breaks a lock without an owner file', async () => {
    const { server, client } = await staleSetup();
    await client.writeState(emptyState(), null);
    server.directories.add(LOCK_PATH);

    await expect(client.writeState(emptyState(), await readEtag(client))).rejects.toThrow(/remote-locked/);
  });

  it('puts back a fresh lock another device took between the age check and the move', async () => {
    const { server, client, plantLock } = await staleSetup();
    await client.writeState(emptyState(), null);
    plantLock('old-owner', STALE_LOCK_MS + 60 * 1000);
    server.beforeRequest = (path, init) => {
      if (init.method === 'MOVE' && path === LOCK_PATH) server.files.set(ownerFile, { bytes: encode('fresh-owner'), modified: Date.now() });
    };

    await expect(client.writeState(emptyState(), await readEtag(client))).rejects.toThrow(/remote-locked/);
    server.beforeRequest = null;
    expect(owner(server)).toBe('fresh-owner');
  });

  // Nutstore sends no Last-Modified with GET, which once left a stale lock in
  // place forever. The age comes from PROPFIND instead.
  it('dates a lock by PROPFIND without Last-Modified, and removes abandoned candidates with it', async () => {
    const { server, client, plantLock } = await staleSetup();
    await client.writeState(emptyState(), null);
    server.omitLastModified = true;
    plantLock('young-owner', STALE_LOCK_MS - 60 * 1000);

    await expect(client.writeState(emptyState(), await readEtag(client))).rejects.toThrow(/remote-locked/);
    const abandoned = '/dav/lumno/v1/lock-candidate-abandoned/';
    const inFlight = '/dav/lumno/v1/lock-candidate-in-flight/';
    server.directories.add(abandoned);
    server.directoryTimes.set(abandoned, Date.now() - STALE_LOCK_MS - 1000);
    server.files.set(`${abandoned}owner.txt`, { bytes: encode('abandoned'), modified: Date.now() - STALE_LOCK_MS - 1000 });
    server.directories.add(inFlight);
    server.directoryTimes.set(inFlight, Date.now());
    plantLock('old-owner', STALE_LOCK_MS + 60 * 1000);
    await client.writeState(emptyState({ [theme]: 'light' }), await readEtag(client));

    expect(server.state().data[theme]).toBe('light');
    expect(server.directories.has(abandoned)).toBe(false);
    expect(server.files.has(`${abandoned}owner.txt`)).toBe(false);
    expect(server.directories.has(inFlight)).toBe(true);
  });

  it('keeps its own lock after an uncertain write until that write must have settled', async () => {
    const { server, client, plantLock } = await staleSetup();
    const marker = { owner: 'aaaa-bbbb', at: Date.now(), uncertain: true };
    plantLock(marker.owner, 0);

    expect(await client.releaseStaleLock(marker)).toBe(false);
    expect(server.directories.has(LOCK_PATH)).toBe(true);
    expect(await client.releaseStaleLock(marker, Date.now() + STALE_LOCK_MS)).toBe(true);
    expect(server.files.has(ownerFile)).toBe(false);
  });
});
