// Settings the appearance panel edits besides the wallpaper: top content
// and the clock, search width and the shortcut grid sliders.
import { queryHtmlElement, queryHtmlElements } from '../../../shared/dom-lookup';
import type { WallpaperState } from './wallpaper-runtime-types';
import { readBootValue } from '../../../platform/boot-handoff';
import type { SettingsStore } from '../../../platform/settings-store';
import type { TimePreview } from '../../top-content/time-preview';
import {
  getNewtabTimeFont,
  newtabTime12Hour,
  newtabTimeFont,
  newtabTimeFontSize,
  newtabTimeFontWeight,
  newtabTimeInk,
  newtabTimeOpacity,
  newtabTimeSecondsVisible,
  newtabTopContentMode
} from '../../../domain/settings/newtab-time';

// A slider's range and its value when none is saved.
interface SliderConfig {
  min?: number;
  max?: number;
  fallback?: number;
}

interface SearchWidthConfig extends SliderConfig {
  // The widths the slider settles on near them, and how near (px).
  snapPoints?: readonly number[];
  snapThreshold?: number;
}

// Whether a layout change is only shown or also saved.
type PersistOptions = { persist: boolean };

// A slider change; a final one saves at once.
type SliderSaveOptions = { final?: boolean } | null | undefined;

interface PanelSettingsDeps {
  renderWallpaperPanelState(): void;
  settings: Pick<SettingsStore, 'set' | 'setMany'>;
  timePreview: Pick<TimePreview, 'show'>;
  // The appearance panel's elements by data-wallpaper-ref name.
  getWallpaperPanelRefs(): Readonly<Partial<Record<string, HTMLElement>>>;
  searchWidthConfig: SearchWidthConfig;
  setSearchWidth(width: number, options: PersistOptions): void;
  shortcutColumnsConfig: SliderConfig;
  setShortcutColumns(columns: number, options: PersistOptions): void;
  shortcutSizeConfig: SliderConfig;
  shortcutGapConfig: SliderConfig;
  setShortcutSize(size: number, options: PersistOptions): void;
  setShortcutGap(gap: number, options: PersistOptions): void;
  wallpaperState: Pick<WallpaperState,
    'initialWallpaperApplied' | 'resolveInitialWallpaperReady' | 'saveSliderSetting'>;
}

