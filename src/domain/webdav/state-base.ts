// The keys a WebDAV state carries, the error its rules raise, and the
// helpers they share.
import * as settings from '../settings';
import type { StorageItems } from '../storage-port';
import { customQuotes } from '../settings/newtab-quote';
import { newtabShortcutIcons, newtabShortcutsLocalOverflow } from '../settings/newtab-shortcuts';
import * as ShortcutConstants from '../shortcuts/constants';
import * as ShortcutNormalize from '../shortcuts/normalize';
import * as ShortcutStoragePlan from '../shortcuts/storage-plan';
import type { ShortcutStateRead } from '../shortcuts/types';
import type { WebDavAsset, WebDavAssetMime, WebDavErrorCode, WebDavState } from './types';

class WebDavContractError extends Error {
  code: WebDavErrorCode;

  constructor(code: WebDavErrorCode) {
    super(code);
    this.code = code;
  }
}

// Grouped and legacy shortcut keys: none of them is a plain preference.
const SHORTCUT_KEYS = ShortcutConstants.SHORTCUT_STORAGE_KEYS;
const SHORTCUT_SYNC_KEYS = ShortcutConstants.SHORTCUTS_SYNC_KEYS;
const OVERFLOW_KEY = newtabShortcutsLocalOverflow.key;
// Version 3 states carry shortcut groups and more shortcuts than older
// versions accept; a state is only written as version 3 when it needs to be.
const GROUPED_STATE_VERSION = 3;
const LEGACY_MAX_SHORTCUTS = 60;
const MAX_SHORTCUTS = ShortcutConstants.DEFAULT_MAX_SHORTCUTS;
const ICONS_KEY = newtabShortcutIcons.key;
const WALLPAPER_KEY = settings.newtabWallpaper.key;
const LOCAL_WALLPAPER_KEY = settings.newtabLocalWallpaper.key;
// Browser sync stores the link list as one item of at most 8 KB.
const MAX_LINK_WALLPAPERS_BYTES = 8000;
const PREFERENCE_KEYS: readonly string[] = settings.BROWSER_SYNC_KEYS.filter((key) => !SHORTCUT_KEYS.includes(key));
const LOCAL_PREFERENCE_KEYS: readonly string[] = [LOCAL_WALLPAPER_KEY, ...settings.BOOKMARK_TOPBAR_WEBDAV_KEYS, customQuotes.key];
// Every preference this version reads and writes. A state carries its
// writer's list as `keys`, so a reader can tell a value the writer removed
// from one the writer never knew: an older version drops what it does not
// know whenever it saves. States without the list were written by 1.0.0 or
// earlier, which knew every key except these.
const KNOWN_KEYS: readonly string[] = Object.freeze([...PREFERENCE_KEYS, ...LOCAL_PREFERENCE_KEYS]);
const KEYS_UNKNOWN_TO_LEGACY_WRITERS: readonly string[] = Object.freeze([
  settings.newtabGlassStyle.key,
  settings.newtabGlassTheme.key,
  settings.newtabTimeFontSize.key,
  settings.newtabTimeOpacity.key,
  settings.newtabTimeFont.key,
  settings.newtabTimeInk.key,
  settings.newtabTime12Hour.key,
  settings.searchSourceOrder.key,
  settings.bookmarkTopbarLayout.key,
  customQuotes.key
]);
const FIELD_MERGE_KEYS: readonly string[] = [settings.newtabQuotePrefs.key,
  settings.bookmarkFolderColorRefs.key];
const MAX_STATE_BYTES = 2 * 1024 * 1024;
const MAX_ASSET_BYTES = 2 * 1024 * 1024;
const HASH_PATTERN = /^[a-f0-9]{64}$/;

function own(value: unknown, key: string): boolean {
  return Boolean(value) && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isObject(value) ? value : {};
}

function fail(code: WebDavErrorCode): never {
  throw new WebDavContractError(code);
}

function byteLength(value: unknown): number {
  return new TextEncoder().encode(String(value)).byteLength;
}

