// scripts/dev/probe-webdav.js, the standalone provider diagnostics a
// maintainer runs against a real server: it reports what the connection test
// would decide, and its report never carries credentials or server bodies.
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { DAV_CONFIG, createDavServer, type DavServer } from '../fakes/webdav';

interface ProbeReport {
  connection: { ok: boolean; error?: string };
  directoryMove: { exclusive: boolean; statuses: number[]; untouched: boolean };
}

// The probe's fetch: what the extension's WebDAV client calls.
type ProbeFetch = (url: string, init: RequestInit) => Promise<Response>;
type ProbeProvider = (input: unknown, options: { fetch: ProbeFetch }) => Promise<ProbeReport>;

function isProbeProvider(value: unknown): value is ProbeProvider {
  return typeof value === 'function';
}

const probeScript: unknown = createRequire(import.meta.url)('../../scripts/dev/probe-webdav.js');
const probeProvider = typeof probeScript === 'object' && probeScript !== null && 'probeProvider' in probeScript &&
  isProbeProvider(probeScript.probeProvider) ? probeScript.probeProvider : null;

function probe(input: unknown, fetchFn: ProbeFetch): Promise<ProbeReport> {
  if (!probeProvider) {
    throw new Error('scripts/dev/probe-webdav.js exports no probeProvider.');
  }
  return probeProvider(input, { fetch: fetchFn });
}

// Arms a server change for the standalone MOVE race, which runs after the
// connection test has deleted its probe file.
function afterConnectionTest(server: DavServer, setup: () => void): void {
  server.beforeRequest = (path, init) => {
    if (init?.method === 'DELETE' && /\/probe-[-\w]+\.txt$/.test(path)) {
      server.beforeRequest = null;
      setup();
    }
  };
}

describe('the WebDAV provider probe', () => {
  it('finds an exclusive directory MOVE on a server with racy collections and a 409 refusal', async () => {
    const server = createDavServer();
    server.ignoreConditions = true;
    server.unsafeCollections = true;
    server.moveConflictStatus = 409;

    const report = await probe(DAV_CONFIG, server.fetch);

    expect(report.connection.ok).toBe(true);
    expect(report.directoryMove.exclusive).toBe(true);
    const text = JSON.stringify(report);
    expect(text).not.toContain('app-password');
    expect(text).not.toContain(Buffer.from('user:app-password').toString('base64'));
    expect(text).not.toContain('lumno-probe-owner');
  });

  it('keeps credentials a server reflects in its headers or body out of the report', async () => {
    const reflected = await probe(DAV_CONFIG, async () => new Response('user:app-password', {
      status: 401,
      headers: { ETag: '"app-password"' }
    }));

    expect(reflected.connection.error).toBe('http-401');
    expect(JSON.stringify(reflected)).not.toContain('app-password');
  });

  it('rejects a server whose MOVE overwrites the target', async () => {
    const server = createDavServer();
    server.unsafeCollections = true;
    server.ignoreMoveOverwrite = true;

    expect((await probe(DAV_CONFIG, server.fetch)).directoryMove.exclusive).toBe(false);
  });

  it.each([405, 423, 500])('accepts a verified %i refusal of the losing MOVE', async (status) => {
    const server = createDavServer();
    server.moveConflictStatus = status;

    expect((await probe(DAV_CONFIG, server.fetch)).directoryMove.exclusive).toBe(true);
  });

  it('accepts a double refusal only while both contenders keep their content', async () => {
    const server = createDavServer();
    server.refuseMoves = 2;
    afterConnectionTest(server, () => { server.refuseMoves = 2; });

    const doubleRefusal = (await probe(DAV_CONFIG, server.fetch)).directoryMove;
    expect([doubleRefusal.statuses, doubleRefusal.untouched, doubleRefusal.exclusive]).toEqual([[500, 500], true, true]);

    afterConnectionTest(server, () => {
      server.refuseMoves = 2;
      server.loseMoveSource = true;
    });
    expect((await probe(DAV_CONFIG, server.fetch)).directoryMove.exclusive).toBe(false);
  });
});
