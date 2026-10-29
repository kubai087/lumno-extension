// The New Tab favicon the appearance panel picks: the built-in icons, the
// theme-aware SVG link kept in step with the browser theme across tabs, and
// the cached choice the next page load starts from.
import { getPageFaviconLink } from '../../dom/page-favicon-link';
import { serializeSvgDocument } from '../../../shared/ui/svg-tree';
import type { FormatMessage, ShowToast, Translate } from '../../newtab-types';
import type { WallpaperStorage } from './wallpaper-storage';
import type { WallpaperVisual } from './wallpaper-visual';
import { newtabFaviconPreload } from '../../../domain/settings/newtab-wallpaper';
import { newtabFavicon } from '../../../domain/settings/newtab-wallpaper';
import { NEWTAB_FAVICON_DEFAULT_ID, NEWTAB_FAVICON_OPTIONS, NEWTAB_FAVICON_SVG_MAIN_PATH, NEWTAB_FAVICON_SVG_SHADOW_PATH } from '../wallpaper-options';
import { createStore } from '../../../shared/state/store';

// A favicon the panel offers.
interface NewtabFaviconOption {
  id: string;
  nameKey: string;
  fallbackName: string;
  file: string;
  type: string;
  sizes?: string;
  // How the panel previews it.
  preview?: 'inlineSvg';
  // Drawn as an SVG data URL in the browser theme's colors.
  themeAwareSvg?: boolean;
}

type FaviconTheme = 'light' | 'dark';

