// Online wallpapers (Bing photos, curated photos and prints, links) in tests
// of the wallpaper runtime: this device's image cache and local library as
// in-memory stand-ins, and the network as a recording fetch. A test file that
// uses them mocks '../../shared/wallpaper-caches' and
// '../../shared/wallpaper-local-store' with vi.fn around the real factories.
import { vi } from 'vitest';
import * as WALLPAPER_CACHES from '../../../src/shared/wallpaper-caches';
import type { WallpaperImageCache, WallpaperThumbnailCache } from '../../../src/shared/wallpaper-caches';
import * as WALLPAPER_LOCAL_STORE from '../../../src/shared/wallpaper-local-store';
import * as REMOTE_CONTENT from '../../../src/newtab/remote-content';
import type { WallpaperLocalStore, WallpaperRecord, WallpaperRecordInput } from '../../../src/shared/wallpaper-records';
import type { BrowserFake } from '../browser';
import { STORAGE_KEYS } from './runtime';

type CacheRecord = Record<string, unknown> & { id: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCacheRecord(value: unknown): value is CacheRecord {
  return isRecord(value) && typeof value.id === 'string';
}

// A field of a stored value, or undefined.
function readField(value: unknown, ...path: string[]): unknown {
  return path.reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), value);
}

// Lets the tasks the runtime queued run.
async function settle(rounds = 10): Promise<void> {
  for (let round = 0; round < rounds; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

// The wallpaper this device picked: an online pick, else the shared key.
function readPickedWallpaper(browser: BrowserFake): unknown {
  const sync = browser.storage.sync.values;
  return readField(sync[STORAGE_KEYS.onlineWallpaper], 'value') || sync[STORAGE_KEYS.wallpaper];
}

// Puts the real remote client, caches and library back (restoreMocks leaves
// vi.fn implementations as the last test set them).
function resetOnlineMocks(): void {
  [
    REMOTE_CONTENT.createClient,
    WALLPAPER_CACHES.createWallpaperImageCache,
    WALLPAPER_CACHES.createWallpaperThumbnailCache,
    WALLPAPER_LOCAL_STORE.createWallpaperLocalStore
  ].forEach((factory) => {
    if (vi.isMockFunction(factory)) factory.mockReset();
  });
}

// The image cache, kept in memory, as the runtime's copies use it.
function useImageCache(records: readonly CacheRecord[] = []): Map<string, CacheRecord> {
  const images = new Map(records.map((record) => [record.id, record]));
  const cache: WallpaperImageCache = {
    readByIds: async (ids) => (Array.isArray(ids) ? ids : []).flatMap((id) => {
      const record = typeof id === 'string' ? images.get(id) : undefined;
      return record ? [record] : [];
    }),
    write: async (record) => {
      if (isCacheRecord(record)) images.set(record.id, record);
    },
    remove: async (id) => {
      if (typeof id === 'string') images.delete(id);
    },
    keys: async () => Array.from(images.keys())
  };
  vi.mocked(WALLPAPER_CACHES.createWallpaperImageCache).mockImplementation(() => cache);
  return images;
}

// The tile thumbnail cache, kept in memory.
function useThumbnailCache(): Map<string, CacheRecord> {
  const thumbs = new Map<string, CacheRecord>();
  const cache: WallpaperThumbnailCache = {
    readByIds: async (ids) => (Array.isArray(ids) ? ids : []).flatMap((id) => {
      const record = typeof id === 'string' ? thumbs.get(id) : undefined;
      return record ? [record] : [];
    }),
    write: async (record) => {
      thumbs.set(record.id, record);
    }
  };
  vi.mocked(WALLPAPER_CACHES.createWallpaperThumbnailCache).mockImplementation(() => cache);
  return thumbs;
}

const LINK_IMAGE_DATA_URL = 'data:image/webp;base64,bGluaw==';

interface LibraryOptions {
  // The files built into records, by name and type.
  built?: Array<{ name: string; type: string }>;
  // The record a downloaded file becomes; a fixed link image by default.
  buildRecord?(file: File): Promise<WallpaperRecordInput>;
  buildTileThumbnail?(blob: Blob): Promise<string>;
  // Uploads the library holds, and the ids each targeted read asked for.
  records?: WallpaperRecord[];
  reads?: unknown[][];
}

// The local wallpaper library, kept in memory; network images are built
// into records through it, but never written to it.
function useLocalLibrary(options: LibraryOptions = {}): void {
  const records = options.records || [];
  const store: WallpaperLocalStore = {
    isCustomWallpaperId: (id) => typeof id === 'string' && id.startsWith('custom-wallpaper-'),
    normalizeRecord: (record) => {
      if (!isRecord(record) || typeof record.imageDataUrl !== 'string' || !record.imageDataUrl) return null;
      const id = String(record.id || '');
      return {
        id,
        key: String(record.key || id),
        name: String(record.name || ''),
        imageDataUrl: record.imageDataUrl,
        thumbnailDataUrl: String(record.thumbnailDataUrl || record.imageDataUrl),
        sampleDataUrl: String(record.sampleDataUrl || ''),
        width: Number(record.width) || 0,
        height: Number(record.height) || 0,
        updatedAt: Number(record.updatedAt) || 1
      };
    },
    readAll: async () => records,
    readByIds: async (ids) => {
      const requested = Array.isArray(ids) ? ids.slice() : [];
      if (options.reads) options.reads.push(requested);
      return records.filter((record) => requested.includes(record.id));
    },
    write: () => {
      throw new Error('Network images must stay out of the custom wallpaper library');
    },
    remove: async () => {},
    replaceAll: async () => {},
    buildRecordFromFile: (file) => {
      if (!file) return Promise.reject(new Error('No file.'));
      if (options.built) options.built.push({ name: file.name, type: file.type });
      return options.buildRecord ? options.buildRecord(file) : Promise.resolve({
        id: 'custom-wallpaper-unused',
        name: file.name,
        imageDataUrl: LINK_IMAGE_DATA_URL,
        thumbnailDataUrl: 'data:image/webp;base64,dGh1bWI=',
        width: 0,
        height: 0,
        updatedAt: 1
      });
    },
    buildTileThumbnail: options.buildTileThumbnail || (async () => '')
  };
  vi.mocked(WALLPAPER_LOCAL_STORE.createWallpaperLocalStore).mockImplementation(() => store);
}

// A response holding an image. Node's Response reads no JSDOM Blob, and the
// page's File takes no Node Blob, so the body is read as the page's Blob.
function imageResponse(body: BlobPart, type = 'image/jpeg'): Response {
  const response = new Response(null, { status: 200 });
  response.blob = async () => new Blob([body], { type });
  return response;
}

// A network that answers every request with `body`, recording the URLs.
function createNetwork(body: (url: string) => BlobPart = () => 'photo', type = 'image/jpeg') {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const held = new Map<string, () => void>();
  const holds = new Set<string>();
  const fetchRemoteContent = async (url: string, init: RequestInit): Promise<Response> => {
    requests.push({ url, init });
    if (holds.has(url)) {
      await new Promise<void>((resolve) => held.set(url, resolve));
    }
    return imageResponse(body(url), type);
  };
  return {
    requests,
    urls: () => requests.map((request) => request.url),
    fetchRemoteContent,
    // Downloads of `url` wait until release(url).
    hold(url: string) {
      holds.add(url);
    },
    release(url: string) {
      holds.delete(url);
      const resolve = held.get(url);
      held.delete(url);
      if (resolve) resolve();
    }
  };
}

// A copy whose data URL names its source, so a test can tell copies apart.
function copyDataUrl(sourceUrl: string): string {
  return `data:image/webp;base64,${btoa(sourceUrl)}`;
}

function copyRecord(photo: { id: string; imageUrl?: string }): CacheRecord {
  const dataUrl = copyDataUrl(photo.imageUrl || '');
  return { id: photo.id, url: photo.imageUrl || '', imageDataUrl: dataUrl, thumbnailDataUrl: `${dataUrl}#thumb` };
}

// Builds each downloaded file into a copy named after its contents.
async function buildCopyFromFile(file: File): Promise<WallpaperRecordInput> {
  const dataUrl = copyDataUrl(await file.text());
  return { id: 'custom-wallpaper-unused', name: file.name, imageDataUrl: dataUrl, thumbnailDataUrl: `${dataUrl}#thumb`, width: 0, height: 0, updatedAt: 1 };
}

export {
  LINK_IMAGE_DATA_URL,
  buildCopyFromFile,
  copyDataUrl,
  copyRecord,
  createNetwork,
  imageResponse,
  readField,
  readPickedWallpaper,
  resetOnlineMocks,
  settle,
  useImageCache,
  useLocalLibrary,
  useThumbnailCache
};
export type { CacheRecord };
