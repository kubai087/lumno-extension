// The built-in wallpapers and favicons, the wallpaper modes, and the
// overlay and effect choices the wallpaper panel offers.
import type { WallpaperSourceTab } from '../react/wallpaper-panel/panel-model';
import { CUSTOM_WALLPAPER_ID } from '../../shared/wallpaper-records';
import type { NewtabFaviconOption } from './runtime/favicon-chooser';
import type { BuiltInWallpaper, WallpaperMode, WallpaperOverlayStops } from './runtime/wallpaper-runtime-types';
import * as WALLPAPER_EFFECTS from './wallpaper-effects';
import type { EffectType } from './wallpaper-effects';
import type { CrtParameterKey } from './runtime/panel-state';

const NEWTAB_WALLPAPER_EXTENSION_DIRECTORY = 'assets/wallpapers';
const NEWTAB_WALLPAPER_THUMBNAIL_SUFFIX = '-thumb.webp';
// The small copy effects and adaptive tone sample (scripts/build/generate-wallpaper-samples.js).
const NEWTAB_WALLPAPER_SAMPLE_SUFFIX = '-sample.avif';
// Every built-in wallpaper's full size; a small copy is sampled where these pixels would be.
const NEWTAB_WALLPAPER_SOURCE_SIZE = Object.freeze({ width: 2048, height: 1152 });
const NEWTAB_WALLPAPER_DEFAULT_ID = 'monet-coastal-white';
// The ID older versions stored for their single upload.
const NEWTAB_CUSTOM_WALLPAPER_ID = CUSTOM_WALLPAPER_ID || 'custom-upload';
// The override that turns wallpaper off on this device.
const NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE = '__lumno_local_wallpaper_disabled__';
const NEWTAB_WALLPAPER_PREFS_STORAGE_VERSION = 2;
const NEWTAB_WALLPAPER_MODE_LIGHT = 'light';
const NEWTAB_WALLPAPER_MODE_DARK = 'dark';
const NEWTAB_WALLPAPER_MODES: readonly WallpaperMode[] = [NEWTAB_WALLPAPER_MODE_LIGHT, NEWTAB_WALLPAPER_MODE_DARK];
const NEWTAB_WALLPAPER_OPTIONS: readonly BuiltInWallpaper[] = [
  {
    id: 'dark-linocut-topographic',
    nameKey: 'newtab_wallpaper_name_dark_linocut_topographic',
    fallbackName: 'Night topography',
    file: 'lumno-newtab-dark-linocut-topographic.webp'
  },
  {
    id: 'dark-monet-lily-nocturne',
    nameKey: 'newtab_wallpaper_name_dark_monet_lily_nocturne',
    fallbackName: 'Lily nocturne',
    file: 'lumno-newtab-dark-monet-lily-nocturne.webp'
  },
  {
    id: 'dark-shanshui-moonlit',
    nameKey: 'newtab_wallpaper_name_dark_shanshui_moonlit',
    fallbackName: 'Moonlit shanshui',
    file: 'lumno-newtab-dark-shanshui-moonlit.webp'
  },
  {
    id: 'monet-coastal-white',
    nameKey: 'newtab_wallpaper_name_monet_coastal_white',
    fallbackName: 'Monet coast',
    file: 'lumno-newtab-monet-coastal-white.webp'
  },
  {
    id: 'monet-field-white',
    nameKey: 'newtab_wallpaper_name_monet_field_white',
    fallbackName: 'Monet field',
    file: 'lumno-newtab-monet-field-white.webp'
  },
  {
    id: 'monet-lily-pond-white',
    nameKey: 'newtab_wallpaper_name_monet_lily_pond_white',
    fallbackName: 'Lily pond',
    file: 'lumno-newtab-monet-lily-pond-white.webp'
  },
  {
    id: 'impressionist-orchard-white',
    nameKey: 'newtab_wallpaper_name_impressionist_orchard_white',
    fallbackName: 'Orchard morning',
    file: 'lumno-newtab-impressionist-orchard-white.webp'
  },
  {
    id: 'seurat-coast-white',
    nameKey: 'newtab_wallpaper_name_seurat_coast_white',
    fallbackName: 'Seurat coast',
    file: 'lumno-newtab-seurat-coast-white.webp'
  },
  {
    id: 'seurat-park-white',
    nameKey: 'newtab_wallpaper_name_seurat_park_white',
    fallbackName: 'Seurat park',
    file: 'lumno-newtab-seurat-park-white.webp'
  },
  {
    id: 'seurat-riverside-white',
    nameKey: 'newtab_wallpaper_name_seurat_riverside_white',
    fallbackName: 'Seurat riverside',
    file: 'lumno-newtab-seurat-riverside-white.webp'
  },
  {
    id: 'pointillist-lakeside-white',
    nameKey: 'newtab_wallpaper_name_pointillist_lakeside_white',
    fallbackName: 'Lakeside pointillism',
    file: 'lumno-newtab-pointillist-lakeside-white.webp'
  },
  {
    id: 'white-3d-architecture',
    nameKey: 'newtab_wallpaper_name_white_3d_architecture',
    fallbackName: 'Daylight architecture',
    file: 'lumno-newtab-white-3d-architecture.webp'
  },
  {
    id: 'white-3d-observatory',
    nameKey: 'newtab_wallpaper_name_white_3d_observatory',
    fallbackName: 'Misty observatory',
    file: 'lumno-newtab-white-3d-observatory.webp'
  },
  {
    id: 'white-linocut-topographic',
    nameKey: 'newtab_wallpaper_name_white_linocut_topographic',
    fallbackName: 'Daylight topography',
    file: 'lumno-newtab-white-linocut-topographic.webp'
  },
  {
    id: 'white-risograph-collage',
    nameKey: 'newtab_wallpaper_name_white_risograph_collage',
    fallbackName: 'Daylight collage',
    file: 'lumno-newtab-white-risograph-collage.webp'
  },
  {
    id: 'white-shanshui',
    nameKey: 'newtab_wallpaper_name_white_shanshui',
    fallbackName: 'Clear shanshui',
    file: 'lumno-newtab-white-shanshui.webp'
  },
  {
    id: 'white-shanshui-bamboo-bridge',
    nameKey: 'newtab_wallpaper_name_white_shanshui_bamboo_bridge',
    fallbackName: 'Bamboo bridge',
    file: 'lumno-newtab-white-shanshui-bamboo-bridge.webp'
  },
  {
    id: 'settings-bg-light-monet-newtab',
    nameKey: 'newtab_wallpaper_name_settings_bg_light_monet_newtab',
    fallbackName: 'Monet light',
    file: 'settings-bg-light-monet-newtab.webp'
  }
];
const NEWTAB_WALLPAPER_OVERLAY_DEFAULTS: Readonly<Record<WallpaperMode, number>> = { light: 50, dark: 50 };
const NEWTAB_WALLPAPER_OVERLAY_STOPS: WallpaperOverlayStops = {
  light: { top: 54, mid: 20, bottom: 38 },
  dark: { top: 44, mid: 20, bottom: 50 }
};
const NEWTAB_WALLPAPER_EFFECT_DEFAULTS = WALLPAPER_EFFECTS.DEFAULT_PREFS;
const NEWTAB_WALLPAPER_EFFECT_TYPES: ReadonlyArray<{ type: EffectType; labelKey: string; fallback: string }> = [
  { type: 'none', labelKey: 'newtab_wallpaper_effect_none', fallback: 'Off' },
  { type: 'blur', labelKey: 'newtab_wallpaper_effect_blur', fallback: 'Glass blur' },
  { type: 'grain', labelKey: 'newtab_wallpaper_effect_grain', fallback: 'Grain' },
  { type: 'blocks', labelKey: 'newtab_wallpaper_effect_blocks', fallback: 'Blocks' },
  { type: 'halftone', labelKey: 'newtab_wallpaper_effect_halftone', fallback: 'Halftone' },
  { type: 'dither', labelKey: 'newtab_wallpaper_effect_dither', fallback: 'Dither' },
  { type: 'ascii', labelKey: 'newtab_wallpaper_effect_ascii', fallback: 'ASCII' },
  { type: 'crt', labelKey: 'newtab_wallpaper_effect_crt', fallback: 'CRT' }
];
const NEWTAB_WALLPAPER_EFFECT_INK_TONES: ReadonlyArray<{ tone: 'dark' | 'light'; labelKey: string; fallback: string }> = [
  { tone: 'dark', labelKey: 'newtab_wallpaper_effect_ink_dark', fallback: 'Shadows' },
  { tone: 'light', labelKey: 'newtab_wallpaper_effect_ink_light', fallback: 'Highlights' }
];
const NEWTAB_FAVICON_DEFAULT_ID = 'default';
const NEWTAB_FAVICON_OPTIONS: readonly NewtabFaviconOption[] = [
  {
    id: 'default',
    nameKey: 'newtab_favicon_name_default',
    fallbackName: 'Default',
    file: 'assets/images/lumno.png',
    type: 'image/png'
  },
  {
    id: 'alternate',
    nameKey: 'newtab_favicon_name_alternate',
    fallbackName: 'Alternate',
    file: 'assets/images/lumno-newtab-favicon.svg',
    preview: 'inlineSvg',
    themeAwareSvg: true,
    type: 'image/svg+xml',
    sizes: 'any'
  }
];
const NEWTAB_FAVICON_SVG_SHADOW_PATH = 'M14.1832 28.5107C14.7736 26.0503 17.4872 24.8712 19.8045 25.8872L29.0688 29.9483C23.1024 42.5571 20.9583 59.1892 34.0764 74.4517C35.5367 76.1508 37.0158 77.6786 38.5039 79.0511C15.0742 61.6944 10.3754 44.3784 14.1832 28.5107ZM50.1563 62.6667C55.3534 57.1072 64.2555 57.3891 69.0898 63.2669L69.4706 63.7295C65.5069 61.937 61.0203 61.3468 56.5866 62.1747L49.3526 63.5259L50.1563 62.6667Z';
const NEWTAB_FAVICON_SVG_MAIN_PATH = 'M34.0761 74.4516C15.8955 53.2991 27.0297 29.5157 37.0262 17.4579C38.6314 15.5217 41.5522 15.6368 43.1924 17.5435L54.2217 30.3654C58.8053 35.6938 59.7099 43.2656 56.5107 49.524L49.3531 63.5257L56.8412 62.1274C64.6007 60.6784 72.5332 63.5719 77.5374 69.6765L83.762 77.2699C85.0646 78.859 85.0813 81.1684 83.4746 82.4491C74.4334 89.6554 52.1633 95.4955 34.0761 74.4516Z';
const WALLPAPER_SOURCE_TABS: readonly WallpaperSourceTab[] = ['built-in', 'local', 'bing', 'curated'];

