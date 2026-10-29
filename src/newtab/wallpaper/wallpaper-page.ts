// The page's wallpaper: the wallpaper runtime and its panel controls, the
// first wallpaper, overlay and effect shown at startup, and the adaptive
// tone targets that keep text and glass surfaces readable on it.
import type { StorageAreaLike } from '../../domain/storage-port';
import { queryHtmlElement, queryHtmlElements } from '../../shared/dom-lookup';
import type { ToastTask } from '../../shared/ui/toast-screen';
import type { FormatMessage, ShowToast, Translate } from '../newtab-types';
import type { ThemeScope } from '../react/wallpaper-panel/panel-model';
import type { TopContentController } from '../react/wordmark';
import type { QuoteRuntime } from '../top-content/quotes';
import type { AdaptiveToneTarget, ToneScheduleOptions } from './wallpaper-adaptive-tone';
import * as NEWTAB_WALLPAPER from './wallpaper';
import type { SectionPanelSettings } from './runtime/panel-actions';
import type { AppliedThemeMode } from '../theme/applied-theme-mode';
import type { SurfaceLocale } from '../../shared/i18n/surface-locale';
import { readBootValue } from '../../platform/boot-handoff';
import type { SettingsStore } from '../../platform/settings-store';
import type { SettingPreview } from '../setting-preview';
import { getFixedTimeInk, newtabTimeInk, newtabTopContentMode } from '../../domain/settings/newtab-time';
import { themeMode } from '../../domain/settings/appearance';
import { NEWTAB_THEME_SETTINGS, newtabGlassStyle, newtabGlassTheme, newtabInputAutoFocusEnabled } from '../../domain/settings/newtab-page';
import { NEWTAB_SHORTCUT_COLUMNS_DEFAULT, NEWTAB_SHORTCUT_COLUMNS_MAX, NEWTAB_SHORTCUT_COLUMNS_MIN, NEWTAB_SHORTCUT_GAP_DEFAULT, NEWTAB_SHORTCUT_GAP_MAX, NEWTAB_SHORTCUT_GAP_MIN, NEWTAB_SHORTCUT_SIZE_DEFAULT, NEWTAB_SHORTCUT_SIZE_MAX, NEWTAB_SHORTCUT_SIZE_MIN, newtabShortcutAddVisible, newtabShortcutColumns, newtabShortcutDockMagnificationEnabled, newtabShortcutGap, newtabShortcutSize, newtabShortcutsVisible } from '../../domain/settings/newtab-shortcuts';
import * as EXTENSION_ROUTES from '../../domain/extension-routes';
import * as FEATURE_HINTS from '../../shared/ui/feature-hints';
import { NEWTAB_GLASS_ADAPTIVE_SELECTOR } from '../newtab-config';
import { SEARCH_WIDTH_CONFIG } from '../layout';
import type { BottomDockParts } from '../shortcuts/bottom-dock-parts';

type StorageArea = Pick<StorageAreaLike, 'get' | 'set'>;

// Whether a layout change is only shown or also saved.
type PersistOptions = { persist: boolean };

// The page state parts the wallpaper reads and sets.
interface WallpaperPageState {
  bookmarkPagerPrevButton: HTMLElement | null;
  bookmarkTitleWrap: HTMLElement | null;
  bookmarkTopbarRuntime: { element: HTMLElement | null } | null;
  topContentController: TopContentController | null;
  topContentContainer: HTMLElement | null;
  wordmarkImageEl: HTMLImageElement | null;
  recentHeader: HTMLElement | null;
}

