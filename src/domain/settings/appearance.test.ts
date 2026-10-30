import { describe, expect, it } from 'vitest';
import { simpleModeEnabled } from './appearance';
import { createGlobalThemeModeStorageUpdate, motionEffectsEnabled, normalizeThemePreference, themeMode } from './appearance';

describe('simple mode setting', () => {
  it('is stored under its own key and reads off unless turned on', () => {
    expect(simpleModeEnabled.key).toBe('_x_extension_simple_mode_enabled_2026_unique_');
    expect(simpleModeEnabled.parse(undefined)).toBe(false);
    expect(simpleModeEnabled.parse(false)).toBe(false);
    expect(simpleModeEnabled.parse(true)).toBe(true);
  });
});

describe('appearance settings', () => {
  it('reads simple mode off for a stored string', () => {
    expect(simpleModeEnabled.parse('true')).toBe(false);
  });

  it('keeps motion effects on unless turned off', () => {
    expect(motionEffectsEnabled.parse(false)).toBe(false);
    expect(motionEffectsEnabled.parse(true)).toBe(true);
    expect(motionEffectsEnabled.parse(undefined)).toBe(true);
    expect(motionEffectsEnabled.parse('false')).toBe(true);
  });

  it('reads a light or dark theme preference and nothing for the system', () => {
    expect(normalizeThemePreference('dark')).toBe('dark');
    expect(normalizeThemePreference('light')).toBe('light');
    expect(normalizeThemePreference('system')).toBe('');
  });

  it('reads a known theme mode, the system otherwise', () => {
    expect(['dark', 'light', 'system', 'other'].map((value) => themeMode.parse(value))).toEqual(['dark', 'light', 'system', 'system']);
  });

  it('writes the global theme alone, leaving the New Tab override, and normalizes an unknown one to the system', () => {
    expect(createGlobalThemeModeStorageUpdate('dark')).toEqual({ _x_extension_theme_mode_2024_unique_: 'dark' });
    expect(createGlobalThemeModeStorageUpdate('weird')).toEqual({ _x_extension_theme_mode_2024_unique_: 'system' });
  });
});
