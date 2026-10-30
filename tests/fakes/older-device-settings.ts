// What devices that ran older versions hold, in the shapes those versions
// wrote, for the settings migration tests. Preferences every version shares
// stay next to the leftovers so a test can tell the two apart.
import type { StorageItems } from '../../src/domain/storage-port';
import { bookmarkViewMode } from '../../src/domain/settings/bookmarks';
import { themeMode } from '../../src/domain/settings/appearance';
import { language } from '../../src/domain/settings/locale';
import { overlayFontFallback, overlayFontFamily, overlayFontLabels } from '../../src/domain/settings/overlay-panel';
import { LEGACY_SITE_SEARCH_ICON_KEYS } from '../../src/domain/settings/removed';

export const SHARED_SYNC_PREFERENCES: StorageItems = Object.freeze({
  [themeMode.key]: 'dark',
  [language.key]: 'zh_CN',
  [bookmarkViewMode.key]: 'top'
});

// 0.9.3-0.9.45 cached the loaded messages.json of the UI language.
export const LANGUAGE_MESSAGES_CACHE = Object.freeze({
  locale: 'zh_CN',
  messages: { newtab_search_placeholder: { message: '搜索或输入网址' } }
});

// The AI search of early 2026: mode and provider in sync, a cached
// entitlement, and the user's own API key on the device.
export const AI_SEARCH_SYNC: StorageItems = Object.freeze({
  _x_extension_ai_search_mode_2026_unique_: true,
  _x_extension_ai_provider_2026_unique_: 'openai',
  _x_extension_ai_entitlement_cache_2026_unique_: { plan: 'byok', status: 'active', updatedAt: 1773158400000 }
});
export const AI_SEARCH_LOCAL: StorageItems = Object.freeze({
  _x_extension_ai_api_key_2026_unique_: 'sk-test-0000000000000000'
});

// 0.9.20 synced one bookmark bar color; 0.9.21 split it per theme.
export const BOOKMARK_TOPBAR_SYNC: StorageItems = Object.freeze({
  _x_extension_bookmark_topbar_surface_color_2026_unique_: '#2f6feb',
  _x_extension_bookmark_topbar_surface_color_light_2026_unique_: '#f4f1ea',
  _x_extension_bookmark_topbar_surface_color_dark_2026_unique_: '#1f2329'
});

// Development builds before the fonts became device-only.
export const OVERLAY_FONT_SYNC: StorageItems = Object.freeze({
  [overlayFontFamily.key]: 'PingFang SC',
  [overlayFontFallback.key]: '',
  [overlayFontLabels.key]: { 'PingFang SC': '苹方-简' }
});

export const LEGACY_ICON_CACHES: StorageItems = Object.freeze(Object.fromEntries(
  LEGACY_SITE_SEARCH_ICON_KEYS.map((key) => [key, { google: { dataUrl: 'data:image/png;base64,AAAA', updatedAt: 1769817600000 } }])
));
