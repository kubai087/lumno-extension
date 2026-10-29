// The wallpapers the user added: uploads kept on this device and links that
// sync, the limit they share, and whether the uploads have been read from
// the local store yet. The panel draws the library again on each change.
import { createStore } from '../../../shared/state/store';
import type { Store } from '../../../shared/state/store';
import type { WallpaperRecord } from '../../../shared/wallpaper-records';
import type { LinkWallpaperEntry } from './wallpaper-runtime-types';

const LINK_WALLPAPER_ID_PATTERN = /^link-[a-z0-9]{4,32}$/;
// Uploads and links together. A library already past this keeps every
// wallpaper; only adding stops.
const LOCAL_WALLPAPER_LIMIT = 30;

interface WallpaperLibraryState {
  uploads: WallpaperRecord[];
  // The uploads were read from the local store; until then `uploads` holds
  // only those the page picked up on the way.
  uploadsLoaded: boolean;
  links: LinkWallpaperEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isLinkWallpaperId(id: unknown): boolean {
  return LINK_WALLPAPER_ID_PATTERN.test(String(id || ''));
}

// An http(s) address without credentials, or ''.
function normalizeWallpaperUrl(value: unknown): string {
  try {
    const url = new URL(String(value || '').trim());
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

// A link's name: its file name without the extension, or its host.
function getWallpaperUrlName(url: string): string {
  try {
    const parsed = new URL(url);
    const file = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
    return (file.replace(/\.[^.]+$/, '') || parsed.hostname).slice(0, 80);
  } catch {
    return '';
  }
}

function normalizeLinks(value: unknown): LinkWallpaperEntry[] {
  const ids = new Set<string>();
  const list: unknown[] = Array.isArray(value) ? value : [];
  return list.map((item): LinkWallpaperEntry => {
    const entry = isRecord(item) ? item : {};
    return {
      id: String(entry.id || ''),
      url: normalizeWallpaperUrl(entry.url),
      addedAt: Number(entry.addedAt) || 0
    };
  }).filter((entry) => {
    if (!isLinkWallpaperId(entry.id) || !entry.url || ids.has(entry.id)) return false;
    ids.add(entry.id);
    return true;
  });
}

class WallpaperLibrary {
  readonly store: Store<WallpaperLibraryState> = createStore<WallpaperLibraryState>({
    uploads: [],
    uploadsLoaded: false,
    links: []
  });

  get state(): WallpaperLibraryState {
    return this.store.getSnapshot();
  }

  get limit(): number {
    return LOCAL_WALLPAPER_LIMIT;
  }

  isFull(): boolean {
    const { uploads, links } = this.state;
    return uploads.length + links.length >= LOCAL_WALLPAPER_LIMIT;
  }

  getUpload(id: string): WallpaperRecord | null {
    return this.state.uploads.find((item) => item && item.id === id) || null;
  }

  getLink(id: string): LinkWallpaperEntry | null {
    return this.state.links.find((item) => item.id === id) || null;
  }

  findLinkByUrl(url: string): LinkWallpaperEntry | null {
    return this.state.links.find((item) => item.url === url) || null;
  }

  // The uploads as read from the local store.
  uploadsRead(uploads: WallpaperRecord[]): void {
    this.store.setState({ uploads, uploadsLoaded: true });
  }

  // Another page changed the local store: read the uploads again.
  invalidateUploads(): void {
    this.store.setState({ uploadsLoaded: false });
  }

  setUploads(uploads: WallpaperRecord[]): void {
    this.store.setState({ uploads });
  }

  // The links as stored, normalized; whether they changed.
  restoreLinks(value: unknown): boolean {
    const links = normalizeLinks(value);
    const changed = JSON.stringify(links) !== JSON.stringify(this.state.links);
    if (changed) {
      this.store.setState({ links });
    }
    return changed;
  }

  setLinks(links: LinkWallpaperEntry[]): void {
    this.store.setState({ links });
  }
}

export { WallpaperLibrary, getWallpaperUrlName, isLinkWallpaperId, normalizeWallpaperUrl };
export type { WallpaperLibraryState };