interface WallpaperPageDeps {
  settings: SettingsStore;
  preview: SettingPreview;
  shortcutTiles: readonly HTMLElement[];
  // A dock tile's icon, which its tone samples.
  getShortcutDockIcon(tile: HTMLElement): HTMLElement | null;
  shortcutGroupHeaders: readonly HTMLElement[];
  getEffectiveBookmarkTopbarSurfaceMode(): string;
  isBookmarkTopbarMode(): boolean;
  // The search box.
  root: HTMLElement;
  localStorageArea: StorageArea | null;
  t: Translate;
  formatMessage: FormatMessage;
  getSelectedThemeMode(): string;
  getScopedThemeMode(): string;
  getThemeScope(): string;
  setThemeMode(mode: string): void;
  setThemeScope(scope: ThemeScope): void;
  showToast: ShowToast;
  beginToast(message: string): ToastTask;
  showTopActionTooltip(anchor: HTMLElement, text: string, options?: { placement?: string }): void;
  hideTopActionTooltip(): void;
  applyWordmarkThemeAppearance(): void;
  getEffectiveNewtabSearchWidth(): number;
  setNewtabSearchWidth(width: number, options: PersistOptions): void;
  setNewtabShortcutsVisible(visible: boolean, options: PersistOptions): void;
  setNewtabShortcutAddVisible(visible: boolean, options: PersistOptions): void;
  setNewtabShortcutDockMagnificationEnabled(enabled: boolean, options: PersistOptions): void;
  setNewtabShortcutColumns(columns: number, options: PersistOptions): void;
  setNewtabShortcutSize(size: number, options: PersistOptions): void;
  setNewtabShortcutGap(gap: number, options: PersistOptions): void;
  // Settles once the page's entry animation is done.
  newtabEntryAnimationReadyPromise: PromiseLike<unknown>;
  // Settles once the auto-focus setting is read.
  initialNewtabInputAutoFocusReadyTask: PromiseLike<unknown>;
  followTheme(): PromiseLike<unknown>;
  quoteRuntime: Pick<QuoteRuntime, 'element' | 'getTextElement' | 'bindSettings' | 'getProviderLabel' | 'updateLanguage'>;
  shortcutGrid: HTMLElement;
  bottomDockParts: Pick<BottomDockParts, 'scroller'>;
  pageState: WallpaperPageState;
  getFeedbackButton(): HTMLElement | null;
  sectionPanelSettings: SectionPanelSettings & { updateLanguage(): void };
  appliedTheme: Pick<AppliedThemeMode, 'events'>;
  locale: Pick<SurfaceLocale, 'store'>;
}

