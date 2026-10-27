// The Appearance tab's webpage overlay section: the panel's size, width and
// opening animation, its local fonts, and whether it adapts to each page's
// colors. The fonts are this device's own; the list of installed fonts is
// read once when the section first shows.
import { useEffect, useMemo, useState } from 'react';
import {
  getOverlaySizePreset,
  normalizeOverlayFontFamily,
  normalizeOverlayFontLabels,
  overlayEnterAnimation,
  overlayFontFallback,
  overlayFontFamily,
  overlayFontLabels,
  overlayPageThemeAdaptationEnabled,
  overlaySizeMode,
  overlayWidth
} from '../../../domain/settings/overlay-panel';
import { useSetting } from '../../../shared/react/use-setting';
import { useStore } from '../../../shared/react/use-store';
import { useMessages, useOptionsPage } from '../../app/context';
import { saveSetting } from '../../app/save-setting';
import { listInstalledFonts } from '../../options-installed-fonts';
import {
  AppearanceOverlaySection as AppearanceOverlayView,
  type AppearanceOverlaySectionHandlers
} from '../../react/appearance-overlay-section';
import { getFontLabel, getOverlayModel, type OverlayValues } from './overlay-rows';

// The installed fonts by name; null until read, and when the read failed.
function useInstalledFonts(): ReadonlyMap<string, string> | null {
  const [fonts, setFonts] = useState<ReadonlyMap<string, string> | null>(null);
  useEffect(() => {
    let active = true;
    void listInstalledFonts().then((list) => {
      const entries = new Map<string, string>();
      list.forEach((font) => {
        const family = font.fontId.trim();
        if (family && !entries.has(family)) {
          entries.set(family, font.displayName.trim() || family);
        }
      });
      // An empty list means the read failed, not that no font is installed.
      if (active) setFonts(entries.size ? entries : null);
    });
    return () => {
      active = false;
    };
  }, []);
  return fonts;
}

export function AppearanceOverlaySection() {
  const { settingsStore, pageTheme, browserFamily, getViewportTopInset } = useOptionsPage();
  const t = useMessages();
  const values: OverlayValues = {
    sizeMode: useSetting(settingsStore, overlaySizeMode),
    width: useSetting(settingsStore, overlayWidth),
    enterAnimation: useSetting(settingsStore, overlayEnterAnimation),
    pageThemeAdaptation: useSetting(settingsStore, overlayPageThemeAdaptationEnabled),
    fontFamily: useSetting(settingsStore, overlayFontFamily),
    fontFallback: useSetting(settingsStore, overlayFontFallback),
    fontLabels: useSetting(settingsStore, overlayFontLabels),
    installedFonts: useInstalledFonts(),
    themeMode: useStore(pageTheme.store).mode,
    fontsUnsupported: browserFamily === 'firefox'
  };

  const { sizeMode, fontFamily, fontFallback, fontLabels, installedFonts } = values;
  const handlers = useMemo<AppearanceOverlaySectionHandlers>(() => {
    // The size's own width (also what reset picks) clears the custom value,
    // so the panel follows the size again.
    function changeWidth(value: number): void {
      const next = overlayWidth.parse(value);
      const saved = next === getOverlaySizePreset(sizeMode).width
        ? settingsStore.remove(overlayWidth)
        : settingsStore.set(overlayWidth, next);
      void saved.catch(() => {});
    }
    // A font is saved with its display name beside it, so another page (or
    // a device without the font) can still name it.
    function changeFont(key: string, value: string): void {
      const family = normalizeOverlayFontFamily(value);
      const setting = key === overlayFontFamily.key ? overlayFontFamily : key === overlayFontFallback.key ? overlayFontFallback : null;
      if (!setting) {
        return;
      }
      const label = family ? getFontLabel({ installedFonts, fontLabels }, family) : '';
      const chosen = setting === overlayFontFamily ? [family, fontFallback] : [fontFamily, family];
      const labels = normalizeOverlayFontLabels(family ? { ...fontLabels, [family]: label } : fontLabels, chosen);
      void settingsStore.setMany([[setting, family], [overlayFontLabels, labels]]).catch(() => {});
    }
    return {
      rows: {
        onToggle(key, checked) {
          if (key === overlayPageThemeAdaptationEnabled.key) {
            saveSetting(settingsStore, overlayPageThemeAdaptationEnabled, checked);
          }
        },
        onSelect(key, value) {
          if (key === overlaySizeMode.key) {
            saveSetting(settingsStore, overlaySizeMode, overlaySizeMode.parse(value));
          } else if (key === overlayEnterAnimation.key) {
            saveSetting(settingsStore, overlayEnterAnimation, overlayEnterAnimation.parse(value));
          }
        },
        onSlide(key, value) {
          if (key === overlayWidth.key) {
            changeWidth(value);
          }
        },
        getViewportTopInset
      },
      onFont: changeFont,
      onFontReset: (key) => changeFont(key, '')
    };
  }, [settingsStore, getViewportTopInset, sizeMode, fontFamily, fontFallback, fontLabels, installedFonts]);

  return <AppearanceOverlayView handlers={handlers} model={getOverlayModel(t, values)} />;
}
