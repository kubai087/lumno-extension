// An in-memory WebDAV server with the quirks of real providers, and devices
// (storage areas, alarms, the private store and the wallpaper library) for
// the WebDAV sync to run against.
import { afterEach, expect, vi } from 'vitest';
import { byteLength, equal } from '../../src/domain/webdav/state-base';
import type { WebDavState } from '../../src/domain/webdav/types';
import { createConnectionController } from '../../src/background/webdav-sync/connection-controller';
import type { ConnectionControllerOptions } from '../../src/background/webdav-sync/types';
import type { WallpaperRecord, WallpaperRecordInput } from '../../src/shared/wallpaper-records';

type StorageValues = Record<string, unknown>;

const DAV_CONFIG = { endpoint: 'https://dav.example.test/dav/', directory: 'lumno', username: 'user', password: 'app-password' };
const STATE_PATH = '/dav/lumno/v1/state.json';
const LOCK_PATH = '/dav/lumno/v1/write-lock/';
const AUTHORIZATION = `Basic ${btoa('user:app-password')}`;

interface DavFile {
  bytes: Uint8Array<ArrayBuffer>;
  etag?: string;
  modified?: number;
}

interface DavRequestRecord {
  path: string;
  method: string;
}

interface Refusal {
  status: number;
  retryAfter?: string;
  when?(path: string, method: string): boolean;
}

type RequestHook = (path: string, init: RequestInit) => void | Promise<void>;

function encode(text: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(text);
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function toBytes(body: BodyInit | null | undefined): Uint8Array<ArrayBuffer> {
  if (typeof body === 'string') return encode(body);
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength));
  return new Uint8Array();
}

function noRequests(): DavRequestRecord[] {
  return [];
}

function etagMode(mode: 'strong' | 'weak' | 'none' | 'size'): 'strong' | 'weak' | 'none' | 'size' {
  return mode;
}

function noHook(): RequestHook | null {
  return null;
}

function noRefusal(): Refusal | null {
  return null;
}

