// Reading untyped values: stored records, errors and Options requests.
import { diagnostic } from '../webdav-client/errors';
import type { WebDavReply, WebDavRequest } from '../../domain/messages';
import type { Session, StoredConnection } from './types';
import * as WebDavConflicts from '../../domain/webdav/conflicts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

// The code a failure carries: the client's, the contract's or a sync step's.
function errorCode(cause: unknown): string {
  return isRecord(cause) && typeof cause.code === 'string' ? cause.code : '';
}

// A failure the round already put on the connection's card.
function isRecorded(cause: unknown): boolean {
  return isRecord(cause) && cause.recorded === true;
}

function errorField(cause: unknown, key: string): unknown {
  return isRecord(cause) ? cause[key] : undefined;
}

// Node test timers keep the process alive unless unreferenced.
function unrefTimer(timer: unknown): void {
  if (isRecord(timer) && 'unref' in timer && typeof timer.unref === 'function') timer.unref();
}

function ignoreRejection(value: unknown): void {
  void Promise.resolve(value).catch(() => {});
}

function isArrayBufferBytes(value: unknown): value is Uint8Array<ArrayBuffer> {
  return value instanceof Uint8Array && value.buffer instanceof ArrayBuffer;
}

// A folder named by its portable reference syncs; one named by this
// device's bookmark id stays local.
function readStoredConnection(value: unknown): StoredConnection | null {
  if (!isRecord(value) || typeof value.endpoint !== 'string' || typeof value.directory !== 'string' ||
      typeof value.username !== 'string' || typeof value.password !== 'string') return null;
  const connection: StoredConnection = {
    endpoint: value.endpoint,
    directory: value.directory,
    username: value.username,
    password: value.password,
    enabled: value.enabled === true,
    concurrency: value.concurrency === 'collection-lock' ? 'collection-lock' : 'conditional',
    lockStrategy: value.lockStrategy === 'collection-create' ? 'collection-create' : 'collection-move'
  };
  if (typeof value.clientRevision === 'string') connection.clientRevision = value.clientRevision;
  return connection;
}

function readSession(value: unknown): Session {
  return isRecord(value)
    ? { config: readStoredConnection(value.config), base: value.base === undefined ? null : value.base }
    : { config: null, base: null };
}

function readStateVersion(base: unknown): number {
  return isRecord(base) && typeof base.version === 'number' && base.version ? base.version : 1;
}

function isTrustedSender(
  chromeApi: { runtime: { id: string; getURL(path: string): string } },
  sender: { id?: string; url?: string } | null | undefined
): boolean {
  const page = String(sender && sender.url || '').split(/[?#]/)[0];
  return Boolean(sender && sender.id === chromeApi.runtime.id && page === chromeApi.runtime.getURL('src/options/options.html'));
}

// Rebuilds the request from a runtime message; null when it names no known
// operation or one of its fields has the wrong type.
function readWebDavRequest(message: Record<string, unknown>): WebDavRequest | null {
  const operation = WebDavConflicts.readWebDavOperation(message.operation);
  if (!operation) return null;
  const { id, config, decision, enable, resume } = message;
  const request: WebDavRequest = { operation };
  if (id !== undefined) {
    if (typeof id !== 'string') return null;
    request.id = id;
  }
  if (config !== undefined) {
    if (!isRecord(config)) return null;
    request.config = config;
  }
  if (decision !== undefined) {
    if (typeof decision !== 'string') return null;
    request.decision = decision;
  }
  if (enable !== undefined) {
    if (typeof enable !== 'boolean') return null;
    request.enable = enable;
  }
  if (resume !== undefined) {
    if (typeof resume !== 'boolean') return null;
    request.resume = resume;
  }
  return request;
}

// The reply for a request that failed: its code and redacted diagnostic.
function failureReply(cause: unknown): WebDavReply {
  return { ok: false, error: errorCode(cause) || 'sync-failed',
    diagnostic: diagnostic(errorField(cause, 'diagnostic')) };
}

export {
  errorCode,
  errorField,
  failureReply,
  ignoreRejection,
  isArrayBufferBytes,
  isRecord,
  isRecorded,
  isTrustedSender,
  readSession,
  readStateVersion,
  readStoredConnection,
  readWebDavRequest,
  unrefTimer
};
