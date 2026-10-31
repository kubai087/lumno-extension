// This device's settings, complete shortcut list and, when asked, its
// wallpapers and shortcut icons, read into a snapshot for a settings file
// and written back from one. A snapshot is a WebDAV state, so a file
// carries what WebDAV carries and is checked by the same rules; its images
// travel inside it instead of beside it.
import * as LumnoSettings from '../domain/settings';
import type { StorageAreaLike, StorageItems } from '../domain/storage-port';
import type { GroupedShortcutItem } from '../domain/shortcuts/types';
import { addDeviceMedia, chooseStateVersion, createDeviceState, insertLocalFolders, splitDeviceShortcuts } from '../domain/webdav/device-state';
import type { DeviceWallpaper } from '../domain/webdav/device-state';
import { checkImage, decodeBase64, encodeBase64, toDataUrl } from '../domain/webdav/images';
import { ICONS_KEY, LOCAL_PREFERENCE_KEYS, LOCAL_WALLPAPER_KEY, MAX_SHORTCUTS, PREFERENCE_KEYS, WebDavContractError, collectAssets, isObject } from '../domain/webdav/state-base';
import type { WebDavAsset, WebDavState } from '../domain/webdav/types';
import { validateState } from '../domain/webdav/validation';
import type { ProviderStorageRuntime } from './settings-storage';
import { createShortcutListStorage } from './shortcut-list-storage';
import type { ShortcutListChromeApi } from './shortcut-list-storage';
import { callStorage, isRecord } from './storage-call';

// What a snapshot holds besides the settings and the shortcut list.
interface SnapshotIncludes {
  wallpapers: boolean;
  icons: boolean;
}

interface DeviceSnapshot {
  state: WebDavState;
  includes: SnapshotIncludes;
  // Each image the state refers to, base64 encoded, by its SHA-256 hash.
  files: Record<string, string>;
}

// A snapshot read from a file: its images as data URLs by hash, ready to
// store.
interface ParsedSnapshot {
  state: WebDavState;
  includes: SnapshotIncludes;
  images: Map<string, string>;
}

// The wallpapers this device keeps, as the page's wallpaper store has them.
interface SnapshotWallpaperStore {
  readAll(): Promise<Array<DeviceWallpaper & { sampleDataUrl?: string; width: number; height: number }>>;
  replaceAll(records: ReadonlyArray<DeviceWallpaper & { key?: string; imageDataUrl: string; thumbnailDataUrl: string; width: number; height: number }>): Promise<void>;
}

interface DeviceSnapshotOptions {
  chromeApi: ShortcutListChromeApi & { storage?: { local?: StorageAreaLike } };
  provider: ProviderStorageRuntime;
  wallpaperStore: SnapshotWallpaperStore;
  crypto: Crypto;
}

// What an import writes to the provider area beside the snapshot.
interface PreferenceWrite {
  payload: StorageItems;
  keysToClear: string[];
}

