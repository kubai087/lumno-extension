// The look of New Tab in the Appearance tab. Unset values stay unset, so
// opening Options does not write the defaults.
import { useMemo } from 'react';
import {
  getNewtabTimeFont,
  newtabGlassStyle,
  newtabGlassTheme,
  newtabTime12Hour,
  newtabTimeFont,
  newtabTimeFontSize,
  newtabTimeFontWeight,
  newtabTimeInk,
  newtabTimeOpacity,
  newtabTimeSecondsVisible,
  newtabTopContentMode,
  newtabWidthMode
} from '../../../domain/settings';
import { useSetting } from '../../../shared/react/use-setting';
import { useMessages, useOptionsPage } from '../../app/context';
import { saveSetting } from '../../app/save-setting';
import { SettingsRows, type SettingsRowsHandlers } from '../../react/settings-rows-view';
import { getNewtabLookRows } from './newtab-look-rows';

const TOGGLES = [newtabTimeSecondsVisible, newtabTime12Hour];

export function NewtabLookSection() {
  const { settingsStore, notifyNewtab, getViewportTopInset } = useOptionsPage();
  const t = useMessages();
  const values = {
    glassStyle: useSetting(settingsStore, newtabGlassStyle),
    glassTheme: useSetting(settingsStore, newtabGlassTheme),
    widthMode: useSetting(settingsStore, newtabWidthMode),
    topContent: useSetting(settingsStore, newtabTopContentMode),
    timeFont: useSetting(settingsStore, newtabTimeFont),
    timeFontWeight: useSetting(settingsStore, newtabTimeFontWeight),
    timeFontSize: useSetting(settingsStore, newtabTimeFontSize),
    timeOpacity: useSetting(settingsStore, newtabTimeOpacity),
    timeInk: useSetting(settingsStore, newtabTimeInk),
    timeSeconds: useSetting(settingsStore, newtabTimeSecondsVisible),
    time12Hour: useSetting(settingsStore, newtabTime12Hour)
  };
  const handlers = useMemo<SettingsRowsHandlers>(() => ({
    onToggle(key, checked) {
      const setting = TOGGLES.find((entry) => entry.key === key);
      if (setting) {
        saveSetting(settingsStore, setting, checked);
      }
    },
    onSelect(key, value) {
      switch (key) {
        case newtabGlassStyle.key:
          saveSetting(settingsStore, newtabGlassStyle, newtabGlassStyle.parse(value));
          break;
        case newtabGlassTheme.key:
          saveSetting(settingsStore, newtabGlassTheme, newtabGlassTheme.parse(value));
          break;
        case newtabWidthMode.key:
          saveSetting(settingsStore, newtabWidthMode, newtabWidthMode.parse(value));
          notifyNewtab('all');
          break;
        case newtabTopContentMode.key:
          saveSetting(settingsStore, newtabTopContentMode, newtabTopContentMode.parse(value));
          break;
        case newtabTimeFont.key: {
          // Each face opens at its own default weight, as in New Tab's panel.
          const font = newtabTimeFont.parse(value);
          void settingsStore.setMany([
            [newtabTimeFont, font],
            [newtabTimeFontWeight, getNewtabTimeFont(font).defaultWeight]
          ]).catch(() => {});
          break;
        }
        case newtabTimeInk.key:
          saveSetting(settingsStore, newtabTimeInk, newtabTimeInk.parse(value));
          break;
      }
    },
    onSlide(key, value) {
      switch (key) {
        case newtabTimeFontWeight.key:
          saveSetting(settingsStore, newtabTimeFontWeight, newtabTimeFontWeight.parse(value));
          break;
        case newtabTimeFontSize.key:
          saveSetting(settingsStore, newtabTimeFontSize, newtabTimeFontSize.parse(value));
          break;
        case newtabTimeOpacity.key:
          saveSetting(settingsStore, newtabTimeOpacity, newtabTimeOpacity.parse(value));
          break;
      }
    },
    getViewportTopInset
  }), [settingsStore, notifyNewtab, getViewportTopInset]);
  return <SettingsRows handlers={handlers} rows={getNewtabLookRows(t, values)} />;
}