const WALLPAPER_EFFECT_MODE_STORAGE_VERSION = 11;
const CRT_PARAMETER_PHYSICAL_MAX: Readonly<Record<CrtParameterKey, number>> = Object.freeze({
  crtStrength: 20,
  crtBloom: 20,
  crtRgbOffset: 100,
  crtCurvature: 35
});
const BLOCK_PARAMETER_MAX = 5;

export {
  NEWTAB_WALLPAPER_EXTENSION_DIRECTORY,
  NEWTAB_WALLPAPER_THUMBNAIL_SUFFIX,
  NEWTAB_WALLPAPER_SAMPLE_SUFFIX,
  NEWTAB_WALLPAPER_SOURCE_SIZE,
  NEWTAB_WALLPAPER_DEFAULT_ID,
  NEWTAB_CUSTOM_WALLPAPER_ID,
  NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE,
  NEWTAB_WALLPAPER_PREFS_STORAGE_VERSION,
  NEWTAB_WALLPAPER_MODE_LIGHT,
  NEWTAB_WALLPAPER_MODE_DARK,
  NEWTAB_WALLPAPER_MODES,
  NEWTAB_WALLPAPER_OPTIONS,
  NEWTAB_WALLPAPER_OVERLAY_DEFAULTS,
  NEWTAB_WALLPAPER_OVERLAY_STOPS,
  NEWTAB_WALLPAPER_EFFECT_DEFAULTS,
  NEWTAB_WALLPAPER_EFFECT_TYPES,
  NEWTAB_WALLPAPER_EFFECT_INK_TONES,
  NEWTAB_FAVICON_DEFAULT_ID,
  NEWTAB_FAVICON_OPTIONS,
  NEWTAB_FAVICON_SVG_SHADOW_PATH,
  NEWTAB_FAVICON_SVG_MAIN_PATH,
  WALLPAPER_SOURCE_TABS,
  WALLPAPER_EFFECT_MODE_STORAGE_VERSION,
  CRT_PARAMETER_PHYSICAL_MAX,
  BLOCK_PARAMETER_MAX
};
