// The state WebDAV carries between devices and the shapes of its merges,
// conflicts and browser sync backups.
import type { StorageItems } from '../storage-port';
import type { GroupedShortcutItem, ShortcutGroup } from '../shortcuts/types';

type WebDavAssetMime = 'image/png' | 'image/webp';

// An image stored next to the state under its SHA-256 hash.
interface WebDavAsset {
  mime: WebDavAssetMime;
  size: number;
}

interface WebDavWallpaper {
  id: string;
  name: string;
  width: number;
  height: number;
  updatedAt: number;
  // Asset hashes.
  image: string;
  thumbnail: string;
}

interface WebDavState {
  // 1: links only; 2: portable folders; 3: shortcut groups.
  version: number;
  // Preference values by storage key.
  data: StorageItems;
  groups: ShortcutGroup[];
  shortcuts: GroupedShortcutItem[];
  // Shortcut id to icon asset hash.
  icons: Record<string, string>;
  wallpapers: WebDavWallpaper[];
  assets: Record<string, WebDavAsset>;
  // Every preference key the writer knew; absent from states written by
  // 1.0.0 or earlier.
  keys?: string[];
}

type WebDavErrorCode =
  | 'invalid-state'
  | 'state-too-large'
  | 'invalid-shortcuts'
  | 'invalid-asset'
  | 'asset-too-large'
  | 'invalid-icon'
  | 'invalid-wallpaper'
  | 'merge-too-large';

// How a conflict side should resolve: take the remote or the local value,
// or report the conflict.
type MergeResolution = 'remote' | 'local' | null | undefined;

interface MergeResult {
  state: WebDavState;
  // Keys, or 'shortcuts' / 'wallpapers', both sides changed apart.
  conflicts: string[];
}

// Up to SUMMARY_NAMES display names of a set, and its size.
interface NameSample {
  names: string[];
  count: number;
}

type ValueSummary =
  | { kind: 'unset' }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'number'; value: number }
  | { kind: 'text'; value: string }
  | { kind: 'list'; count: number }
  | { kind: 'changed' };

interface ListChangeSummary {
  total: number;
  added: NameSample;
  removed: NameSample;
  changed: NameSample;
  reordered: boolean;
  // Wallpapers only: the selected wallpaper changed.
  selectionChanged?: boolean;
}

type ConflictDescription =
  | { key: 'shortcuts'; domain: 'shortcuts'; local: ListChangeSummary; remote: ListChangeSummary }
  | { key: 'wallpapers'; domain: 'wallpapers'; local: ListChangeSummary; remote: ListChangeSummary }
  | { key: string; field?: string; domain: 'preference'; local: ValueSummary; remote: ValueSummary };

interface ChromeBackupOptions {
  // chrome.storage.sync's total, per-item and item-count limits.
  quota?: number;
  itemQuota?: number;
  maxItems?: number;
}

interface ChromeBackupPlan {
  payload: StorageItems;
  remove: string[];
  // Keys that did not fit and keep their last browser sync copy.
  skipped: string[];
  complete: boolean;
}

export type {
  ChromeBackupOptions,
  ChromeBackupPlan,
  ConflictDescription,
  ListChangeSummary,
  MergeResolution,
  MergeResult,
  NameSample,
  ValueSummary,
  WebDavAsset,
  WebDavAssetMime,
  WebDavErrorCode,
  WebDavState,
  WebDavWallpaper
};
