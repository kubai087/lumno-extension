// This device's preferences, shortcuts and images as a WebDAV state: the
// copy WebDAV sync uploads and a settings file carries. Also puts this
// device's own bookmark folders back into a shortcut list that arrives
// from elsewhere, since they never travel.
import type { StorageItems } from '../storage-port';
import type { GroupedShortcutItem, ShortcutGroup } from '../shortcuts/types';
import { decodeImage } from './images';
import type { ImageCheck } from './images';
import { GROUPED_STATE_VERSION, KNOWN_KEYS, LOCAL_PREFERENCE_KEYS, MAX_ASSET_BYTES, isObject, needsGroupedState, selectPreferences } from './state-base';
import type { WebDavAssetMime, WebDavState } from './types';
import { validateState } from './validation';

const MAX_ICON_BYTES = 96 * 1024;
const MAX_THUMBNAIL_BYTES = 160 * 1024;

// A list split into what travels and this device's own bookmark folders.
interface DeviceShortcuts {
  regular: GroupedShortcutItem[];
  folders: GroupedShortcutItem[];
  // Every id in display order, so the folders can go back where they were.
  order: string[];
}

// A wallpaper as this device's wallpaper store holds it.
interface DeviceWallpaper {
  id: string;
  name: string;
  updatedAt: number;
  imageDataUrl: unknown;
  thumbnailDataUrl: unknown;
}

// What the images need from their caller: a SHA-256 digest, and somewhere to
// put each image's bytes once it is checked.
interface MediaPorts {
  digest(bytes: Uint8Array<ArrayBuffer>): Promise<string>;
  keep(digest: string, bytes: Uint8Array<ArrayBuffer>): Promise<void>;
}

function hasFolderRef(item: GroupedShortcutItem): boolean {
  return 'folderRef' in item && Boolean(item.folderRef);
}

function splitDeviceShortcuts(items: readonly GroupedShortcutItem[]): DeviceShortcuts {
  return {
    regular: items.filter((item) => item.type !== 'folder' || hasFolderRef(item)),
    folders: items.filter((item) => item.type === 'folder' && !hasFolderRef(item)),
    order: items.map((item) => item.id)
  };
}

// The oldest format that holds the state, so older devices keep reading it.
function chooseStateVersion(groups: readonly ShortcutGroup[], regular: readonly GroupedShortcutItem[], baseVersion: number): number {
  if (baseVersion >= GROUPED_STATE_VERSION || needsGroupedState(groups, regular)) return GROUPED_STATE_VERSION;
  return regular.some((item) => item.type === 'folder') || baseVersion === 2 ? 2 : 1;
}

function pickLocalPreferences(values: StorageItems): StorageItems {
  return Object.fromEntries(LOCAL_PREFERENCE_KEYS
    .filter((key) => Object.prototype.hasOwnProperty.call(values, key)).map((key) => [key, values[key]]));
}

// The state without its images. `values` are the provider area's settings,
// `local` this device's own area.
function createDeviceState(
  values: StorageItems,
  local: StorageItems,
  groups: ShortcutGroup[],
  regular: GroupedShortcutItem[],
  version: number
): WebDavState {
  return { version, data: selectPreferences({ ...values, ...pickLocalPreferences(local) }),
    groups, shortcuts: regular, icons: {}, wallpapers: [], assets: {}, keys: [...KNOWN_KEYS] };
}

// Adds the icons of the shortcuts in `ids` and the wallpapers, each checked
// and hashed, and returns the validated state.
async function addDeviceMedia(
  state: WebDavState,
  icons: unknown,
  ids: ReadonlySet<string>,
  wallpapers: readonly DeviceWallpaper[],
  ports: MediaPorts
): Promise<WebDavState> {
  async function addAsset(dataUrl: unknown, mime: WebDavAssetMime, maximum: number): Promise<{ digest: string } & ImageCheck> {
    const { bytes, width, height } = decodeImage(dataUrl, mime, maximum);
    const digest = await ports.digest(bytes);
    state.assets[digest] = { mime, size: bytes.byteLength };
    await ports.keep(digest, bytes);
    return { digest, width, height };
  }
  for (const [id, dataUrl] of Object.entries(isObject(icons) ? icons : {})) {
    if (ids.has(id)) state.icons[id] = (await addAsset(dataUrl, 'image/png', MAX_ICON_BYTES)).digest;
  }
  for (const record of wallpapers) {
    // Wallpapers saved before dimensions were recorded read back as 0x0,
    // so the size comes from the image itself.
    const image = await addAsset(record.imageDataUrl, 'image/webp', MAX_ASSET_BYTES);
    const thumbnail = await addAsset(record.thumbnailDataUrl, 'image/webp', MAX_THUMBNAIL_BYTES);
    state.wallpapers.push({ id: record.id, name: record.name, width: image.width, height: image.height,
      updatedAt: record.updatedAt, image: image.digest, thumbnail: thumbnail.digest });
  }
  return validateState(state);
}

// A list that arrived from elsewhere, with this device's own bookmark
// folders back at their places.
function insertLocalFolders(
  items: readonly GroupedShortcutItem[],
  folders: readonly GroupedShortcutItem[],
  order: readonly string[]
): GroupedShortcutItem[] {
  const list = [...items];
  for (const folder of folders) {
    const index = order.indexOf(folder.id);
    list.splice(index < 0 ? list.length : Math.min(index, list.length), 0, folder);
  }
  return list;
}

export {
  addDeviceMedia,
  chooseStateVersion,
  createDeviceState,
  hasFolderRef,
  insertLocalFolders,
  pickLocalPreferences,
  splitDeviceShortcuts
};
export type { DeviceShortcuts, DeviceWallpaper, MediaPorts };