// The server: files and folders by path, the requests it was sent, and the
// switches for each provider quirk.
function createDavServer() {
  let revision = 0;
  const server = {
    files: new Map<string, DavFile>(),
    directories: new Set<string>(),
    directoryTimes: new Map<string, number>(),
    requests: noRequests(),
    offline: false,
    // If-Match and If-None-Match are ignored.
    ignoreConditions: false,
    // MKCOL of an existing folder succeeds.
    unsafeCollections: false,
    brokenDelete: false,
    // 'size' mimics ETags built from size and a one-second mtime (sabre/dav FSExt).
    etagMode: etagMode('strong'),
    beforeRequest: noHook(),
    afterPut: noHook(),
    rejectStatePut: 0,
    stateStatus: 0,
    ignoreMoveOverwrite: false,
    moveConflictStatus: 412,
    moveUnsupported: false,
    loseMoveSource: false,
    refuseMoves: 0,
    refusalStillMoves: false,
    refuseCollections: false,
    // Mimics Cloudflare weakening strong ETags on bodies it compresses.
    compressAbove: 0,
    // A rate limit such as Nutstore's 503 BlockedTemporarily.
    refuseWith: noRefusal(),
    // Nutstore answers GET without Last-Modified; PROPFIND still reports it.
    omitLastModified: false,
    // The server clock behind Date and Last-Modified.
    now: () => Date.now(),
    fetch,
    state,
    replaceState,
    requestCount: (method?: string, match?: (path: string) => boolean) => server.requests
      .filter((request) => (!method || request.method === method) && (!match || match(request.path))).length
  };

  function headersFor(bytes: Uint8Array | null, etag?: string, modified?: number): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Length': String(bytes ? bytes.byteLength : 0),
      Date: new Date(server.now()).toUTCString()
    };
    if (etag && server.etagMode !== 'none') {
      const weak = server.etagMode === 'weak' || (server.compressAbove > 0 && bytes !== null && bytes.byteLength > server.compressAbove);
      headers.ETag = weak ? `W/${etag}` : etag;
    }
    if (modified && !server.omitLastModified) headers['Last-Modified'] = new Date(modified).toUTCString();
    return headers;
  }

  function respond(method: string, status: number, bytes: Uint8Array<ArrayBuffer> | null = null, etag?: string, modified?: number): Response {
    const empty = status === 204 || status === 304 || method === 'HEAD';
    return new Response(empty ? null : (bytes || ''), { status, headers: headersFor(bytes, etag, modified) });
  }

  function propfind(path: string, depth: string | null): Response {
    const entries: [string, number | undefined][] = [];
    const file = server.files.get(path);
    if (file) {
      entries.push([path, file.modified]);
    } else if (server.directories.has(path)) {
      entries.push([path, server.directoryTimes.get(path)]);
      if (depth === '1') {
        const children = new Set([...server.directories, ...server.files.keys()].filter((name) => name !== path &&
          name.startsWith(path) && !name.slice(path.length).replace(/\/$/, '').includes('/')));
        // Nutstore lists child folders without their trailing slash.
        children.forEach((name) => entries.push(server.directories.has(name)
          ? [name.replace(/\/$/, ''), server.directoryTimes.get(name)]
          : [name, server.files.get(name)?.modified]));
      }
    } else {
      return respond('PROPFIND', 404);
    }
    const xml = '<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">' + entries.map(([name, time]) =>
      `<d:response><d:href>${name}</d:href><d:propstat><d:prop>${time ? `<d:getlastmodified>${new Date(time).toUTCString()}</d:getlastmodified>` : ''}</d:prop></d:propstat></d:response>`
    ).join('') + '</d:multistatus>';
    return respond('PROPFIND', 207, encode(xml));
  }

  function move(path: string, headers: Headers): Response {
    if (server.moveUnsupported) return respond('MOVE', 405);
    const destination = new URL(String(headers.get('Destination'))).pathname;
    expect(headers.get('Overwrite')).toBe('F');
    if (!server.directories.has(path)) return respond('MOVE', 404);
    const exists = server.directories.has(destination);
    const refused = server.refuseMoves > 0;
    if (refused) server.refuseMoves -= 1;
    if (refused || (exists && !server.ignoreMoveOverwrite)) {
      if (server.loseMoveSource) {
        [...server.files.keys()].filter((name) => name.startsWith(path)).forEach((name) => server.files.delete(name));
        server.directories.delete(path);
      }
      return respond('MOVE', refused ? 500 : server.moveConflictStatus);
    }
    [...server.files.keys()].filter((name) => name.startsWith(destination)).forEach((name) => server.files.delete(name));
    [...server.files].filter(([name]) => name.startsWith(path)).forEach(([name, value]) => {
      server.files.set(destination + name.slice(path.length), value);
      server.files.delete(name);
    });
    server.directories.delete(path);
    server.directories.add(destination);
    return respond('MOVE', server.refusalStillMoves ? 500 : exists ? 204 : 201);
  }

  async function fetch(url: string, init: RequestInit): Promise<Response> {
    if (server.offline) throw new Error('network is offline');
    const path = new URL(url).pathname;
    const method = String(init.method);
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe(AUTHORIZATION);
    expect(init.redirect).toBe('error');
    expect(init.credentials).toBe('omit');
    server.requests.push({ path, method });
    if (server.beforeRequest) await server.beforeRequest(path, init);
    const refusal = server.refuseWith;
    if (refusal && (!refusal.when || refusal.when(path, method))) {
      return new Response('BlockedTemporarily', { status: refusal.status, headers: refusal.retryAfter ? { 'Retry-After': refusal.retryAfter } : {} });
    }
    const entry = server.files.get(path);
    if (method === 'MKCOL') {
      if (server.refuseCollections) return respond(method, 405);
      if (server.directories.has(path) && !server.unsafeCollections) return respond(method, 405);
      server.directories.add(path);
      server.directoryTimes.set(path, server.now());
      return respond(method, 201);
    }
    if (method === 'PROPFIND') return propfind(path, headers.get('Depth'));
    if (method === 'GET' || method === 'HEAD') {
      if (server.stateStatus && path.endsWith('/state.json')) return respond(method, server.stateStatus);
      if (!entry) return respond(method, 404);
      if (headers.get('If-None-Match') === entry.etag) return respond(method, 304, null, entry.etag);
      return respond(method, 200, entry.bytes, entry.etag, entry.modified);
    }
    if (method === 'DELETE') {
      if (!server.brokenDelete) {
        [...server.files.keys()].filter((name) => name === path || (path.endsWith('/') && name.startsWith(path)))
          .forEach((name) => server.files.delete(name));
        server.directories.delete(path);
      }
      return respond(method, 204);
    }
    if (method === 'MOVE') return move(path, headers);
    expect(method).toBe('PUT');
    if (server.rejectStatePut && path.endsWith('/state.json')) return respond(method, server.rejectStatePut);
    const ifMatch = headers.get('If-Match');
    if (!server.ignoreConditions && ((ifMatch !== null && (!entry || entry.etag !== ifMatch)) ||
        (headers.get('If-None-Match') === '*' && entry))) return respond(method, 412);
    const bytes = toBytes(init.body);
    revision += 1;
    const next: DavFile = { bytes, etag: server.etagMode === 'size' ? `"size-${bytes.byteLength}"` : `"revision-${revision}"`, modified: server.now() };
    server.files.set(path, next);
    if (server.afterPut) await server.afterPut(path, init);
    return respond(method, entry ? 204 : 201, null, next.etag);
  }

  // The state file as the server holds it, read as JSON.
  function state(): WebDavStateFile {
    const file = server.files.get(STATE_PATH);
    if (!file) throw new Error('the server has no state file');
    return readStateFile(JSON.parse(decode(file.bytes)));
  }

  function replaceState(value: unknown): void {
    revision += 1;
    server.files.set(STATE_PATH, { bytes: encode(JSON.stringify(value)), etag: `"revision-${revision}"` });
  }

  return server;
}

