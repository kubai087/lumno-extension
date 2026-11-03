// Keys older versions stored and this one no longer uses. They are listed
// so they stay documented and the migrations can still remove them.

// The UI language's messages, which versions before 0.9.50 cached in
// storage.
const LANGUAGE_MESSAGES_KEY = '_x_extension_language_messages_2024_unique_';

// The AI search settings, removed with the feature.
const REMOVED_AI_SYNC_KEYS: readonly string[] = Object.freeze([
  '_x_extension_ai_search_mode_2026_unique_',
  '_x_extension_ai_provider_2026_unique_',
  '_x_extension_ai_entitlement_cache_2026_unique_'
]);
const REMOVED_AI_LOCAL_KEYS: readonly string[] = Object.freeze([
  '_x_extension_ai_api_key_2026_unique_'
]);

// Site search icon caches the canonical cache replaced.
const LEGACY_SITE_SEARCH_ICON_KEYS: readonly string[] = Object.freeze([
  '_x_extension_site_search_icon_cache_2026_unique_',
  '_x_extension_site_search_icon_cache_retina_2026_unique_'
]);

// The New Tab material theme, which held the page light or dark under a glass
// material. The New Tab theme and the glass adaptive switch replaced it.
const NEWTAB_GLASS_THEME_KEY = '_x_extension_newtab_glass_theme_2026_unique_';

const REMOVED_KEYS: readonly string[] = Object.freeze([
  LANGUAGE_MESSAGES_KEY,
  ...REMOVED_AI_SYNC_KEYS,
  ...REMOVED_AI_LOCAL_KEYS,
  ...LEGACY_SITE_SEARCH_ICON_KEYS,
  NEWTAB_GLASS_THEME_KEY
]);

export { LANGUAGE_MESSAGES_KEY, LEGACY_SITE_SEARCH_ICON_KEYS, NEWTAB_GLASS_THEME_KEY, REMOVED_AI_LOCAL_KEYS, REMOVED_AI_SYNC_KEYS, REMOVED_KEYS };
