// The runtime instances every New Tab feature takes: the settings store and
// the dragged sliders' preview, the language, the page's root and sections,
// and the storage the settings live in.
import { bookmarkColumns, bookmarkCount, bookmarkFolderIconsVisible, newtabSearchWidth, newtabShortcutColumns, recentCount } from '../../domain/settings';
import { newtabShortcutGap, newtabShortcutSize } from '../../domain/settings/newtab-shortcuts';
import { newtabTimeFontSize, newtabTimeOpacity } from '../../domain/settings/newtab-time';
import { getContextSettingsStore } from '../../platform/settings-store';
import type { SettingsStore } from '../../platform/settings-store';
import { SurfaceLocale } from '../../shared/i18n/surface-locale';
import { getPageRoot } from '../dom/app-root';
import { loadNewtabLocaleMessages } from '../page-language';
import { createPageStructure } from '../react/page-structure';
import type { PageStructureRuntime } from '../react/page-structure';
import { SettingPreview } from '../setting-preview';
import { createStartupStorage } from './startup-storage';
import type { StartupStorage } from './startup-storage';

interface PageContext {
  settings: SettingsStore;
  preview: SettingPreview;
  locale: SurfaceLocale;
  t: SurfaceLocale['t'];
  formatMessage: SurfaceLocale['formatMessage'];
  root: HTMLElement;
  structure: PageStructureRuntime;
  providerStorageRuntime: StartupStorage['providerStorageRuntime'];
  storageArea: StartupStorage['storageArea'];
  localStorageArea: StartupStorage['storageArea'];
}

// Reads the page's settings and language and finds its root; null on a
// page without the New Tab markup. Also gives the move of settings this
// device kept locally, run once the page's parts exist.
function createPageContext(): { ctx: PageContext; migrateLocalSettings: StartupStorage['migrateLocalSettingsIfNeeded'] } | null {
  const { providerStorageRuntime, storageArea, takeStartupRead, migrateLocalSettingsIfNeeded } = createStartupStorage();
  // The page's settings, read and followed through the one store of this context.
  const settings = getContextSettingsStore(chrome, window, takeStartupRead);
  // A dragged slider's value until it is saved.
  const preview = new SettingPreview(settings);
  preview.follow([
    newtabTimeFontSize, newtabTimeOpacity, newtabShortcutColumns, newtabShortcutSize, newtabShortcutGap, newtabSearchWidth,
    recentCount, bookmarkCount, bookmarkColumns, bookmarkFolderIconsVisible
  ]);
  const root = getPageRoot(document);
  if (!root) {
    return null;
  }
  if (document.body) {
    document.body.removeAttribute('data-nt-ready');
  }
  // The page's sections and the search layer, which the features draw into.
  const structure = createPageStructure({ documentObj: document });
  const localStorageArea = (chrome && chrome.storage && chrome.storage.local) ? chrome.storage.local : storageArea;
  // The page's language; it follows the stored choice from the first read.
  const locale = new SurfaceLocale(settings, loadNewtabLocaleMessages);
  locale.follow();
  const { t, formatMessage } = locale;
  return {
    ctx: { settings, preview, locale, t, formatMessage, root, structure, providerStorageRuntime, storageArea, localStorageArea },
    migrateLocalSettings: migrateLocalSettingsIfNeeded
  };
}

export { createPageContext };
export type { PageContext };