type DavServer = ReturnType<typeof createDavServer>;

// A state file read back for assertions: its parts as plain records.
interface WebDavStateFile {
  version: number;
  data: StorageValues;
  groups: Record<string, unknown>[];
  shortcuts: Record<string, unknown>[];
  wallpapers: Record<string, unknown>[];
  assets: Record<string, unknown>;
  icons: Record<string, unknown>;
  raw: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function readStateFile(value: unknown): WebDavStateFile {
  const raw = isRecord(value) ? value : {};
  return {
    version: typeof raw.version === 'number' ? raw.version : 0,
    data: isRecord(raw.data) ? raw.data : {},
    groups: records(raw.groups),
    shortcuts: records(raw.shortcuts),
    wallpapers: records(raw.wallpapers),
    assets: isRecord(raw.assets) ? raw.assets : {},
    icons: isRecord(raw.icons) ? raw.icons : {},
    raw
  };
}

// Several servers behind one fetch, by host name.
function routeByHost(servers: Record<string, DavServer>, fallback: DavServer): Pick<DavServer, 'fetch'> {
  return { fetch: (url, init) => (servers[new URL(url).hostname] || fallback).fetch(url, init) };
}

type StorageListener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void;
type AlarmListener = (alarm: chrome.alarms.Alarm) => void;
type GetCallback = (items: StorageValues | undefined) => void;

interface DeviceInitial {
  sync?: StorageValues;
  local?: StorageValues;
}

// What the sync controllers of a device take besides their ports.
type DeviceControllerOptions = Omit<ConnectionControllerOptions, 'chrome' | 'privateStore' | 'wallpaperStore' | 'clientOptions'>;

interface DeviceOptions<C> {
  wallpapers?: WallpaperRecordInput[];
  extra?: DeviceControllerOptions;
  create?: (options: ConnectionControllerOptions) => C;
  // Runs on the device's chrome before its first controller is made.
  configure?(device: DeviceChrome): void;
}

// The extension API of one device: browser sync with its quotas, local
// storage, alarms and the runtime the keep-alive ticks.
function createDeviceChrome(initial: DeviceInitial) {
  const listeners = new Set<StorageListener>();
  const alarmListeners = new Set<AlarmListener>();
  const alarms = new Set<string>();
  const runtime: { lastError: { message: string } | null; getPlatformInfo?: () => Promise<object> } = { lastError: null };
  function area(name: 'local' | 'sync', initialValues: StorageValues) {
    const values: StorageValues = structuredClone(initialValues);
    const exceedsSyncQuota = (projected: StorageValues) => {
      const entries = Object.entries(projected).map(([key, value]) => byteLength(key) + byteLength(JSON.stringify(value)));
      return entries.some((size) => size > 8192) || entries.reduce((sum, size) => sum + size, 0) > 102400;
    };
    const storageArea = {
      values,
      QUOTA_BYTES: 102400,
      QUOTA_BYTES_PER_ITEM: 8192,
      MAX_ITEMS: 512,
      get(keys: string | string[] | null, callback: GetCallback): void {
        const names = keys === null ? Object.keys(values) : (Array.isArray(keys) ? keys : [keys]);
        callback(Object.fromEntries(names.filter((key) => Object.hasOwn(values, key)).map((key) => [key, structuredClone(values[key])])));
      },
      set(payload: StorageValues, callback?: () => void): void {
        if (name === 'sync' && exceedsSyncQuota({ ...values, ...payload })) {
          runtime.lastError = { message: 'QUOTA_BYTES exceeded' };
          if (callback) callback();
          runtime.lastError = null;
          return;
        }
        const changes: Record<string, chrome.storage.StorageChange> = {};
        Object.entries(payload).forEach(([key, value]) => {
          if (!equal(values[key], value)) changes[key] = { oldValue: values[key], newValue: structuredClone(value) };
          values[key] = structuredClone(value);
        });
        if (Object.keys(changes).length) listeners.forEach((listener) => listener(changes, name));
        if (callback) callback();
      },
      remove(keys: string | string[], callback?: () => void): void {
        const changes: Record<string, chrome.storage.StorageChange> = {};
        (Array.isArray(keys) ? keys : [keys]).forEach((key) => {
          if (Object.hasOwn(values, key)) {
            changes[key] = { oldValue: values[key] };
            delete values[key];
          }
        });
        if (Object.keys(changes).length) listeners.forEach((listener) => listener(changes, name));
        if (callback) callback();
      }
    };
    return storageArea;
  }
  return {
    runtime,
    storage: {
      local: area('local', initial.local || {}),
      sync: area('sync', initial.sync || {}),
      onChanged: {
        addListener: (listener: StorageListener) => listeners.add(listener),
        removeListener: (listener: StorageListener) => listeners.delete(listener)
      }
    },
    alarms: {
      names: alarms,
      create: (name: string) => {
        alarms.add(name);
      },
      clear: (name: string) => {
        alarms.delete(name);
      },
      onAlarm: {
        addListener: (listener: AlarmListener) => alarmListeners.add(listener),
        removeListener: (listener: AlarmListener) => alarmListeners.delete(listener)
      },
      fire: (name: string) => alarmListeners.forEach((listener) => listener({ name, scheduledTime: Date.now(), persistAcrossSessions: true }))
    }
  };
}

type DeviceChrome = ReturnType<typeof createDeviceChrome>;

interface ConnectionLike {
  start(): void;
}

// One browser profile running the WebDAV sync against a server: its chrome,
// its private store (IndexedDB in the extension) and its wallpaper library.
// Each createController() is a fresh worker over the same device.
function createDevice<C extends ConnectionLike = ReturnType<typeof createConnectionController>>(
  server: Pick<DavServer, 'fetch'>,
  initial: DeviceInitial = {},
  options: DeviceOptions<C> = {}
) {
  const deviceChrome = createDeviceChrome(initial);
  if (options.configure) options.configure(deviceChrome);
  // The controller takes the browser's own chrome type; the device stands in
  // for it as the worker's global.
  vi.stubGlobal('chrome', deviceChrome);
  const chromeApi = chrome;
  const privateValues = new Map<string, unknown>();
  const privateStore = {
    get: async (key: string): Promise<unknown> => copyStored(privateValues.get(key)),
    put: async (key: string, value: unknown): Promise<void> => {
      privateValues.set(key, copyStored(value));
    },
    delete: async (key: string): Promise<void> => {
      privateValues.delete(key);
    }
  };
  let library: WallpaperRecordInput[] = structuredClone(options.wallpapers || []);
  const wallpaperStore = {
    readAll: async (): Promise<WallpaperRecord[]> => structuredClone(library).map((record) => ({
      ...record, key: record.key || record.id, sampleDataUrl: record.sampleDataUrl || ''
    })),
    replaceAll: async (next: readonly WallpaperRecordInput[]): Promise<void> => {
      library = structuredClone([...next]);
    }
  };
  const portsFor = (): ConnectionControllerOptions => ({
    ...options.extra,
    chrome: chromeApi,
    crypto: globalThis.crypto,
    privateStore,
    wallpaperStore,
    clientOptions: { fetch: server.fetch }
  });
  const create = options.create || defaultCreate;
  const createController = (): C => create(portsFor());
  // Another kind of controller over the same device, as a later version of
  // the worker would run.
  const createWith = <D>(make: (controllerOptions: ConnectionControllerOptions) => D): D => make(portsFor());
  const controller = createController();
  controller.start();
  return { controller, createController, createWith, chrome: deviceChrome, privateValues, privateStore, wallpaperStore };

  function defaultCreate(controllerOptions: ConnectionControllerOptions): C {
    const made: unknown = createConnectionController(controllerOptions);
    if (!isConnectionLike<C>(made)) throw new Error('pass create for a controller other than the connection controller');
    return made;
  }
}

// A copy of a stored value, as IndexedDB keeps it. Bytes come back as this
// realm's Uint8Array: JSDOM's globals are not Node's, which structuredClone
// and TextEncoder build theirs from.
function copyStored(value: unknown): unknown {
  if (ArrayBuffer.isView(value)) return new Uint8Array(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  if (Array.isArray(value)) return value.map(copyStored);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyStored(item)]));
  return value;
}

function isConnectionLike<C extends ConnectionLike>(value: unknown): value is C {
  return isRecord(value) && typeof value.start === 'function';
}

// A state as a client writes it, with nothing in it but these settings.
function emptyState(data: StorageValues = {}): WebDavState {
  return { version: 1, data, groups: [], shortcuts: [], icons: {}, wallpapers: [], assets: {} };
}

// Writes to a storage area and resolves once it is done.
function storageSet(area: { set(payload: StorageValues, callback?: () => void): void }, payload: StorageValues): Promise<void> {
  return new Promise((resolve) => area.set(payload, resolve));
}

// Reads a field of an unknown record, for replies and stored records.
function field(value: unknown, ...path: string[]): unknown {
  return path.reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), value);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

export {
  DAV_CONFIG,
  LOCK_PATH,
  STATE_PATH,
  createDavServer,
  createDevice,
  decode,
  emptyState,
  encode,
  field,
  isRecord,
  routeByHost,
  storageSet
};
export type { DavServer, DeviceChrome, WebDavStateFile };
