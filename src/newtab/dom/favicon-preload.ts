// Shows the New Tab favicon this device chose before the page's own scripts
// run: the copy cached in localStorage at once, then the stored choice.
// The wallpaper runtime's favicon chooser applies the definitive one after boot.
import { getPageFaviconLink } from './page-favicon-link';
import { NEWTAB_FAVICON_OPTIONS } from '../wallpaper/wallpaper-options';
import { newtabFavicon, newtabFaviconPreload } from '../../domain/settings/newtab-wallpaper';
import { getExtensionResourceUrl } from '../../platform/extension-url';
import * as ProviderStorage from '../../platform/provider-storage';

function findFavicon(value: unknown) {
  const id = String(value || '').trim();
  return NEWTAB_FAVICON_OPTIONS.find((item) => item.id === id) || null;
}

function readCachedFaviconId(): string {
  try {
    return window.localStorage ? window.localStorage.getItem(newtabFaviconPreload.key) || '' : '';
  } catch {
    return '';
  }
}

function cacheFaviconId(id: string): void {
  try {
    if (window.localStorage) {
      window.localStorage.setItem(newtabFaviconPreload.key, id);
    }
  } catch {
    // Ignore private-mode or quota failures; the runtime still applies the favicon later.
  }
}

function applyFavicon(value: unknown): void {
  const item = findFavicon(value);
  const link = item ? getPageFaviconLink(document) : null;
  if (!item || !link) {
    return;
  }
  link.setAttribute('rel', 'icon');
  link.setAttribute('type', item.type);
  link.setAttribute('href', getExtensionResourceUrl(item.file));
  link.setAttribute('data-newtab-favicon-id', item.id);
  if (item.sizes) {
    link.setAttribute('sizes', item.sizes);
  } else {
    link.removeAttribute('sizes');
  }
}

function applyStoredFavicon(): void {
  applyFavicon(readCachedFaviconId());
  try {
    const storage = ProviderStorage.createProviderStorageRuntime(window.chrome).area;
    if (!storage || typeof storage.get !== 'function') {
      return;
    }
    void storage.get([newtabFavicon.key], (result) => {
      const item = findFavicon(result && result[newtabFavicon.key]);
      if (item) {
        cacheFaviconId(item.id);
        applyFavicon(item.id);
      }
    });
  } catch {
    // Best-effort only; the favicon chooser applies the definitive favicon after boot.
  }
}

applyStoredFavicon();
