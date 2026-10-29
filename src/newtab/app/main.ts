// The New Tab's entry: makes the context every feature takes, creates the
// features in the order they read each other, puts the page together and
// runs the startup.
import { NEWTAB_SEARCH_SETTINGS, SYNCED_PAGE_STORAGE_KEYS } from '../newtab-config';
import { readBootValue } from '../../platform/boot-handoff';
import { NEWTAB_SETTING_REPAIRS, repairStoredSettings } from '../setting-repairs';
import { createPageContext } from './context';
import { createShellFeature } from '../features/shell';
import { createBookmarkStoreFeature } from '../features/bookmark-store';
import { createShortcutStoreFeature } from '../features/shortcut-store';
import { createTransfersFeature } from '../features/transfers';
import { createNavigationFeature } from '../features/navigation';
import { createBookmarkMenusFeature } from '../features/bookmark-menus';
import { createShortcutMenusFeature } from '../features/shortcut-menus';
import { createSearchCoreFeature } from '../features/search-core';
import { createRecentCoreFeature } from '../features/recent-core';
import { createThemeFeature } from '../features/theme';
import { createLayoutFeature } from '../features/layout';
import { createTopContentFeature } from '../features/top-content';
import { createWallpaperFeature } from '../features/wallpaper';
import { createSectionsFeature } from '../features/sections';
import { createDragsFeature } from '../features/drags';
import { createSectionViewsFeature } from '../features/section-views';
import { createSearchUiFeature } from '../features/search-ui';
import { createPageFeature } from '../features/page';
import { createMountFeature } from '../features/mount';
import { runStartup } from './startup';

