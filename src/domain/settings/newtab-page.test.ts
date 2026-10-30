import { describe, expect, it } from 'vitest';
import { BROWSER_SYNC_KEYS } from './registry';
import { NEWTAB_GLASS_STYLES, NEWTAB_GLASS_THEMES, getNewtabGlassThemeOverride, newtabGlassStyle, newtabGlassTheme } from './newtab-page';
import { newtabAppearanceButtonVisible, newtabFeedbackButtonVisible, newtabInputAutoFocusEnabled, newtabOpenInNewTab, newtabWidthMode, normalizeNewtabSearchWidth } from './newtab-page';

// The New Tab glass material and the light or dark it may hold the page in.
describe('New Tab glass settings', () => {
  it('syncs the material and its theme', () => {
    expect(BROWSER_SYNC_KEYS).toEqual(expect.arrayContaining([newtabGlassStyle.key, newtabGlassTheme.key]));
  });

  it('reads a known material, none otherwise', () => {
    expect(NEWTAB_GLASS_STYLES).toEqual(['none', 'frosted', 'liquid']);
    [undefined, null, false, true, 'Frosted', 'glass', 1, {}].forEach((value) => expect(newtabGlassStyle.parse(value)).toBe('none'));
    ['none', 'frosted', 'liquid'].forEach((value) => expect(newtabGlassStyle.parse(value)).toBe(value));
  });

  it('reads a known material theme, following the page otherwise', () => {
    expect(NEWTAB_GLASS_THEMES).toEqual(['follow', 'light', 'dark']);
    [undefined, null, 'system', 'Light', 1].forEach((value) => expect(newtabGlassTheme.parse(value)).toBe('follow'));
  });

  it('holds the page’s theme only for a material set to light or dark', () => {
    expect(getNewtabGlassThemeOverride('none', 'dark')).toBe('');
    expect(getNewtabGlassThemeOverride('liquid', 'follow')).toBe('');
    expect(getNewtabGlassThemeOverride('liquid', undefined)).toBe('');
    expect(getNewtabGlassThemeOverride('frosted', 'light')).toBe('light');
    expect(getNewtabGlassThemeOverride('liquid', 'dark')).toBe('dark');
  });
});

describe('New Tab page settings', () => {
  it('leaves the search box unfocused unless auto-focus is turned on', () => {
    expect([undefined, true, false].map((value) => newtabInputAutoFocusEnabled.parse(value))).toEqual([false, true, false]);
  });

  it('reads which sections open in a new tab from booleans only', () => {
    const none = { search: false, shortcuts: false, bookmarks: false, recentSites: false };
    expect(newtabOpenInNewTab.parse(undefined)).toEqual(none);
    expect(newtabOpenInNewTab.parse({ search: true, bookmarks: 'true', extra: true })).toEqual({ ...none, search: true });
    expect(newtabOpenInNewTab.parse(['search'])).toEqual(none);
  });

  it('reads a standard or wide page, wide otherwise', () => {
    expect(['standard', 'wide', 'other'].map((value) => newtabWidthMode.parse(value))).toEqual(['standard', 'wide', 'wide']);
  });

  it('keeps the search width within its range, from the New Tab minimum of 640 to 1040, 920 by default', () => {
    expect(normalizeNewtabSearchWidth(639)).toBe(640);
    expect(normalizeNewtabSearchWidth(680)).toBe(680);
    expect(normalizeNewtabSearchWidth(700, { min: 720 })).toBe(720);
    expect(normalizeNewtabSearchWidth(920)).toBe(920);
    expect(normalizeNewtabSearchWidth(1200)).toBe(1040);
    expect(normalizeNewtabSearchWidth(undefined)).toBe(920);
    expect(normalizeNewtabSearchWidth(undefined, { allowNull: true })).toBeNull();
    expect(normalizeNewtabSearchWidth(639, { min: 640, max: 1040, fallback: 920 })).toBe(640);
    expect(normalizeNewtabSearchWidth(680, { min: 640, max: 1040, fallback: 920 })).toBe(680);
  });

  it.each([
    ['_x_extension_newtab_feedback_button_visible_2026_unique_', newtabFeedbackButtonVisible],
    ['_x_extension_newtab_appearance_button_visible_2026_unique_', newtabAppearanceButtonVisible]
  ])('shows the page button stored under %s unless turned off', (key, setting) => {
    expect(setting.key).toBe(key);
    expect([false, true, undefined, 'false'].map((value) => setting.parse(value))).toEqual([false, true, true, true]);
  });
});
