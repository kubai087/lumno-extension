// The Appearance tab: the global section, the webpage overlay section, and
// New Tab's look, daily quote and layout under one section.
import { Fragment } from 'react';
import {
  bookmarkColumns,
  bookmarkCount,
  bookmarkFolderIconsVisible,
  motionEffectsEnabled,
  newtabAppearanceButtonVisible,
  newtabFeedbackButtonVisible,
  newtabGlassStyle,
  newtabGlassTheme,
  newtabInputAutoFocusEnabled,
  newtabQuotePrefs,
  newtabShortcutAddVisible,
  newtabShortcutColumns,
  newtabShortcutDockMagnificationEnabled,
  newtabShortcutGap,
  newtabShortcutSize,
  newtabShortcutsVisible,
  newtabShortcutWidth,
  newtabTime12Hour,
  newtabTimeFont,
  newtabTimeFontSize,
  newtabTimeFontWeight,
  newtabTimeInk,
  newtabTimeOpacity,
  newtabTimeSecondsVisible,
  newtabTopContentMode,
  newtabWidthMode,
  recentCount,
  recentMode,
  simpleModeEnabled
} from '../../../domain/settings';
import type { Setting } from '../../../domain/settings/define';
import { customQuotes } from '../../../domain/settings/newtab-quote';
import {
  overlayEnterAnimation,
  overlayFontFallback,
  overlayFontFamily,
  overlayFontLabels,
  overlayPageThemeAdaptationEnabled,
  overlaySizeMode,
  overlayWidth
} from '../../../domain/settings/overlay-panel';
import { SettingRows } from '../../react/setting-rows';
import { DailyQuoteSection } from './daily-quote-section';
import { AppearanceGlobalSection } from './global-section';
import { NewtabLayoutSection } from './newtab-layout-section';
import { NewtabLookSection } from './newtab-look-section';
import { AppearanceOverlaySection } from './overlay-section';

// Every setting the tab shows, read with the page's other startup reads.
export const APPEARANCE_TAB_SETTINGS: readonly Setting<unknown>[] = [
  motionEffectsEnabled,
  simpleModeEnabled,
  overlaySizeMode,
  overlayWidth,
  overlayEnterAnimation,
  overlayPageThemeAdaptationEnabled,
  overlayFontFamily,
  overlayFontFallback,
  overlayFontLabels,
  newtabGlassStyle,
  newtabGlassTheme,
  newtabWidthMode,
  newtabTopContentMode,
  newtabTimeFont,
  newtabTimeFontWeight,
  newtabTimeFontSize,
  newtabTimeOpacity,
  newtabTimeInk,
  newtabTimeSecondsVisible,
  newtabTime12Hour,
  newtabQuotePrefs,
  customQuotes,
  newtabInputAutoFocusEnabled,
  newtabShortcutsVisible,
  newtabShortcutAddVisible,
  newtabShortcutDockMagnificationEnabled,
  newtabShortcutColumns,
  newtabShortcutWidth,
  newtabShortcutSize,
  newtabShortcutGap,
  bookmarkCount,
  bookmarkColumns,
  bookmarkFolderIconsVisible,
  recentCount,
  recentMode,
  newtabFeedbackButtonVisible,
  newtabAppearanceButtonVisible
];

export function AppearanceTab() {
  return (
    <SettingRows>
      {[
        <AppearanceGlobalSection key="global" />,
        <AppearanceOverlaySection key="overlay" />,
        <Fragment key="newtab">
          <NewtabLookSection />
          <DailyQuoteSection />
          <NewtabLayoutSection />
        </Fragment>
      ]}
    </SettingRows>
  );
}