function startNewtab(): void {
  const page = createPageContext();
  if (!page) {
    return;
  }
  const { ctx, migrateLocalSettings } = page;
  const shellFeature = createShellFeature(ctx);
  const bookmarkStoreFeature = createBookmarkStoreFeature(ctx);
  const shortcutStoreFeature = createShortcutStoreFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature });
  const transfersFeature = createTransfersFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, shortcutStore: shortcutStoreFeature });
  const navigationFeature = createNavigationFeature(ctx, { shell: shellFeature });
  const searchCoreFeature = createSearchCoreFeature(ctx, { shell: shellFeature, shortcutStore: shortcutStoreFeature, navigation: navigationFeature });
  const recentCoreFeature = createRecentCoreFeature(ctx, { shell: shellFeature, shortcutStore: shortcutStoreFeature, navigation: navigationFeature, searchCore: searchCoreFeature });
  const bookmarkMenusFeature = createBookmarkMenusFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, shortcutStore: shortcutStoreFeature, transfers: transfersFeature, navigation: navigationFeature });
  const themeFeature = createThemeFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, navigation: navigationFeature, bookmarkMenus: bookmarkMenusFeature, searchCore: searchCoreFeature, recentCore: recentCoreFeature });
  const shortcutMenusFeature = createShortcutMenusFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, shortcutStore: shortcutStoreFeature, navigation: navigationFeature, bookmarkMenus: bookmarkMenusFeature });
  const layoutFeature = createLayoutFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, shortcutStore: shortcutStoreFeature, shortcutMenus: shortcutMenusFeature, recentCore: recentCoreFeature });
  const topContentFeature = createTopContentFeature(ctx, { shell: shellFeature, navigation: navigationFeature, recentCore: recentCoreFeature, layout: layoutFeature });
  const wallpaperFeature = createWallpaperFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, shortcutStore: shortcutStoreFeature, navigation: navigationFeature, bookmarkMenus: bookmarkMenusFeature, theme: themeFeature, layout: layoutFeature, topContent: topContentFeature });
  migrateLocalSettings(SYNCED_PAGE_STORAGE_KEYS.slice());
  const sectionsFeature = createSectionsFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, bookmarkMenus: bookmarkMenusFeature, layout: layoutFeature });
  const dragsFeature = createDragsFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, shortcutStore: shortcutStoreFeature, transfers: transfersFeature, navigation: navigationFeature, bookmarkMenus: bookmarkMenusFeature, shortcutMenus: shortcutMenusFeature, searchCore: searchCoreFeature, recentCore: recentCoreFeature, theme: themeFeature, layout: layoutFeature, sections: sectionsFeature });
  const sectionViewsFeature = createSectionViewsFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, shortcutStore: shortcutStoreFeature, navigation: navigationFeature, bookmarkMenus: bookmarkMenusFeature, searchCore: searchCoreFeature, recentCore: recentCoreFeature, theme: themeFeature, layout: layoutFeature, topContent: topContentFeature, sections: sectionsFeature, drags: dragsFeature });
  const searchUiFeature = createSearchUiFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, shortcutStore: shortcutStoreFeature, navigation: navigationFeature, bookmarkMenus: bookmarkMenusFeature, shortcutMenus: shortcutMenusFeature, searchCore: searchCoreFeature, recentCore: recentCoreFeature, theme: themeFeature, layout: layoutFeature, topContent: topContentFeature, wallpaper: wallpaperFeature, sectionViews: sectionViewsFeature });
  const pageFeature = createPageFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, transfers: transfersFeature, bookmarkMenus: bookmarkMenusFeature, searchCore: searchCoreFeature, recentCore: recentCoreFeature, theme: themeFeature, layout: layoutFeature, topContent: topContentFeature, sections: sectionsFeature, drags: dragsFeature, sectionViews: sectionViewsFeature, searchUi: searchUiFeature });
  const mountFeature = createMountFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, navigation: navigationFeature, bookmarkMenus: bookmarkMenusFeature, theme: themeFeature, topContent: topContentFeature, wallpaper: wallpaperFeature, drags: dragsFeature, sectionViews: sectionViewsFeature, searchUi: searchUiFeature });

  const { settings, storageArea } = ctx;
  const actionButtonVisibilityReady = searchUiFeature.followNewtabActionButtonVisibility();
  const glassStyleReady = pageFeature.followNewtabGlassStyle();
  const shortcutPreferencesReady = dragsFeature.followNewtabShortcutPreferences();
  layoutFeature.followShortcutGridLayout();
  layoutFeature.followNewtabSearchWidth();
  shortcutMenusFeature.followShortcutDockMagnification();
  const shortcutsReady = shortcutPreferencesReady.then(() => {
    void bookmarkMenusFeature.loadFolderColors();
    return shortcutStoreFeature.loadVisibleShortcuts();
  }).catch((error) => {
    console.warn('[Lumno] Deferred shortcut loading failed.', error);
    return [];
  });
  // The search settings join the page's first storage read.
  const sectionPolicyReady = settings.include(NEWTAB_SEARCH_SETTINGS);
  // The page keeps the stored copy of its settings normalized.
  void repairStoredSettings(settings, storageArea, NEWTAB_SETTING_REPAIRS);
  const languageReady = themeFeature.followLanguage();
  const motionPreferenceReady = readBootValue('motionPreferenceReady');
  const fontsReady = document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function'
    ? document.fonts.ready.catch(() => true)
    : Promise.resolve(true);
  shellFeature.webAppearance.load();
  runStartup({
    layoutPreferences: [
      wallpaperFeature.initialAppearanceReadyTask,
      bookmarkMenusFeature.initialBookmarkTopbarLayoutReady,
      sectionsFeature.followBookmarkViewMode(),
      searchUiFeature.followZenMode(),
      actionButtonVisibilityReady,
      glassStyleReady,
      motionPreferenceReady,
      languageReady,
      sectionPolicyReady,
      shortcutsReady,
      recentCoreFeature.recentSitesReadyTask,
      fontsReady,
      topContentFeature.initialTimeFontReadyTask,
      mountFeature.initialQuoteReadyTask
    ],
    loadData: () => {
      const { recent, bookmarks } = sectionViewsFeature.startSectionDataPass();
      const releaseSourceReads = () => recentCoreFeature.recentSourceReads.release();
      recent.then(releaseSourceReads, releaseSourceReads);
      return Promise.all([recent, bookmarks]);
    },
    // The wallpaper leads: content enters once its tones are on the controls.
    waitForWallpaperTone: () => wallpaperFeature.wallpaperRuntime.waitForInitialWallpaperTone(),
    markReady: () => {
      searchUiFeature.maybeShowFileAccessNotice();
      wallpaperFeature.markNewtabReady();
    }
  });
  layoutFeature.updateBookmarkSectionPosition();
}

startNewtab();