async function digest(crypto: Crypto, bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function pick(values: StorageItems, keys: readonly string[]): StorageItems {
  return Object.fromEntries(keys.filter((key) => Object.prototype.hasOwnProperty.call(values, key)).map((key) => [key, values[key]]));
}

function readIncludes(value: unknown): SnapshotIncludes {
  const source = isObject(value) ? value : {};
  return { wallpapers: source.wallpapers === true, icons: source.icons === true };
}

// The state with only what the snapshot says it holds: a file that leaves
// out the wallpapers also leaves out which of them is selected.
function limitToIncludes(state: WebDavState, includes: SnapshotIncludes): WebDavState {
  const { [LOCAL_WALLPAPER_KEY]: _selection, ...data } = state.data;
  return {
    ...state,
    data: includes.wallpapers ? state.data : data,
    icons: includes.icons ? state.icons : {},
    wallpapers: includes.wallpapers ? state.wallpapers : [],
    assets: {}
  };
}

function createDeviceSnapshots(options: DeviceSnapshotOptions) {
  const { chromeApi, provider, wallpaperStore, crypto } = options;
  const localArea = chromeApi.storage && chromeApi.storage.local ? chromeApi.storage.local : null;
  const shortcutList = createShortcutListStorage({ chromeApi, provider });

  async function read(area: StorageAreaLike | null, keys: string[]): Promise<StorageItems> {
    if (!area) return {};
    const result = await callStorage(chromeApi, (done) => area.get(keys, done));
    return isRecord(result) ? result : {};
  }

  async function write(area: StorageAreaLike | null, items: StorageItems): Promise<void> {
    if (!area || !Object.keys(items).length) return;
    await callStorage(chromeApi, (done) => area.set(items, done));
  }

  async function capture(includes: SnapshotIncludes): Promise<DeviceSnapshot> {
    await provider.ready;
    const values = await read(provider.area, [...LumnoSettings.BROWSER_SYNC_KEYS]);
    const local = await read(localArea, [...LOCAL_PREFERENCE_KEYS, ICONS_KEY]);
    const list = await shortcutList.read();
    // Another device's browser sync save has only partly arrived.
    if (list.state.torn) throw new Error('incomplete-shortcuts');
    const { regular } = splitDeviceShortcuts(list.state.items);
    const version = chooseStateVersion(list.state.groups, regular, 1);
    const state = limitToIncludes(createDeviceState(values, local, list.state.groups, regular, version), includes);
    const files: Record<string, string> = {};
    const validated = await addDeviceMedia(state, includes.icons ? local[ICONS_KEY] : {},
      new Set(regular.map((item) => item.id)), includes.wallpapers ? await wallpaperStore.readAll() : [], {
        digest: (bytes) => digest(crypto, bytes),
        keep: async (hash, bytes) => { files[hash] = encodeBase64(bytes); }
      });
    return { state: validated, includes, files };
  }

  // The bytes of one asset from the file, checked against its hash.
  async function readFile(files: Record<string, unknown>, hash: string, asset: WebDavAsset): Promise<Uint8Array<ArrayBuffer>> {
    const text = files[hash];
    if (typeof text !== 'string') throw new WebDavContractError('invalid-asset');
    const bytes = decodeBase64(text);
    if (bytes.byteLength !== asset.size || await digest(crypto, bytes) !== hash) throw new WebDavContractError('invalid-asset');
    checkImage(bytes, asset.mime);
    return bytes;
  }

  // A snapshot read from a file, checked as a WebDAV state is, with each
  // image it includes as a data URL. Throws a WebDavContractError.
  async function parse(value: unknown): Promise<ParsedSnapshot> {
    if (!isObject(value)) throw new WebDavContractError('invalid-state');
    const includes = readIncludes(value.includes);
    const full = validateState(value.state);
    const state = limitToIncludes(full, includes);
    const assets = collectAssets({ ...state, assets: full.assets });
    const files = isObject(value.files) ? value.files : {};
    const images = new Map<string, string>();
    for (const [hash, asset] of Object.entries(assets)) {
      images.set(hash, toDataUrl(await readFile(files, hash, asset), asset.mime));
    }
    return { state: { ...state, assets }, includes, images };
  }

  async function writeWallpapers(state: WebDavState, images: Map<string, string>): Promise<void> {
    const imported = new Map(state.wallpapers.map((wallpaper) => [wallpaper.id, {
      id: wallpaper.id, key: wallpaper.id, name: wallpaper.name, width: wallpaper.width, height: wallpaper.height,
      updatedAt: wallpaper.updatedAt, imageDataUrl: images.get(wallpaper.image) || '', thumbnailDataUrl: images.get(wallpaper.thumbnail) || ''
    }]));
    // Wallpapers this device has and the file does not stay.
    const kept = (await wallpaperStore.readAll()).filter((record) => !imported.has(record.id)).map((record) => ({
      ...record, imageDataUrl: String(record.imageDataUrl), thumbnailDataUrl: String(record.thumbnailDataUrl)
    }));
    await wallpaperStore.replaceAll([...kept, ...imported.values()]);
  }

  async function writeShortcuts(state: WebDavState): Promise<GroupedShortcutItem[]> {
    const current = await shortcutList.read();
    const { folders, order } = splitDeviceShortcuts(current.state.items);
    const items = insertLocalFolders(state.shortcuts, folders, order);
    if (items.length > MAX_SHORTCUTS) throw new Error('shortcut-capacity');
    await shortcutList.write({ groups: state.groups, items, migratedAt: current.state.migratedAt });
    return folders;
  }

  async function importedIcons(state: WebDavState, images: Map<string, string>, folders: GroupedShortcutItem[]): Promise<StorageItems> {
    const stored = (await read(localArea, [ICONS_KEY]))[ICONS_KEY];
    const current = isObject(stored) ? stored : {};
    // This device's own bookmark folders keep their icons.
    const icons: StorageItems = pick(current, folders.map((item) => item.id));
    Object.entries(state.icons).forEach(([id, hash]) => { icons[id] = images.get(hash); });
    return { [ICONS_KEY]: icons };
  }

  // Writes the snapshot, then the settings: images first, so a file whose
  // wallpapers cannot be stored changes nothing else.
  async function apply(parsed: ParsedSnapshot, preferences: PreferenceWrite): Promise<void> {
    const { state, includes, images } = parsed;
    await provider.ready;
    if (includes.wallpapers) await writeWallpapers(state, images);
    const folders = await writeShortcuts(state);
    const local: StorageItems = {
      ...pick(state.data, LOCAL_PREFERENCE_KEYS),
      ...(includes.icons ? await importedIcons(state, images, folders) : {}),
      ...(includes.icons || includes.wallpapers ? { [LumnoSettings.assetRevision.key]: crypto.randomUUID() } : {})
    };
    await write(localArea, local);
    await write(provider.area, preferences.payload);
    if (preferences.keysToClear.length) {
      await callStorage(chromeApi, (done) => provider.area.remove(preferences.keysToClear, done));
    }
  }

  // The settings a snapshot sets in the provider area, for the import to plan.
  function preferences(parsed: Pick<ParsedSnapshot, 'state'>): StorageItems {
    return pick(parsed.state.data, PREFERENCE_KEYS);
  }

  return Object.freeze({ capture, parse, preferences, apply });
}

type DeviceSnapshots = ReturnType<typeof createDeviceSnapshots>;

export { createDeviceSnapshots };
export type { DeviceSnapshot, DeviceSnapshotOptions, DeviceSnapshots, ParsedSnapshot, PreferenceWrite, SnapshotIncludes, SnapshotWallpaperStore };
