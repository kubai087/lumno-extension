'use strict';

// Isolated provider diagnostics. Never reads Chrome storage or uploads user settings.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { importSource } = require('../node/source-module');

let clientApi = null;

// The extension's WebDAV client: the same requests, errors and diagnostics.
async function loadClientApi() {
  if (!clientApi) {
    clientApi = {
      ...await importSource('src/background/webdav-client/client.ts'),
      ...await importSource('src/background/webdav-client/config.ts'),
      ...await importSource('src/background/webdav-client/errors.ts')
    };
  }
  return clientApi;
}

async function probeProvider(input, options = {}) {
  const clientApi = await loadClientApi();
  const config = clientApi.normalizeConfig(input);
  const records = [];
  const fetchFn = options.fetch || globalThis.fetch;
  const fetchObserved = async (url, init) => {
    const pathname = new URL(url).pathname;
    const role = /\/probe-lock-[\w-]+\/$/.test(pathname) ? 'lock-directory' :
      /\/probe-[\w-]+\/owner\.txt$/.test(pathname) ? 'move-owner' :
      /\/probe-[\w-]+\/$/.test(pathname) ? 'move-directory' :
      /\/probe-[\w-]+\.txt$/.test(pathname) ? 'probe-file' : 'sync-directory';
    const record = { method: init.method, role };
    records.push(record);
    try {
      const response = await fetchFn(url, init);
      record.status = response.status;
      const etag = response.headers.get('ETag');
      record.etag = !etag ? 'none' : /^"[^"\r\n]+"$/.test(etag) ? 'strong' : 'weak-or-invalid';
      return response;
    } catch (_cause) { record.status = 0; throw clientApi.error('network-error'); }
  };
  const client = clientApi.createClient(config, { fetch: fetchObserved, timeoutMs: options.timeoutMs || 20000 });
  const report = { revision: clientApi.REVISION, connection: null, directoryMove: null, requests: records };
  try {
    report.connection = await client.testConnection();
  } catch (cause) {
    report.connection = { ok: false, error: cause.code || 'probe-failed', diagnostic: clientApi.diagnostic(cause.diagnostic) };
  }
  if (report.connection.ok || report.connection.error === 'conditional-write-unsupported') {
    const id = randomUUID();
    const sources = [`probe-${id}-a/`, `probe-${id}-b/`];
    const destination = `probe-${id}-target/`;
    const prefix = config.endpoint + [...config.directory.split('/'), 'v1'].map(encodeURIComponent).join('/') + '/';
    const contents = ['lumno-probe-owner-a', 'lumno-probe-owner-b'];
    const cleanup = [...sources, destination];
    try {
      for (let index = 0; index < sources.length; index += 1) {
        const created = await client.request(sources[index], 'MKCOL', undefined, {}, 65536);
        if (created.status !== 201) throw clientApi.error('probe-directory-failed');
        const written = await client.request(sources[index] + 'owner.txt', 'PUT', contents[index], { 'Content-Type': 'text/plain' }, 65536);
        if (![200, 201, 204].includes(written.status)) throw clientApi.error('probe-owner-failed');
      }
      const attempts = await Promise.allSettled(sources.map((source) => client.request(source, 'MOVE', undefined,
        { Destination: prefix + destination, Overwrite: 'F' }, 65536)));
      const statuses = attempts.map((attempt) => attempt.status === 'fulfilled' ? attempt.value.status : attempt.reason.status || 0);
      const winner = statuses.indexOf(201);
      let preservesWinner = false;
      let preservesLoser = false;
      if (winner >= 0) {
        const target = await client.request(destination + 'owner.txt', 'GET', undefined, {}, 65536);
        preservesWinner = target.status === 200 && new TextDecoder().decode(target.bytes) === contents[winner];
        const loser = 1 - winner;
        const remaining = await client.request(sources[loser] + 'owner.txt', 'GET', undefined, {}, 65536);
        preservesLoser = remaining.status === 200 && new TextDecoder().decode(remaining.bytes) === contents[loser];
      }
      // Nextcloud's file locking can refuse both contenders; that is exclusive
      // only while the target stays absent and both sources keep their owner.
      let untouched = false;
      if (winner < 0 && statuses.every((status) => clientApi.MOVE_REFUSALS.includes(status))) {
        const target = await client.request(destination + 'owner.txt', 'GET', undefined, {}, 65536);
        const kept = await Promise.all(sources.map(async (source, index) => {
          const remaining = await client.request(source + 'owner.txt', 'GET', undefined, {}, 65536);
          return remaining.status === 200 && new TextDecoder().decode(remaining.bytes) === contents[index];
        }));
        untouched = target.status === 404 && kept.every(Boolean);
      }
      report.directoryMove = { statuses, preservesWinner, preservesLoser, ...(winner < 0 ? { untouched } : {}),
        exclusive: untouched || (statuses.filter((status) => status === 201).length === 1 &&
          clientApi.MOVE_REFUSALS.includes(statuses[1 - winner]) && preservesWinner && preservesLoser) };
    } catch (cause) {
      report.directoryMove = { exclusive: false, error: cause.code || 'probe-failed', status: cause.status || 0 };
    } finally {
      for (const directory of cleanup) {
        await client.request(directory + 'owner.txt', 'DELETE', undefined, {}, 65536).catch(() => {});
        await client.request(directory, 'DELETE', undefined, {}, 65536).catch(() => {});
      }
    }
  }
  return report;
}

async function main() {
  const directory = path.resolve(__dirname, '../../.tmp/webdav');
  const configPath = path.join(directory, 'provider-probe.private.json');
  const resultPath = path.join(directory, 'provider-probe-result.json');
  const input = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  (await loadClientApi()).normalizeConfig(input); // A blank or invalid template remains editable.
  fs.unlinkSync(configPath); // Consume credentials before networking; never put them in a report.
  const report = await probeProvider(input);
  fs.writeFileSync(resultPath, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

if (require.main === module) main().catch((cause) => {
  // No exception message, request URL, Authorization header, or response body is logged.
  process.stderr.write(`WebDAV probe: ${cause.code || 'config-or-probe-failed'}\n`);
  process.exitCode = 1;
});
module.exports = { probeProvider };
