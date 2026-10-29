// The theme a suggestion row takes: the search engine's brand for the
// primary search row, the URL highlight for typed addresses, and otherwise
// its site's theme, shown at once as far as known and replaced once the
// site's icon has been read or the site's theme changes.
import { useLayoutEffect, useMemo, useState } from 'react';
import { siteThemeEvents } from '../../../favicon/theme-caches';
import { isLocalUrlSuggestion, resolveTheme } from './action-model';
import type { Suggestion, SuggestionsRuntime, SuggestionValueRef, ThemeValue } from './types';

interface RowThemeInput {
  runtime: SuggestionsRuntime;
  suggestionRef: SuggestionValueRef;
  suggestionFingerprint: string;
  isPrimary: boolean;
  onlyKeywordSuggestions: boolean;
}

// Where a row's theme comes from.
interface RowThemeSource {
  // The default search engine's brand.
  searchTheme: boolean;
  // The URL highlight theme of typed addresses and local pages.
  usesUrlFallbackTheme: boolean;
}

// A theme the row followed after it drew, and the known theme it replaced.
interface FollowedTheme {
  from: ThemeValue;
  theme: ThemeValue;
}

function readRowThemeSource(runtime: SuggestionsRuntime, suggestion: Suggestion, isPrimary: boolean,
  onlyKeywordSuggestions: boolean): RowThemeSource {
  const primarySearch = isPrimary && suggestion.type === 'googleSuggest';
  return {
    searchTheme: primarySearch || (onlyKeywordSuggestions && isPrimary && suggestion.type === 'newtab'),
    usesUrlFallbackTheme: suggestion.type === 'directUrl' || suggestion.type === 'browserPage' ||
      isLocalUrlSuggestion(runtime.options, suggestion)
  };
}

// The theme known before the site's icon has been read.
function readImmediateTheme(runtime: SuggestionsRuntime, suggestion: Suggestion, source: RowThemeSource,
  searchEngineUrl: string): ThemeValue {
  const { options } = runtime;
  let theme = options.getImmediateThemeForSuggestion(suggestion) || options.defaultTheme;
  if (source.usesUrlFallbackTheme) {
    theme = options.urlHighlightTheme;
  }
  const accent = source.searchTheme ? options.getBrandAccentForUrl(searchEngineUrl) : null;
  if (accent) {
    theme = options.buildThemeFromAccent(accent, 'brand') || options.defaultTheme;
    if (theme) {
      theme._xIsBrand = true;
    }
  }
  return theme;
}

// Returns `immediateTheme` until the site's theme is read (when `follow`)
// or changes, then that theme. Reads the suggestion through its ref, so
// the theme is looked up again only when `immediateTheme` or the ref change.
function useSiteTheme(runtime: SuggestionsRuntime, suggestionRef: SuggestionValueRef, immediateTheme: ThemeValue,
  follow: boolean): ThemeValue {
  const { options } = runtime;
  const [followed, setFollowed] = useState<FollowedTheme | null>(null);
  useLayoutEffect(() => {
    if (!follow) {
      return undefined;
    }
    const suggestion = suggestionRef.current;
    let active = true;
    const take = (theme: ThemeValue) => setFollowed({ from: immediateTheme, theme: resolveTheme(options, suggestion, theme) });
    void options.getThemeForSuggestion(suggestion).then((theme) => {
      if (active) {
        take(theme);
      }
    });
    const host = options.getThemeHostForSuggestion(suggestion);
    const stopFollowing = host
      ? siteThemeEvents.on('changed', (change) => {
        if (change.host === host) {
          take(change.theme);
        }
      })
      : undefined;
    return () => {
      active = false;
      if (stopFollowing) {
        stopFollowing();
      }
    };
  }, [follow, immediateTheme, options, suggestionRef]);
  return followed && followed.from === immediateTheme ? followed.theme : immediateTheme;
}

function useRowTheme(input: RowThemeInput): ThemeValue {
  const { runtime, suggestionRef, suggestionFingerprint, isPrimary, onlyKeywordSuggestions } = input;
  const { options } = runtime;
  const suggestion = suggestionRef.current;
  const source = readRowThemeSource(runtime, suggestion, isPrimary, onlyKeywordSuggestions);
  const searchEngineUrl = options.getDefaultSearchEngineThemeUrl();
  // The memo reads the suggestion through its ref, so it is keyed on what it
  // depends on instead: the suggestion's fingerprint, or what the theme
  // comes from in place of the suggestion.
  const immediateThemeKey = source.searchTheme ? searchEngineUrl : source.usesUrlFallbackTheme ? 1 : suggestionFingerprint;
  const immediateTheme = useMemo(
    () => readImmediateTheme(runtime, suggestionRef.current, source, searchEngineUrl),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on immediateThemeKey
    [options, immediateThemeKey]
  );
  const follow = !source.searchTheme &&
    (!onlyKeywordSuggestions || suggestion.type !== 'newtab') &&
    !source.usesUrlFallbackTheme;
  return useSiteTheme(runtime, suggestionRef, immediateTheme, follow);
}

export { useRowTheme, useSiteTheme };
