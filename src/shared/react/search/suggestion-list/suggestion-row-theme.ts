// The theme a search suggestion row takes: the search engine's brand for
// the primary search row, the URL highlight for typed addresses, and
// otherwise its site's theme, shown at once as far as known and replaced
// once the site's icon has been read.
import { useLayoutEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import { isLocalUrlSuggestion, resolveTheme } from './action-model';
import type { Suggestion, SuggestionElement, SuggestionsRuntime, SuggestionValueRef, ThemeValue } from './types';

interface RowThemeInput {
  runtime: SuggestionsRuntime;
  suggestionRef: SuggestionValueRef;
  suggestionFingerprint: string;
  isPrimary: boolean;
  onlyKeywordSuggestions: boolean;
  simpleMode: boolean;
  itemRef: RefObject<SuggestionElement | null>;
}

// Where a row's theme comes from.
interface RowThemeSource {
  // The default search engine's brand.
  searchTheme: boolean;
  // The URL highlight theme of typed addresses and local pages.
  usesUrlFallbackTheme: boolean;
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

// Shows the row in its known theme, then in its site's theme once that has
// been read (when `load`), telling `onChange`; returns the function that
// stops waiting.
function followSiteTheme(runtime: SuggestionsRuntime, item: SuggestionElement, suggestion: Suggestion,
  immediateTheme: ThemeValue, load: boolean, onChange: () => void): () => void {
  const { options } = runtime;
  item._xTheme = immediateTheme;
  options.applyThemeVariables(item, immediateTheme);
  let active = true;
  if (load) {
    void options.getThemeForSuggestion(suggestion).then((theme) => {
      if (!active || !item.isConnected) {
        return;
      }
      const nextTheme = resolveTheme(options, suggestion, theme);
      item._xTheme = nextTheme;
      options.applyThemeVariables(item, nextTheme);
      onChange();
    });
  }
  return () => {
    active = false;
  };
}

// Returns a count that rises each time the row's site theme arrives.
function useRowTheme(input: RowThemeInput): number {
  const { runtime, suggestionRef, suggestionFingerprint, isPrimary, onlyKeywordSuggestions, simpleMode, itemRef } = input;
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
  const shouldLoadTheme = !source.searchTheme &&
    (!onlyKeywordSuggestions || suggestion.type !== 'newtab') &&
    !source.usesUrlFallbackTheme;

  const [themeVersion, setThemeVersion] = useState(0);
  useLayoutEffect(() => {
    const item = itemRef.current;
    return item
      ? followSiteTheme(runtime, item, suggestionRef.current, immediateTheme, shouldLoadTheme, () => setThemeVersion((version) => version + 1))
      : undefined;
  }, [immediateTheme, itemRef, runtime, simpleMode, shouldLoadTheme, suggestionRef]);
  return themeVersion;
}

export { followSiteTheme, useRowTheme };