interface FaviconChooserDeps extends Pick<WallpaperVisual, 'getRuntimeAssetUrl'>,
  Pick<WallpaperStorage, 'writeSetting' | 'readStoredSetting'> {
  t: Translate;
  window: Window;
  BroadcastChannelCtor: typeof BroadcastChannel | null;
  document: Document;
  showToast: ShowToast;
  formatMessage: FormatMessage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function createFaviconChooser(deps: FaviconChooserDeps) {
  const {
    t,
    getRuntimeAssetUrl,
    window,
    BroadcastChannelCtor,
    document,
    writeSetting,
    showToast,
    readStoredSetting,
    formatMessage
  } = deps;

  // The icon chosen; the panel draws again when it changes.
  const store = createStore({ id: NEWTAB_FAVICON_DEFAULT_ID });

  const NEWTAB_FAVICON_THEME_QUERY = '(prefers-color-scheme: dark)';
  const NEWTAB_FAVICON_THEME_BROADCAST_CHANNEL = 'lumno:newtab-favicon-theme';
  const NEWTAB_FAVICON_THEME_REFRESH_ACTION = 'lumno:newtab-favicon-theme-refresh';
  const NEWTAB_FAVICON_THEMES: Record<FaviconTheme, { color: string; shadowOpacity: string; mainOpacity: string }> = {
    light: {
      color: '#000000',
      shadowOpacity: '0.2',
      mainOpacity: '0.5'
    },
    dark: {
      color: '#f1f3f4',
      shadowOpacity: '0.34',
      mainOpacity: '0.72'
    }
  };
  let hasNewtabFaviconBootstrapStarted = false;
  let initialNewtabFaviconReadyPromise: Promise<void> | null = null;
  let newtabFaviconThemeQueryList: MediaQueryList | null = null;
  let newtabFaviconThemeChangeHandler: (() => void) | null = null;
  let hasNewtabFaviconLifecycleListeners = false;
  let newtabFaviconLifecycleRefreshHandler: (() => void) | null = null;
  let newtabFaviconThemeBroadcastChannel: BroadcastChannel | null = null;
  let hasNewtabFaviconThemeBroadcastListener = false;

  function getNewtabFaviconById(id: unknown): NewtabFaviconOption | null {
    const normalizedId = String(id || '').trim();
    return NEWTAB_FAVICON_OPTIONS.find((item) => item && item.id === normalizedId) || null;
  }

  function normalizeNewtabFaviconId(value: unknown): string {
    const raw = isRecord(value) && value.id
      ? value.id
      : value;
    const id = String(raw || '').trim();
    return getNewtabFaviconById(id) ? id : NEWTAB_FAVICON_DEFAULT_ID;
  }

  function getNewtabFaviconDisplayName(item: NewtabFaviconOption | null): string {
    if (!item) {
      return '';
    }
    return t(item.nameKey, item.fallbackName || item.id || '');
  }

  function getNewtabFaviconUrl(item: NewtabFaviconOption | null | undefined): string {
    return item && item.file ? getRuntimeAssetUrl(item.file) : '';
  }

  function getNewtabFaviconThemeQueryList(): MediaQueryList | null {
    if (!window || typeof window.matchMedia !== 'function') {
      return null;
    }
    try {
      return window.matchMedia(NEWTAB_FAVICON_THEME_QUERY);
    } catch {
      return null;
    }
  }

  function getNewtabFaviconBrowserTheme(): FaviconTheme {
    const queryList = getNewtabFaviconThemeQueryList();
    return queryList && queryList.matches ? 'dark' : 'light';
  }

  function buildNewtabFaviconSvgDataUrl(themeName: FaviconTheme): string {
    const theme = NEWTAB_FAVICON_THEMES[themeName] || NEWTAB_FAVICON_THEMES.light;
    const svg = serializeSvgDocument(['svg', { width: 104, height: 104, viewBox: '0 0 104 104', fill: 'none' }, [
      ['path', { opacity: theme.shadowOpacity, d: NEWTAB_FAVICON_SVG_SHADOW_PATH, fill: theme.color }],
      ['path', { d: NEWTAB_FAVICON_SVG_MAIN_PATH, fill: theme.color, 'fill-opacity': theme.mainOpacity }]
    ]]);
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function getNewtabFaviconHref(item: NewtabFaviconOption): string {
    if (item && item.themeAwareSvg) {
      return buildNewtabFaviconSvgDataUrl(getNewtabFaviconBrowserTheme());
    }
    return getNewtabFaviconUrl(item);
  }

  function cacheNewtabFaviconPreloadId(id: unknown): void {
    const normalizedId = normalizeNewtabFaviconId(id);
    try {
      if (window && window.localStorage) {
        window.localStorage.setItem(newtabFaviconPreload.key, normalizedId);
      }
    } catch {
      // The main runtime still applies the favicon even when localStorage is unavailable.
    }
  }

  function clearNewtabFaviconThemeListener(): void {
    if (!newtabFaviconThemeQueryList || !newtabFaviconThemeChangeHandler) {
      newtabFaviconThemeQueryList = null;
      newtabFaviconThemeChangeHandler = null;
      return;
    }
    if (typeof newtabFaviconThemeQueryList.removeEventListener === 'function') {
      newtabFaviconThemeQueryList.removeEventListener('change', newtabFaviconThemeChangeHandler);
    } else if (typeof newtabFaviconThemeQueryList.removeListener === 'function') {
      newtabFaviconThemeQueryList.removeListener(newtabFaviconThemeChangeHandler);
    }
    newtabFaviconThemeQueryList = null;
    newtabFaviconThemeChangeHandler = null;
  }

  function applyNewtabFaviconLinkAttributes(link: Element, item: NewtabFaviconOption): void {
    const themeName = item && item.themeAwareSvg ? getNewtabFaviconBrowserTheme() : '';
    link.setAttribute('rel', 'icon');
    link.setAttribute('type', item.type || 'image/png');
    link.setAttribute('href', getNewtabFaviconHref(item));
    if (item.sizes) {
      link.setAttribute('sizes', item.sizes);
    } else {
      link.removeAttribute('sizes');
    }
    link.setAttribute('data-newtab-favicon-id', item.id);
    if (themeName) {
      link.setAttribute('data-lumno-newtab-favicon-theme', themeName);
    } else {
      link.removeAttribute('data-lumno-newtab-favicon-theme');
    }
  }

  function refreshNewtabFaviconLink(): void {
    const item = getNewtabFaviconById(store.getSnapshot().id) ||
      getNewtabFaviconById(NEWTAB_FAVICON_DEFAULT_ID);
    const link = getPageFaviconLink(document);
    if (link && item) {
      applyNewtabFaviconLinkAttributes(link, item);
    }
  }

  function refreshNewtabFaviconLinkIfThemeAware(): void {
    const item = getNewtabFaviconById(store.getSnapshot().id);
    if (item && item.themeAwareSvg) {
      refreshNewtabFaviconLink();
    }
  }

  function getNewtabFaviconThemeBroadcastChannel(): BroadcastChannel | null {
    if (newtabFaviconThemeBroadcastChannel) {
      return newtabFaviconThemeBroadcastChannel;
    }
    if (typeof BroadcastChannelCtor !== 'function') {
      return null;
    }
    try {
      newtabFaviconThemeBroadcastChannel = new BroadcastChannelCtor(NEWTAB_FAVICON_THEME_BROADCAST_CHANNEL);
    } catch {
      newtabFaviconThemeBroadcastChannel = null;
    }
    return newtabFaviconThemeBroadcastChannel;
  }

  function bindNewtabFaviconThemeBroadcastListener(): void {
    if (hasNewtabFaviconThemeBroadcastListener) {
      return;
    }
    hasNewtabFaviconThemeBroadcastListener = true;
    const channel = getNewtabFaviconThemeBroadcastChannel();
    if (!channel) {
      return;
    }
    const handleMessage = (event: MessageEvent) => {
      const data: unknown = event && event.data ? event.data : null;
      if (!isRecord(data) || data.action !== NEWTAB_FAVICON_THEME_REFRESH_ACTION) {
        return;
      }
      refreshNewtabFaviconLinkIfThemeAware();
    };
    if (typeof channel.addEventListener === 'function') {
      channel.addEventListener('message', handleMessage);
    } else {
      channel.onmessage = handleMessage;
    }
  }

  function broadcastNewtabFaviconThemeRefresh(): void {
    const channel = getNewtabFaviconThemeBroadcastChannel();
    if (!channel || typeof channel.postMessage !== 'function') {
      return;
    }
    try {
      channel.postMessage({
        action: NEWTAB_FAVICON_THEME_REFRESH_ACTION,
        at: Date.now()
      });
    } catch {
      // BroadcastChannel can be unavailable in constrained extension contexts.
    }
  }

  function bindNewtabFaviconLifecycleRefreshListeners(): void {
    if (hasNewtabFaviconLifecycleListeners) {
      return;
    }
    hasNewtabFaviconLifecycleListeners = true;
    newtabFaviconLifecycleRefreshHandler = () => {
      refreshNewtabFaviconLinkIfThemeAware();
    };
    if (window && typeof window.addEventListener === 'function') {
      window.addEventListener('focus', newtabFaviconLifecycleRefreshHandler, { passive: true });
      window.addEventListener('pageshow', newtabFaviconLifecycleRefreshHandler, { passive: true });
    }
    if (document && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', newtabFaviconLifecycleRefreshHandler, { passive: true });
    }
  }

  function bindNewtabFaviconThemeListener(item: NewtabFaviconOption | null): void {
    clearNewtabFaviconThemeListener();
    if (!item || !item.themeAwareSvg) {
      return;
    }
    bindNewtabFaviconLifecycleRefreshListeners();
    bindNewtabFaviconThemeBroadcastListener();
    const queryList = getNewtabFaviconThemeQueryList();
    if (!queryList) {
      return;
    }
    newtabFaviconThemeQueryList = queryList;
    newtabFaviconThemeChangeHandler = () => {
      refreshNewtabFaviconLinkIfThemeAware();
      broadcastNewtabFaviconThemeRefresh();
    };
    if (typeof queryList.addEventListener === 'function') {
      queryList.addEventListener('change', newtabFaviconThemeChangeHandler);
    } else if (typeof queryList.addListener === 'function') {
      queryList.addListener(newtabFaviconThemeChangeHandler);
    }
  }


  function applyNewtabFavicon(value: unknown): void {
    const nextId = normalizeNewtabFaviconId(value);
    const item = getNewtabFaviconById(nextId) || getNewtabFaviconById(NEWTAB_FAVICON_DEFAULT_ID);
    store.setState({ id: item ? item.id : NEWTAB_FAVICON_DEFAULT_ID });
    cacheNewtabFaviconPreloadId(store.getSnapshot().id);
    bindNewtabFaviconThemeListener(item);
    const link = getPageFaviconLink(document);
    if (link && item) {
      applyNewtabFaviconLinkAttributes(link, item);
    }
  }

  function persistNewtabFavicon(value: unknown): void {
    const nextId = normalizeNewtabFaviconId(value);
    applyNewtabFavicon(nextId);
    writeSetting(newtabFavicon, nextId, () => {
      showToast(t('newtab_favicon_save_error', 'Failed to save favicon'), true);
    });
  }

  function bootstrapInitialNewtabFavicon(): Promise<void> {
    if (hasNewtabFaviconBootstrapStarted) {
      return initialNewtabFaviconReadyPromise || Promise.resolve();
    }
    hasNewtabFaviconBootstrapStarted = true;
    initialNewtabFaviconReadyPromise = readStoredSetting(newtabFavicon).then((storedValue) => {
      const nextId = normalizeNewtabFaviconId(storedValue.value);
      applyNewtabFavicon(nextId);
      if (storedValue.hasValue && storedValue.value !== nextId) {
        writeSetting(newtabFavicon, nextId);
      }
    });
    return initialNewtabFaviconReadyPromise;
  }

  function buildNewtabFaviconState() {
    const currentItem = getNewtabFaviconById(store.getSnapshot().id) ||
      getNewtabFaviconById(NEWTAB_FAVICON_DEFAULT_ID);
    return {
      title: t('newtab_favicon_title', 'New Tab favicon'),
      options: NEWTAB_FAVICON_OPTIONS.map((item) => ({
        id: item.id,
        selected: Boolean(currentItem && item.id === currentItem.id),
        label: formatMessage('newtab_favicon_select_label', 'Select {name} favicon', {
          name: getNewtabFaviconDisplayName(item)
        })
      }))
    };
  }

  return {
    store,
    normalizeNewtabFaviconId,
    getNewtabFaviconUrl,
    applyNewtabFavicon,
    persistNewtabFavicon,
    bootstrapInitialNewtabFavicon,
    buildNewtabFaviconState
  };
}

type FaviconChooser = ReturnType<typeof createFaviconChooser>;

export { createFaviconChooser };
export type { FaviconChooser, FaviconChooserDeps, NewtabFaviconOption };
