import { describe, expect, it } from 'vitest';
import {
  aggregateSearchAutoGroupEnabled,
  faviconEnhancedFetchEnabled,
  macosCtrlSuggestionNavigationEnabled,
  numberShortcutInstantEnabled,
  searchFuzzyPinyinEnabled,
  searchResultDisplayLimit,
  searchResultPriority,
  searchResultSourceTypes,
  tabRankScoreDebug
} from './search';

describe('search settings', () => {
  it('groups aggregate search tabs unless turned off', () => {
    expect([undefined, false, true].map((value) => aggregateSearchAutoGroupEnabled.parse(value))).toEqual([true, false, true]);
  });

  it('keeps instant number shortcuts, fuzzy pinyin, Control navigation on macOS and rank debugging off unless turned on', () => {
    [numberShortcutInstantEnabled, searchFuzzyPinyinEnabled, macosCtrlSuggestionNavigationEnabled, tabRankScoreDebug].forEach((setting) => {
      expect([true, false, undefined, 'true'].map((value) => setting.parse(value))).toEqual([true, false, false, false]);
    });
    expect(macosCtrlSuggestionNavigationEnabled.key).toBe('_x_extension_macos_ctrl_suggestion_navigation_enabled_2026_unique_');
  });

  it('fetches favicons the enhanced way unless turned off', () => {
    expect([false, true, undefined, 'false'].map((value) => faviconEnhancedFetchEnabled.parse(value))).toEqual([false, true, true, true]);
  });

  it('puts autocomplete first unless search comes first', () => {
    expect(['search', 'autocomplete', 'other'].map((value) => searchResultPriority.parse(value))).toEqual(['search', 'autocomplete', 'autocomplete']);
  });

  it('shows five to ten results, ten otherwise', () => {
    expect([5, '8', 10, 4, 11, 7.5, undefined].map((value) => searchResultDisplayLimit.parse(value))).toEqual([5, 8, 10, 10, 10, 10, 10]);
  });

  it('reads the result sources under their current and old names, once each, all of them when none are left', () => {
    expect(searchResultSourceTypes.parse(['topSite', 'bookmark'])).toEqual(['topSite', 'bookmark']);
    expect(searchResultSourceTypes.parse(['frequent', 'bookmarks', 'history', 'history'])).toEqual(['topSite', 'bookmark', 'history']);
    expect(searchResultSourceTypes.parse([])).toEqual(['topSite', 'bookmark', 'history']);
  });
});
