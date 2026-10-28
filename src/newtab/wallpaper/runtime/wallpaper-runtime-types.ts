// The data the wallpaper runtime and its parts in this folder share: the
// wallpapers they show, the preferences that pick them, and the one state
// object wallpaper.ts hands every part.
import type { WallpaperRecord } from '../../../shared/wallpaper-records';
import type { FeatureHintController } from '../../../shared/ui/feature-hint-catalog';
import type { WallpaperPanelActions, WallpaperPanelState, WallpaperSourceTab, ThemeScope } from '../../react/wallpaper-panel/panel-model';
import type { WallpaperViewController } from '../../react/wallpaper-view';
import type { RemoteWallpaper } from '../../remote-content-types';
import type { WallpaperAdaptiveTone } from '../wallpaper-adaptive-tone';
import type { WallpaperEffectPrefs, WallpaperEffects, WallpaperEffectStoragePrefs } from '../wallpaper-effects';
import type { WallpaperMode } from '../wallpaper-preload-types';

// A wallpaper bundled with the extension, in assets/wallpapers.
interface BuiltInWallpaper {
  id: string;
  nameKey: string;
  fallbackName: string;
  file: string;
}

// A link wallpaper as synced: the image URL and when it was added.
interface LinkWallpaperEntry {
  id: string;
  url: string;
  addedAt: number;
}

// A downscaled copy of a network image (a link, an online photo) kept on
// this device, under the URL it copies.
interface CachedWallpaperImage {
  id: string;
  url: string;
  imageDataUrl: string;
  thumbnailDataUrl: string;
  // The small copy effects sample; '' for copies cached before it existed.
  sampleDataUrl: string;
  width: number;
  height: number;
  cachedAt?: number;
}

// Any wallpaper the runtime shows: bundled, an upload, a link or an online
// photo. The runtime tells them apart by ID and reads each one's fields.
interface WallpaperItem extends
  Partial<Omit<BuiltInWallpaper, 'id'>>,
  Partial<Omit<RemoteWallpaper, 'id'>>,
  Partial<Omit<WallpaperRecord, 'id'>> {
  id: string;
  // A link's image URL.
  url?: string;
  // A daily slot showing the photo picked for today instead.
  picked?: boolean;
}

// The synced wallpaper choice per color mode.
interface WallpaperPrefs {
  version: number;
  sameForModes: boolean;
  light: string;
  dark: string;
}

// What this device shows instead of the synced choice: an upload's ID, the
// value that turns wallpaper off here, or null to follow the synced choice.
type LocalWallpaperOverrides = Record<WallpaperMode, string | null>;

// The photo picked for each daily slot today.
interface DailyWallpaperPicks {
  day: string;
  picks: Record<string, string>;
}

type AppearanceMode = 'system' | 'light' | 'dark';

// The overlay's base opacity (percent) at the top, middle and bottom, per mode.
type WallpaperOverlayStops = Readonly<Record<WallpaperMode, Readonly<{ top: number; mid: number; bottom: number }>>>;

// Saves one setting after its slider settles; a final change saves at once.
type DebouncedSaver = (key: string, write: () => void, options?: { final?: boolean } | null) => void;

interface WallpaperState {
  activeWallpaperMode: WallpaperMode;
  activeWallpaperTab: WallpaperSourceTab;
  appliedWallpaperVisualActive: boolean;
  appliedWallpaperVisualUrl: string;
  bingItems: RemoteWallpaper[];
  bingLoading: boolean;
  bingSelecting: boolean;
  // The online wallpaper whose context menu is open, or ''.
  onlineWallpaperMenuId: string;
  bingSelectionSeq: number;
  bingStatus: '' | 'loading' | 'error';
  curatedCategory: string;
  currentAppliedWallpaperEffectPrefs: WallpaperEffectPrefs;
  currentLocalWallpaperOverrides: LocalWallpaperOverrides | null;
  currentNewtabFaviconId: string;
  currentWallpaperEffectPrefsByMode: WallpaperEffectStoragePrefs;
  currentWallpaperId: string;
  currentWallpaperOverlayOpacity: Record<WallpaperMode, number>;
  currentWallpaperPrefs: WallpaperPrefs | null;
  customWallpaperCatalogLoaded: boolean;
  customWallpaperImporting: boolean;
  customWallpaperUrlClearToken: number;
  customWallpaperUrlFormOpen: boolean;
  customWallpaperUrlInvalid: boolean;
  customWallpapers: WallpaperRecord[];
  dailyWallpaperPicks: DailyWallpaperPicks;
  hasStoredWallpaperStateLoaded: boolean;
  // The labels the appearance options keep while they slide between scopes.
  heldAppearanceModeLabels: Record<AppearanceMode, string> | null;
  initialWallpaperApplied: boolean;
  initialWallpaperReadyPromise: Promise<void>;
  resolveInitialWallpaperReady: (() => void) | null;
  linkWallpapers: LinkWallpaperEntry[];
  pendingThemeScope: ThemeScope | null;
  saveSliderSetting: DebouncedSaver;
  saveWallpaperStyleSetting: DebouncedSaver;
  // Created once the runtime's parts exist.
  wallpaperAdaptiveTone: WallpaperAdaptiveTone | null;
  wallpaperButton: HTMLButtonElement | null;
  wallpaperControl: HTMLDivElement | null;
  wallpaperEffects: WallpaperEffects | null;
  // Average luminance (0-1) of the wallpapers a New Tab can open with.
  wallpaperLuminances: Map<string, number>;
  wallpaperPanel: HTMLDivElement | null;
  wallpaperPanelActions: WallpaperPanelActions | null;
  wallpaperPanelLayoutKey: string;
  wallpaperPanelOpen: boolean;
  wallpaperPanelState: WallpaperPanelState | null;
  wallpaperSourcesHintController: FeatureHintController | null;
  wallpaperStorageChangeSeq: number;
  wallpaperViewController: WallpaperViewController | null;
  wallpaperVisualSeq: number;
}

export type {
  AppearanceMode,
  BuiltInWallpaper,
  CachedWallpaperImage,
  DailyWallpaperPicks,
  DebouncedSaver,
  LinkWallpaperEntry,
  LocalWallpaperOverrides,
  WallpaperItem,
  WallpaperMode,
  WallpaperOverlayStops,
  WallpaperPrefs,
  WallpaperState
};