function createPanelSettings(deps: PanelSettingsDeps) {
  const {
    renderWallpaperPanelState,
    settings,
    timePreview,
    getWallpaperPanelRefs,
    searchWidthConfig,
    setSearchWidth,
    shortcutColumnsConfig,
    setShortcutColumns,
    shortcutSizeConfig,
    shortcutGapConfig,
    setShortcutSize,
    setShortcutGap
  } = deps;

  // The runtime state object shared with wallpaper.ts and the other modules.
  const wallpaperState = deps.wallpaperState;

  function finalizeInitialWallpaper(): void {
    if (wallpaperState.initialWallpaperApplied) {
      return;
    }
    wallpaperState.initialWallpaperApplied = true;
    // The first sample has taken the preload's decoded image if it showed the same wallpaper.
    const wallpaperPreload = readBootValue('wallpaperPreload');
    if (wallpaperPreload && wallpaperPreload.decodedImage) {
      wallpaperPreload.decodedImage = null;
    }
    if (typeof wallpaperState.resolveInitialWallpaperReady === 'function') {
      wallpaperState.resolveInitialWallpaperReady();
    }
  }

  function persistTopContentMode(value: unknown): void {
    void settings.set(newtabTopContentMode, newtabTopContentMode.parse(value));
  }

  function persistTimeFontWeight(value: unknown): void {
    void settings.set(newtabTimeFontWeight, newtabTimeFontWeight.parse(value));
  }

  // The clock follows the slider at once; the value is saved once it settles.
  function persistTimeFontSizeFromSlider(value: unknown, change?: SliderSaveOptions): void {
    const size = newtabTimeFontSize.parse(value);
    timePreview.show({ fontSize: size });
    renderWallpaperPanelState();
    wallpaperState.saveSliderSetting('timeFontSize', () => void settings.set(newtabTimeFontSize, size), change);
  }

  function persistTimeOpacityFromSlider(value: unknown, change?: SliderSaveOptions): void {
    const opacity = newtabTimeOpacity.parse(value);
    timePreview.show({ opacity });
    renderWallpaperPanelState();
    wallpaperState.saveSliderSetting('timeOpacity', () => void settings.set(newtabTimeOpacity, opacity), change);
  }

  function persistTimeInk(value: unknown): void {
    void settings.set(newtabTimeInk, newtabTimeInk.parse(value));
  }

  // Each face opens at the weight it reads best at, so switching faces
  // also moves the weight to the new face's default.
  function persistTimeFont(value: unknown): void {
    const nextValue = newtabTimeFont.parse(value);
    void settings.setMany([
      [newtabTimeFont, nextValue],
      [newtabTimeFontWeight, getNewtabTimeFont(nextValue).defaultWeight]
    ]);
  }

  function persistTimeSecondsVisible(value: unknown): void {
    void settings.set(newtabTimeSecondsVisible, newtabTimeSecondsVisible.parse(value));
  }

  function persistTime12Hour(value: unknown): void {
    void settings.set(newtabTime12Hour, newtabTime12Hour.parse(value));
  }

  function getWallpaperAppearanceOptionButtons(): HTMLElement[] {
    const options = getWallpaperPanelRefs().appearanceOptions;
    return options ? queryHtmlElements(options, '.x-nt-appearance-option') : [];
  }
  // The part of an appearance option that moves; the option itself when it has none.
  function getWallpaperAppearanceOptionMotionElement(button: HTMLElement): HTMLElement {
    return queryHtmlElement(button, '.x-nt-appearance-option-content') || button;
  }

  function getSearchWidthMin(): number {
    return Number.isFinite(Number(searchWidthConfig.min)) ? Number(searchWidthConfig.min) : 640;
  }

  function getSearchWidthMax(): number {
    const min = getSearchWidthMin();
    const max = Number.isFinite(Number(searchWidthConfig.max)) ? Number(searchWidthConfig.max) : 1040;
    return Math.max(min + 1, max);
  }

  function normalizeSearchWidthValue(value: unknown): number {
    const min = getSearchWidthMin();
    const max = getSearchWidthMax();
    const fallback = Number.isFinite(Number(searchWidthConfig.fallback))
      ? Number(searchWidthConfig.fallback)
      : 920;
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return Math.min(max, Math.max(min, Math.round(fallback)));
    }
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function getSearchWidthSnapPoints(): number[] {
    const points = searchWidthConfig.snapPoints || [640, 720, 920, 1040];
    return points.map(normalizeSearchWidthValue)
      .filter((value, index, array) => array.indexOf(value) === index)
      .sort((a, b) => a - b);
  }

  function getSearchWidthPercent(value: unknown): number {
    const min = getSearchWidthMin();
    const max = getSearchWidthMax();
    return ((normalizeSearchWidthValue(value) - min) / (max - min)) * 100;
  }

  function snapSearchWidthValue(value: unknown, threshold: number): number {
    const width = normalizeSearchWidthValue(value);
    const snapThreshold = Number.isFinite(Number(threshold))
      ? Number(threshold)
      : Number(searchWidthConfig.snapThreshold || 14);
    const matched = getSearchWidthSnapPoints().find((point) => Math.abs(point - width) <= snapThreshold);
    return matched !== undefined ? matched : width;
  }

  function formatSearchWidthValue(value: unknown): string {
    return `${normalizeSearchWidthValue(value)} px`;
  }

  function persistSearchWidthFromSlider(value: unknown, options?: SliderSaveOptions): void {
    const final = Boolean(options && options.final);
    const threshold = final
      ? Number(searchWidthConfig.snapThreshold || 14) * 1.35
      : Number(searchWidthConfig.snapThreshold || 14);
    const width = snapSearchWidthValue(value, threshold);
    setSearchWidth(width, { persist: false });
    renderWallpaperPanelState();
    wallpaperState.saveSliderSetting('searchWidth', () => setSearchWidth(width, { persist: true }), { final });
  }
  function getShortcutColumnsMin(): number {
    return Number.isFinite(Number(shortcutColumnsConfig.min))
      ? Number(shortcutColumnsConfig.min)
      : 4;
  }

  function getShortcutColumnsMax(): number {
    const min = getShortcutColumnsMin();
    const max = Number.isFinite(Number(shortcutColumnsConfig.max))
      ? Number(shortcutColumnsConfig.max)
      : 16;
    return Math.max(min, max);
  }

  function normalizeShortcutColumnsValue(value: unknown): number {
    const min = getShortcutColumnsMin();
    const max = getShortcutColumnsMax();
    const fallback = Number.isFinite(Number(shortcutColumnsConfig.fallback))
      ? Number(shortcutColumnsConfig.fallback)
      : 10;
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return Math.min(max, Math.max(min, Math.round(fallback)));
    }
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function getShortcutColumnsTickValues(): number[] {
    return [4, 8, 12, 16].map(normalizeShortcutColumnsValue)
      .filter((value, index, array) => array.indexOf(value) === index)
      .sort((a, b) => a - b);
  }

  function getShortcutColumnsPercent(value: unknown): number {
    const min = getShortcutColumnsMin();
    const max = getShortcutColumnsMax();
    if (max <= min) {
      return 0;
    }
    return ((normalizeShortcutColumnsValue(value) - min) / (max - min)) * 100;
  }

  function persistShortcutColumnsFromSlider(value: unknown, options?: SliderSaveOptions): void {
    const columns = normalizeShortcutColumnsValue(value);
    setShortcutColumns(columns, { persist: false });
    renderWallpaperPanelState();
    wallpaperState.saveSliderSetting('shortcutColumns', () => setShortcutColumns(columns, { persist: true }), options);
  }
  function getShortcutLayoutMin(config: SliderConfig | null | undefined, fallback: number): number {
    const min = Number(config && config.min);
    return Number.isFinite(min) ? min : fallback;
  }

  function getShortcutLayoutMax(config: SliderConfig | null | undefined, fallbackMin: number, fallbackMax: number): number {
    const min = getShortcutLayoutMin(config, fallbackMin);
    const configuredMax = Number(config && config.max);
    const max = Number.isFinite(configuredMax) ? configuredMax : fallbackMax;
    return Math.max(min, max);
  }

  function getShortcutLayoutDefault(
    config: SliderConfig | null | undefined,
    fallbackMin: number,
    fallbackMax: number,
    fallbackValue: number
  ): number {
    const min = getShortcutLayoutMin(config, fallbackMin);
    const max = getShortcutLayoutMax(config, fallbackMin, fallbackMax);
    const configuredValue = Number(config && config.fallback);
    const value = Number.isFinite(configuredValue) ? configuredValue : fallbackValue;
    return Math.min(max, Math.max(min, Math.round(value)));
  }

  function normalizeShortcutLayoutValue(
    value: unknown,
    config: SliderConfig | null | undefined,
    fallbackMin: number,
    fallbackMax: number,
    fallbackValue: number
  ): number {
    const min = getShortcutLayoutMin(config, fallbackMin);
    const max = getShortcutLayoutMax(config, fallbackMin, fallbackMax);
    const fallback = getShortcutLayoutDefault(
      config,
      fallbackMin,
      fallbackMax,
      fallbackValue
    );
    const number = Number(value);
    return Math.min(
      max,
      Math.max(min, Number.isFinite(number) ? Math.round(number) : fallback)
    );
  }

  function getShortcutLayoutPercent(
    value: unknown,
    config: SliderConfig | null | undefined,
    fallbackMin: number,
    fallbackMax: number,
    fallbackValue: number
  ): number {
    const min = getShortcutLayoutMin(config, fallbackMin);
    const max = getShortcutLayoutMax(config, fallbackMin, fallbackMax);
    if (max <= min) {
      return 0;
    }
    const normalized = normalizeShortcutLayoutValue(
      value,
      config,
      fallbackMin,
      fallbackMax,
      fallbackValue
    );
    return ((normalized - min) / (max - min)) * 100;
  }

  function normalizeShortcutSizeValue(value: unknown): number {
    return normalizeShortcutLayoutValue(value, shortcutSizeConfig, 48, 112, 64);
  }

  function normalizeShortcutGapValue(value: unknown): number {
    return normalizeShortcutLayoutValue(value, shortcutGapConfig, 0, 24, 4);
  }

  function persistShortcutSizeFromSlider(value: unknown, options?: SliderSaveOptions): void {
    const size = normalizeShortcutSizeValue(value);
    setShortcutSize(size, { persist: false });
    renderWallpaperPanelState();
    wallpaperState.saveSliderSetting('shortcutSize', () => setShortcutSize(size, { persist: true }), options);
  }
  function persistShortcutGapFromSlider(value: unknown, options?: SliderSaveOptions): void {
    const gap = normalizeShortcutGapValue(value);
    setShortcutGap(gap, { persist: false });
    renderWallpaperPanelState();
    wallpaperState.saveSliderSetting('shortcutGap', () => setShortcutGap(gap, { persist: true }), options);
  }

  return {
    finalizeInitialWallpaper,
    persistTopContentMode,
    persistTimeFontWeight,
    persistTimeFontSizeFromSlider,
    persistTimeOpacityFromSlider,
    persistTimeInk,
    persistTimeFont,
    persistTimeSecondsVisible,
    persistTime12Hour,
    getWallpaperAppearanceOptionButtons,
    getWallpaperAppearanceOptionMotionElement,
    getSearchWidthMin,
    getSearchWidthMax,
    normalizeSearchWidthValue,
    getSearchWidthSnapPoints,
    getSearchWidthPercent,
    formatSearchWidthValue,
    persistSearchWidthFromSlider,
    getShortcutColumnsMin,
    getShortcutColumnsMax,
    normalizeShortcutColumnsValue,
    getShortcutColumnsTickValues,
    getShortcutColumnsPercent,
    persistShortcutColumnsFromSlider,
    getShortcutLayoutMin,
    getShortcutLayoutMax,
    getShortcutLayoutDefault,
    getShortcutLayoutPercent,
    normalizeShortcutSizeValue,
    normalizeShortcutGapValue,
    persistShortcutSizeFromSlider,
    persistShortcutGapFromSlider
  };
}

type PanelSettings = ReturnType<typeof createPanelSettings>;

export { createPanelSettings };
export type { PanelSettings, PanelSettingsDeps, SearchWidthConfig, SliderConfig };