// JSON with sorted object keys, so equal values compare equal.
function canonical(value: unknown): string {
  if (typeof value === 'undefined') return 'undefined';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function equal(left: unknown, right: unknown): boolean {
  return canonical(left) === canonical(right);
}

// Both sides must still hold a record; a deleted or replaced value is a
// whole-value change. A missing base record counts as an empty one.
function fieldMergeable(key: string, base: unknown, local: unknown, remote: unknown): boolean {
  return FIELD_MERGE_KEYS.includes(key) && isObject(local) && isObject(remote) && (typeof base === 'undefined' || isObject(base));
}

function fieldNames(...records: unknown[]): string[] {
  return [...new Set(records.flatMap((record) => Object.keys(asRecord(record))))].sort();
}

function writerKnows(state: Pick<WebDavState, 'keys'>, key: string): boolean {
  return Array.isArray(state.keys) ? state.keys.includes(key) : !KEYS_UNKNOWN_TO_LEGACY_WRITERS.includes(key);
}

// The other side's value for a key, or `fallback` when its writer never
// knew the key and so has no say in it.
function sideValue(state: Pick<WebDavState, 'keys' | 'data'>, key: string, fallback: unknown): unknown {
  return writerKnows(state, key) ? state.data[key] : fallback;
}

// Same content, whichever version wrote each side. Comparing writer lists
// too would make two versions rewrite the server after each other forever.
function sameContent(left: WebDavState | null | undefined, right: WebDavState | null | undefined): boolean {
  const { keys: _leftKeys, ...leftContent } = left || {};
  const { keys: _rightKeys, ...rightContent } = right || {};
  return equal(leftContent, rightContent);
}

function readShortcutState(values: unknown, overflow: unknown): ShortcutStateRead {
  return ShortcutStoragePlan.readShortcutState(values, overflow);
}

// Whether a state needs the grouped format: real groups, or more shortcuts
// than older versions accept.
function needsGroupedState(groups: unknown, shortcuts: readonly unknown[]): boolean {
  return !ShortcutNormalize.isDefaultShortcutGroupLayout(groups) || shortcuts.length > LEGACY_MAX_SHORTCUTS;
}

function selectPreferences(values: unknown): StorageItems {
  const source = asRecord(values);
  return Object.fromEntries([...PREFERENCE_KEYS, ...LOCAL_PREFERENCE_KEYS]
    .filter((key) => own(source, key)).map((key) => [key, source[key]]));
}

// The assets the icons and wallpapers refer to, and no others.
function collectAssets(state: Omit<WebDavState, 'groups' | 'shortcuts' | 'data'>): Record<string, WebDavAsset> {
  const refs = [...Object.values(state.icons), ...state.wallpapers.flatMap((wallpaper) => [wallpaper.image, wallpaper.thumbnail])];
  return Object.fromEntries([...new Set(refs)].sort().map((hash) => [hash, state.assets[hash]]));
}

function isAssetMime(value: unknown): value is WebDavAssetMime {
  return value === 'image/png' || value === 'image/webp';
}

function isWholeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

export {
  FIELD_MERGE_KEYS,
  GROUPED_STATE_VERSION,
  HASH_PATTERN,
  ICONS_KEY,
  KEYS_UNKNOWN_TO_LEGACY_WRITERS,
  KNOWN_KEYS,
  LEGACY_MAX_SHORTCUTS,
  LOCAL_PREFERENCE_KEYS,
  LOCAL_WALLPAPER_KEY,
  MAX_ASSET_BYTES,
  MAX_LINK_WALLPAPERS_BYTES,
  MAX_SHORTCUTS,
  MAX_STATE_BYTES,
  OVERFLOW_KEY,
  PREFERENCE_KEYS,
  SHORTCUT_KEYS,
  SHORTCUT_SYNC_KEYS,
  WALLPAPER_KEY,
  WebDavContractError,
  asRecord,
  byteLength,
  canonical,
  collectAssets,
  equal,
  fail,
  fieldMergeable,
  fieldNames,
  isAssetMime,
  isObject,
  isWholeNumber,
  needsGroupedState,
  own,
  readShortcutState,
  sameContent,
  selectPreferences,
  sideValue,
  writerKnows
};