function createWallpaperPage(deps: WallpaperPageDeps) {
  const {
    bottomDockParts,
    shortcutGrid,
    quoteRuntime,
    settings,
    preview,
    shortcutTiles,
    getShortcutDockIcon,
    shortcutGroupHeaders,
    getEffectiveBookmarkTopbarSurfaceMode,
    isBookmarkTopbarMode,
    root,
    localStorageArea,
    t,
    formatMessage,
    getSelectedThemeMode,
    getScopedThemeMode,
    getThemeScope,
    setThemeMode,
    setThemeScope,
    showToast,
    beginToast,
    showTopActionTooltip,
    hideTopActionTooltip,
    applyWordmarkThemeAppearance,
    getEffectiveNewtabSearchWidth,
    setNewtabSearchWidth,
    setNewtabShortcutsVisible,
    setNewtabShortcutAddVisible,
    setNewtabShortcutDockMagnificationEnabled,
    setNewtabShortcutColumns,
    setNewtabShortcutSize,
    setNewtabShortcutGap,
    newtabEntryAnimationReadyPromise,
    initialNewtabInputAutoFocusReadyTask,
    followTheme,
    getFeedbackButton,
    sectionPanelSettings,
    appliedTheme,
    locale
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;
  let wallpaperShownAt = 0;


  function createWallpaperAdaptiveToneTargets(): AdaptiveToneTarget[] {
    const bookmarkPager = pageState.bookmarkPagerPrevButton && pageState.bookmarkPagerPrevButton.parentElement
      ? pageState.bookmarkPagerPrevButton.parentElement
      : null;
    const shortcutIconTargets: Array<{ element: HTMLElement; forcedIconBackground: AdaptiveToneTarget['forcedIconBackground'] }> =
      shortcutTiles.map((tile) => ({
        element: tile,
        forcedIconBackground: 'shortcut-fallback'
      }));
    if (shortcutGrid) {
      queryHtmlElements(shortcutGrid, '.x-nt-shortcut-group-empty').forEach((slot) => {
        shortcutIconTargets.push({ element: slot, forcedIconBackground: 'shortcut-add' });
      });
    }
    queryHtmlElements(shortcutGrid, '.x-nt-shortcut-tile--add').forEach((addTile) => {
      shortcutIconTargets.push({ element: addTile, forcedIconBackground: 'shortcut-add' });
    });
    // The dock's icons read one sample over the whole row and keep one ink, so a
    // folder or the add button never flips tone against its neighbor where the
    // wallpaper under the row changes from light to dark.
    const shortcutIconSample = shortcutIconTargets.map(({ element }) => getShortcutDockIcon(element) || element);
    const shortcutToneTargets = shortcutIconTargets.map(({ element, forcedIconBackground }): AdaptiveToneTarget => ({
      element,
      sampleElement: shortcutIconSample,
      toneGroup: 'shortcut-icons',
      minWidth: 42,
      minHeight: 42,
      iconButton: true,
      forcedIconBackground
    }));
    // A group's menu button and title placeholder fill with the header's solid tone
    // while pointed at or open.
    shortcutGroupHeaders.forEach((header) => {
      shortcutToneTargets.push({
        element: header,
        sampleElement: header.querySelector('.x-nt-shortcut-group-title') || header,
        minWidth: 112,
        minHeight: 32,
        iconButton: true
      });
    });
    const topContentSample: HTMLElement | null = pageState.topContentController && typeof pageState.topContentController.getContent === 'function'
      ? (pageState.topContentController.getContent() || pageState.topContentContainer)
      : (pageState.wordmarkImageEl || pageState.topContentContainer);
    const quoteElement = quoteRuntime.element;
    const quoteSample = quoteRuntime.getTextElement() || quoteElement;
    // A quote at the top is the wordmark's caption: both read the wallpaper under
    // the pair and share one ink, so the line never flips against the mark above it.
    const quoteIsCaption = Boolean(quoteElement && !quoteElement.hidden &&
      quoteElement.getAttribute('data-position') === 'top' &&
      pageState.topContentContainer && pageState.topContentContainer.getAttribute('data-visible') !== 'false');
    const captionSample = quoteIsCaption ? [topContentSample, quoteSample] : null;
    const targets: AdaptiveToneTarget[] = [
      {
        element: pageState.bookmarkTopbarRuntime && pageState.bookmarkTopbarRuntime.element,
        sampleElement: pageState.bookmarkTopbarRuntime && pageState.bookmarkTopbarRuntime.element,
        minWidth: 280,
        minHeight: 64,
        surface: 'topbar',
        preferOverlayPolarity: getEffectiveBookmarkTopbarSurfaceMode() === 'adaptive',
        // Without a glass style the search box and cards keep the theme's light or dark, so the
        // "match style" bar keeps it too instead of flipping over the wallpaper at the top.
        disabled: !isBookmarkTopbarMode() ||
          getEffectiveBookmarkTopbarSurfaceMode() === 'custom' ||
          (getEffectiveBookmarkTopbarSurfaceMode() === 'adaptive' &&
            !document.body.hasAttribute('data-glass-style'))
      },
      {
        element: pageState.topContentContainer,
        sampleElement: captionSample || topContentSample,
        toneGroup: captionSample ? 'top-caption' : '',
        // A clock ink the user fixed; a caption under the clock keeps the sampled one.
        ink: getFixedTimeInk(settings.get(newtabTopContentMode), settings.get(newtabTimeInk)),
        minWidth: 220,
        minHeight: 72
      },
      {
        element: quoteElement,
        sampleElement: captionSample || quoteSample,
        toneGroup: captionSample ? 'top-caption' : '',
        minWidth: 160,
        minHeight: 32
      },
      // The heading link and breadcrumbs fill with the title's solid tone while pointed at.
      {
        element: pageState.bookmarkTitleWrap,
        sampleElement: pageState.bookmarkTitleWrap,
        minWidth: 112,
        minHeight: 44,
        iconButton: true
      },
      // In the regular section layout the pager also holds the manager button
      // and the display-mode trigger. Keep them on the pager's shared tone
      // target so one visual toolbar does not split into independently sampled colors.
      {
        element: bookmarkPager,
        sampleElement: bookmarkPager,
        minWidth: 92,
        minHeight: 42,
        iconButton: true
      },
      // The recent mode switch is the heading's text, so it takes the header's tone,
      // including the solid fill it shows while pointed at or open.
      {
        element: pageState.recentHeader,
        sampleElement: pageState.recentHeader,
        minWidth: 112,
        minHeight: 44,
        iconButton: true
      },
      {
        element: getFeedbackButton(),
        sampleElement: getFeedbackButton(),
        minWidth: 42,
        minHeight: 42,
        iconButton: true
      },
      // The dock's scrollbar sits on the wallpaper beside the cards; sample
      // only its track so a thin thumb follows the tone right under it.
      {
        element: bottomDockParts.scroller,
        sampleElement: bottomDockScrollbarTrackArea,
        minWidth: 24,
        minHeight: 64,
        disabled: !isBottomDockScrollbarShown()
      }
    ];
    return targets.concat(shortcutToneTargets, createGlassToneTargets());
  }

  // Under a glass style each plate also samples the wallpaper right behind it, to set how dense its
  // tint is and how much saturation it keeps (glass-style.css reads both).
  function createGlassToneTargets(): AdaptiveToneTarget[] {
    if (!document.body || !document.body.hasAttribute('data-glass-style')) {
      return [];
    }
    // Plates in one row share an ink (light or dark text), so neighbors never alternate.
    const groupOf = (element: Element): string => {
      if (element.closest('.x-nt-shortcuts-section')) {
        return 'shortcuts';
      }
      if (element.closest('#_x_extension_newtab_recent_sites_2024_unique_')) {
        return 'recent';
      }
      if (element.closest('#_x_extension_newtab_bookmarks_2024_unique_')) {
        return element.matches('.x-nt-bookmark-card') ? 'bookmarks' : 'bookmarks-header';
      }
      return element === root ? 'search' : '';
    };
    // Looked up by id: this can run before the page structure further down has been created.
    const suggestionsSurface = document.getElementById('_x_extension_newtab_suggestions_surface_2026_unique_');
    const suggestionsList = document.getElementById('_x_extension_newtab_suggestions_container_2024_unique_');
    // The search stack reads as one sheet: the bar, the plate behind the results and the result rows
    // (a separate layer) share one ink and one tint, sampled over everything the open plate can
    // cover. The sample stays the same as the list opens, closes or grows with each keystroke, so the
    // tint never jumps and the plate never repaints for a new one.
    const searchStackSample = {
      getBoundingClientRect() {
        const bar = root.getBoundingClientRect();
        const reach = Number.parseFloat(suggestionsList
          ? window.getComputedStyle(suggestionsList).getPropertyValue('--x-nt-suggestions-max-height')
          : '') || 594;
        return new DOMRect(bar.left, bar.top, bar.width,
          Math.max(bar.height, Math.min(window.innerHeight - bar.top, bar.height + reach)));
      }
    };
    const targets = queryHtmlElements(document, NEWTAB_GLASS_ADAPTIVE_SELECTOR).map((element): AdaptiveToneTarget => ({
      element,
      sampleElement: element === root ? searchStackSample : element,
      glass: true,
      glassGroup: groupOf(element)
    }));
    [suggestionsSurface, suggestionsList].forEach((element) => {
      if (element) {
        targets.push({
          element,
          sampleElement: searchStackSample,
          glass: true,
          glassGroup: 'search',
          // The result rows' own icons and chips switch to their dark-theme styling with the ink.
          paletteSwap: element === suggestionsList
        });
      }
    });
    // A frosted bookmarks bar samples like a plate. Out of frosted it drops what this sets, since
    // the bar's other surfaces style its ink themselves.
    const bookmarksBar = queryHtmlElement(document, '.x-nt-bookmarks-topbar');
    const barTakesGlass = bookmarksBar &&
      (bookmarksBar.dataset.surfaceMode === 'frosted' || bookmarksBar.dataset.surfaceMode === 'clear');
    if (barTakesGlass && bookmarksBar.dataset.visible === 'true') {
      targets.push({ element: bookmarksBar, sampleElement: bookmarksBar, glass: true, glassGroup: 'topbar' });
    } else if (bookmarksBar && bookmarksBar.hasAttribute('data-glass-ink')) {
      bookmarksBar.removeAttribute('data-glass-ink');
      bookmarksBar.style.removeProperty('--x-nt-glass-density');
      bookmarksBar.style.removeProperty('--x-nt-glass-saturate');
    }
    // Floating panels and menus take the same material and ink as the plates; flipped to light ink
    // they switch their controls to the dark palette (paletteSwap). They follow the plates' ink
    // rather than weigh in on it (floating).
    queryHtmlElements(document,
      '.x-nt-wallpaper-panel, ._x_extension_menu_surface_2024_unique_, .x-lumno-feature-hint, ' +
      '.x-nt-feedback-popover, .x-lumno-toast'
    ).forEach((element) => {
      targets.push({ element, sampleElement: element, glass: true, paletteSwap: true, floating: true });
    });
    // A dialog samples the wallpaper under itself and sets its ink on its backdrop layer, which hands
    // it down to the dialog and its controls; the WeChat group dialog's card is in its shadow root.
    queryHtmlElements(document,
      '.x-nt-shortcut-dialog-backdrop, .x-nt-recent-history-backdrop, #_x_extension_community_qr_dialog_2026_unique_'
    ).forEach((element) => {
      const dialog = element.shadowRoot
        ? element.shadowRoot.querySelector('.card')
        : element.querySelector('.x-nt-shortcut-dialog, .x-nt-recent-history-dialog');
      if (dialog) {
        targets.push({ element, sampleElement: dialog, glass: true, paletteSwap: true, floating: true });
      }
    });
    return targets;
  }

  function getBottomDockScrollbarGutter(): number {
    return bottomDockParts.scroller
      ? Math.max(0, bottomDockParts.scroller.offsetWidth - bottomDockParts.scroller.clientWidth)
      : 0;
  }

  // Overlay scrollbars (macOS) take no gutter but still show while scrolling.
  function isBottomDockScrollbarShown(): boolean {
    return Boolean(
      bottomDockParts.scroller &&
      bottomDockParts.scroller.scrollHeight > bottomDockParts.scroller.clientHeight + 1
    );
  }

  const bottomDockScrollbarTrackArea = {
    getBoundingClientRect() {
      const scroller = bottomDockParts.scroller;
      if (!scroller) {
        return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };
      }
      const rect = scroller.getBoundingClientRect();
      // An overlay bar draws about 10px wide over the scroller's right edge.
      const gutter = getBottomDockScrollbarGutter() || 10;
      const endInset = Number.parseFloat(
        scroller.style.getPropertyValue('--x-nt-bottom-dock-scrollbar-end-inset')
      ) || 0;
      const top = rect.top + 10;
      const bottom = Math.max(top, rect.bottom - Math.max(10, endInset));
      return {
        left: rect.right - gutter,
        right: rect.right,
        top,
        bottom,
        width: gutter,
        height: bottom - top
      };
    }
  };
  const wallpaperRuntime = NEWTAB_WALLPAPER.createWallpaperRuntime({
    documentObj: document,
    windowObj: window,
    chromeObj: chrome,
    extensionRoutes: EXTENSION_ROUTES,
    localWallpaperStorageArea: localStorageArea,
    getQuoteRuntime: () => quoteRuntime,
    getSectionPanelSettings: () => sectionPanelSettings,
    searchWidthConfig: SEARCH_WIDTH_CONFIG,
    t,
    formatMessage,
    getThemeMode: getSelectedThemeMode,
    getEffectiveThemeMode: getScopedThemeMode,
    getThemeScope: (...args) => getThemeScope(...args),
    getGlobalThemeMode: () => settings.get(themeMode),
    setThemeMode: (...args) => setThemeMode(...args),
    setThemeScope: (...args) => setThemeScope(...args),
    showToast,
    beginToast,
    showTopActionTooltip: (...args) => showTopActionTooltip(...args),
    hideTopActionTooltip: (...args) => hideTopActionTooltip(...args),
    applyWordmarkThemeAppearance: (...args) => applyWordmarkThemeAppearance(...args),
    settings,
    preview,
    getSearchWidth: getEffectiveNewtabSearchWidth,
    setSearchWidth: (value, options) => {
      setNewtabSearchWidth(value, options);
    },
    shortcutColumnsConfig: {
      min: NEWTAB_SHORTCUT_COLUMNS_MIN,
      max: NEWTAB_SHORTCUT_COLUMNS_MAX,
      fallback: NEWTAB_SHORTCUT_COLUMNS_DEFAULT
    },
    shortcutSizeConfig: {
      min: NEWTAB_SHORTCUT_SIZE_MIN,
      max: NEWTAB_SHORTCUT_SIZE_MAX,
      fallback: NEWTAB_SHORTCUT_SIZE_DEFAULT
    },
    shortcutGapConfig: {
      min: NEWTAB_SHORTCUT_GAP_MIN,
      max: NEWTAB_SHORTCUT_GAP_MAX,
      fallback: NEWTAB_SHORTCUT_GAP_DEFAULT
    },
    getShortcutsVisible: () => preview.get(newtabShortcutsVisible),
    setShortcutsVisible: setNewtabShortcutsVisible,
    getShortcutAddVisible: () => preview.get(newtabShortcutAddVisible),
    setShortcutAddVisible: setNewtabShortcutAddVisible,
    getShortcutDockMagnificationEnabled: () => preview.get(newtabShortcutDockMagnificationEnabled),
    setShortcutDockMagnificationEnabled: setNewtabShortcutDockMagnificationEnabled,
    getShortcutColumns: () => preview.get(newtabShortcutColumns),
    setShortcutColumns: setNewtabShortcutColumns,
    getShortcutSize: () => preview.get(newtabShortcutSize),
    setShortcutSize: setNewtabShortcutSize,
    getShortcutGap: () => preview.get(newtabShortcutGap),
    setShortcutGap: setNewtabShortcutGap,
    featureHints: FEATURE_HINTS,
    featureHintVisibilityGate: newtabEntryAnimationReadyPromise,
    inputAutoFocusReady: initialNewtabInputAutoFocusReadyTask,
    getInputAutoFocusEnabled: () => settings.get(newtabInputAutoFocusEnabled),
    setInputAutoFocusEnabled: (enabled) => void settings.set(newtabInputAutoFocusEnabled, enabled),
    getGlassStyle: () => settings.get(newtabGlassStyle),
    setGlassStyle: (value) => void settings.set(newtabGlassStyle, newtabGlassStyle.parse(value)),
    getGlassTheme: () => settings.get(newtabGlassTheme),
    setGlassTheme: (value) => void settings.set(newtabGlassTheme, newtabGlassTheme.parse(value)),
    getAdaptiveToneTargets: createWallpaperAdaptiveToneTargets
  });

  // The panel draws the theme it shows, and the wallpapers follow the page's theme.
  appliedTheme.events.on('changed', () => wallpaperRuntime.handleThemeModeChange());

  function bootstrapInitialWallpaper(): Promise<void> {
    return Promise.resolve(followTheme()).then(() => wallpaperRuntime.bootstrapInitialWallpaper());
  }

  function markInitialWallpaperVisualReady(): void {
    if (!document.body) {
      return;
    }
    if (document.body.getAttribute('data-nt-wallpaper-ready') !== '1') {
      document.body.setAttribute('data-nt-wallpaper-ready', '1');
      wallpaperShownAt = performance.now();
      return;
    }
    // The preload revealed it already.
    const effectPreload = readBootValue('wallpaperEffectPreload');
    if (!wallpaperShownAt && effectPreload && effectPreload.wallpaperShownAt) {
      wallpaperShownAt = effectPreload.wallpaperShownAt;
    }
  }

  // When the wallpaper was revealed (performance.now()); 0 until then.
  function getWallpaperShownAt(): number {
    return wallpaperShownAt;
  }

  function scheduleWallpaperAdaptiveToneUpdate(options?: ToneScheduleOptions | Event | null): void {
    wallpaperRuntime.scheduleAdaptiveToneUpdate(options);
  }

  // The dock's magnification changes what the glass behind it samples.
  settings.subscribe(newtabShortcutDockMagnificationEnabled, () => scheduleWallpaperAdaptiveToneUpdate());

  // The panel draws in the page's language.
  locale.store.subscribe(() => wallpaperRuntime.updateLanguageStrings());
  // The panel's theme controls show the theme settings as they are.
  settings.subscribe(NEWTAB_THEME_SETTINGS, () => wallpaperRuntime.updateLanguageStrings());

  return {
    wallpaperRuntime,
    bootstrapInitialWallpaper,
    markInitialWallpaperVisualReady,
    getWallpaperShownAt,
    scheduleWallpaperAdaptiveToneUpdate
  };
}

type WallpaperPage = ReturnType<typeof createWallpaperPage>;

export { createWallpaperPage };
export type { WallpaperPage, WallpaperPageDeps, WallpaperPageState };
