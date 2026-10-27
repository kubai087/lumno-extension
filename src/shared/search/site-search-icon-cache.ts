// The site search provider icons saved on this device, as a surface holds
// them: read once, and replaced whenever the stored copy changes. A change
// bumps the revision, so a read that started before it does not overwrite
// the newer icons when it lands.
import type { ShortcutFaviconStore } from '../../platform/shortcut-favicon-store';
import * as ShortcutIconCache from '../../domain/favicon/shortcut-favicon/persisted';
import type { CachedIconMap } from '../../domain/favicon/shortcut-favicon/types';

type IconStore = Pick<ShortcutFaviconStore, 'readAll' | 'storageKey' | 'cacheOptions'>;

class SiteSearchIconCache {
  readonly storageKey: string;
  private readonly store: IconStore;
  private readonly now: () => number;
  private cache: CachedIconMap = {};
  private read = false;
  private revision = 0;
  private loading: Promise<CachedIconMap> | null = null;

  constructor(store: IconStore, now: () => number = Date.now) {
    this.store = store;
    this.storageKey = store.storageKey;
    this.now = now;
  }

  // The icons once read; none before.
  get icons(): CachedIconMap {
    return this.read ? this.cache : {};
  }

  get loaded(): boolean {
    return this.read;
  }

  // Resolves with the icons; a failed read leaves none rather than failing.
  load(): Promise<CachedIconMap> {
    if (this.read) {
      return Promise.resolve(this.cache);
    }
    if (this.loading) {
      return this.loading;
    }
    const loadRevision = this.revision;
    const settle = (cache: CachedIconMap): CachedIconMap => {
      if (this.revision === loadRevision) {
        this.cache = cache;
      }
      this.read = true;
      return this.cache;
    };
    this.loading = this.store.readAll().then(settle, (): CachedIconMap => settle({}));
    return this.loading;
  }

  // The stored copy changed (newValue of a storage change): it replaces the
  // icons now, and outranks any read still underway.
  applyStored(value: unknown): CachedIconMap {
    const cache = ShortcutIconCache.normalizeCacheMap(value, this.now(), this.store.cacheOptions);
    this.cache = cache;
    this.read = true;
    this.revision += 1;
    this.loading = Promise.resolve(cache);
    return cache;
  }
}

export { SiteSearchIconCache };
