// The New Tab's entry: makes the context every feature takes, creates the
// features in the order they read each other, puts the page together and
// runs the startup.
import { NEWTAB_SEARCH_SETTINGS, SYNCED_PAGE_STORAGE_KEYS } from '../newtab-config';
import { readBootValue } from '../../platform/boot-handoff';
import { NEWTAB_SETTING_REPAIRS, repairStoredSettings } from '../setting-repairs';
import { createPageContext } from './context';
import { createShellFeature } from '../features/shell';
import { createStoresFeature } from '../features/stores';
import { createSourcesFeature } from '../features/sources';
import { createMenusFeature } from '../features/menus';
import { createAppearanceFeature } from '../features/appearance';
import { createSectionsFeature } from '../features/sections';
import { createSearchFeature } from '../features/search';
import { runStartup } from './startup';

function startNewtab(): void {
  const page = createPageContext();
  if (!page) {
    return;
  }
  const { ctx, migrateLocalSettings } = page;
  const shell = createShellFeature(ctx);
  const stores = createStoresFeature(ctx, { shell });
  const sources = createSourcesFeature(ctx, { shell, stores });
  const menus = createMenusFeature(ctx, { shell, stores });
  const appearance = createAppearanceFeature(ctx, { shell, stores, sources, menus });
  migrateLocalSettings(SYNCED_PAGE_STORAGE_KEYS.slice());
  const sections = createSectionsFeature(ctx, { shell, stores, sources, menus, appearance });
  const search = createSearchFeature(ctx, { shell, stores, sources, menus, appearance, sections });

  const { settings, storageArea } = ctx;
  const actionButtonVisibilityReady = search.followNewtabActionButtonVisibility();
  const glassStyleReady = search.followNewtabGlassStyle();
  const shortcutPreferencesReady = sections.followNewtabShortcutPreferences();
  appearance.followShortcutGridLayout();
  appearance.followNewtabSearchWidth();
  menus.followShortcutDockMagnification();
  const shortcutsReady = shortcutPreferencesReady.then(() => {
    void menus.loadFolderColors();
    return stores.loadVisibleShortcuts();
  }).catch((error) => {
    console.warn('[Lumno] Deferred shortcut loading failed.', error);
    return [];
  });
  // The search settings join the page's first storage read.
  const sectionPolicyReady = settings.include(NEWTAB_SEARCH_SETTINGS);
  // The page keeps the stored copy of its settings normalized.
  void repairStoredSettings(settings, storageArea, NEWTAB_SETTING_REPAIRS);
  const languageReady = appearance.followLanguage();
  const motionPreferenceReady = readBootValue('motionPreferenceReady');
  const fontsReady = document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function'
    ? document.fonts.ready.catch(() => true)
    : Promise.resolve(true);
  shell.webAppearance.load();
  runStartup({
    layoutPreferences: [
      appearance.initialAppearanceReadyTask,
      menus.initialBookmarkTopbarLayoutReady,
      sections.followBookmarkViewMode(),
      search.followZenMode(),
      actionButtonVisibilityReady,
      glassStyleReady,
      motionPreferenceReady,
      languageReady,
      sectionPolicyReady,
      shortcutsReady,
      sources.recentSitesReadyTask,
      fontsReady,
      appearance.initialTimeFontReadyTask,
      search.initialQuoteReadyTask
    ],
    loadData: () => {
      const { recent, bookmarks } = sections.startSectionDataPass();
      const releaseSourceReads = () => sources.recentSourceReads.release();
      recent.then(releaseSourceReads, releaseSourceReads);
      return Promise.all([recent, bookmarks]);
    },
    // The wallpaper leads: content enters once its tones are on the controls.
    waitForWallpaperTone: () => appearance.wallpaperRuntime.waitForInitialWallpaperTone(),
    markReady: () => {
      search.maybeShowFileAccessNotice();
      appearance.markNewtabReady();
    }
  });
  appearance.updateBookmarkSectionPosition();
}

startNewtab();
