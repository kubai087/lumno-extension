// What the suggestion list tests share: the options a surface passes, a
// view made from them, and rendering suggestions into it.
import { act } from 'react';
import { createStore } from '../../src/shared/state/store';
import { queryHtmlElement, queryHtmlElements } from '../../src/shared/dom-lookup';
import * as suggestionActionModel from '../../src/domain/search/suggestion-action-model';
import {
  createSuggestionsView,
  type OpenTabSuggestion,
  type Suggestion,
  type SuggestionElement,
  type SuggestionsRenderPayload,
  type SuggestionsViewController,
  type SuggestionsViewOptions
} from '../../src/shared/react/search/suggestions';
import type { SuggestionsShownState } from '../../src/shared/react/search/suggestion-list/types';
import type { Store } from '../../src/shared/state/store';

// A list view with the store its surface sets to show suggestions or tabs.
export type SuggestionsHarness = SuggestionsViewController & { list: Store<SuggestionsShownState> };
import { getTestPortals } from './portals';

let views: SuggestionsHarness[] = [];
export const sharedSuggestionActionModel: NonNullable<SuggestionsViewOptions['actionModel']> =
  suggestionActionModel;

export function createOptions(
  overrides: Partial<SuggestionsViewOptions> = {}
): {
  options: SuggestionsViewOptions;
  container: HTMLElement;
  items: SuggestionElement[];
  getSelectedIndex: () => number;
  // Selects a row as the surface would.
  select: (index: number) => void;
  // Sets the modifier keys held.
  setModifiers: (modifiers: Partial<{ openInCurrentTab: boolean; openSwitchInNewTab: boolean; openInBackgroundTab: boolean }>) => void;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const items: SuggestionElement[] = [];
  const selectionStore = createStore({ selectedIndex: -1 });
  const modifierStore = createStore({ openInCurrentTab: false, openSwitchInNewTab: false, openInBackgroundTab: false });
  const select = (selectedIndex: number) => selectionStore.setState({ selectedIndex });
  const defaultTheme = {
    buttonText: '#111',
    buttonBg: '#eee',
    buttonBorder: '#ddd',
    tagBg: '#def',
    tagText: '#123',
    tagBorder: '#abc'
  };
  const actionModel = {
    ...sharedSuggestionActionModel,
    ...(overrides.actionModel || {})
  };
  const options: SuggestionsViewOptions = {
    document,
    container,
    items,
    t: (_key, fallback) => fallback,
    formatMessage: (_key, fallback, values = {}) =>
      Object.entries(values).reduce(
        (text, [key, value]) =>
          text.replace(`{${key}}`, value),
        fallback
      ),
    sanitizeDisplayText: (value) => String(value || ''),
    getHostFromUrl: (url) => {
      try {
        return new URL(url).hostname;
      } catch {
        return '';
      }
    },
    getThemeHostForSuggestion: (suggestion) => {
      try {
        return new URL(String(suggestion.url || '')).hostname;
      } catch {
        return '';
      }
    },
    getImmediateThemeForSuggestion: () => defaultTheme,
    getThemeForSuggestion: () =>
      new Promise(() => {
        // Keep async theme resolution pending for deterministic tests.
      }),
    getThemeForMode: (theme) => theme || defaultTheme,
    getHoverColors: () => ({
      bg: '#eee',
      border: '#ddd'
    }),
    getNeutralHoverActionColors: () => ({
      bg: '#f5f5f5',
      border: '#ddd',
      text: '#555'
    }),
    applyThemeVariables: (item) => {
      item.dataset.themed = 'true';
    },
    applyMarkVariables: (item) => {
      item.dataset.markThemed = 'true';
    },
    getPageFaviconRenderCandidates: (_url, favicon) => ({
      primaryUrl: favicon
    }),
    attachFaviconWithFallbacks: (image, _url, _host, candidates) => {
      image.src =
        candidates.primaryUrl ||
        'data:image/png;base64,dGVzdA==';
    },
    selection: { store: selectionStore, select },
    modifiers: { store: modifierStore },
    ...overrides,
    portals: overrides.portals || getTestPortals(),
    actionModel
  };
  return {
    options,
    container,
    items,
    getSelectedIndex: () => selectionStore.getSnapshot().selectedIndex,
    select: (index) => act(() => select(index)),
    setModifiers: (modifiers) => act(() => modifierStore.setState(modifiers))
  };
}

export function createView(
  overrides: Partial<SuggestionsViewOptions> = {}
) {
  const list = createStore<SuggestionsShownState>({ shown: { kind: 'nothing' } });
  const result = createOptions({ list, ...overrides });
  const view: SuggestionsHarness = { ...createSuggestionsView(result.options), list };
  views.push(view);
  return { view, ...result };
}

// What a surface does to show suggestions, tabs or nothing in the list.
export function showSuggestions(view: SuggestionsHarness, payload: SuggestionsRenderPayload): void {
  view.list.setState({ shown: { kind: 'suggestions', payload } });
}

export function showTabs(view: SuggestionsHarness, tabs: OpenTabSuggestion[]): void {
  view.list.setState({ shown: { kind: 'tabs', tabs } });
}

export function showNothing(view: SuggestionsHarness): void {
  view.list.setState({ shown: { kind: 'nothing' } });
}

export function render(
  view: SuggestionsHarness,
  suggestions: Suggestion[],
  extra: Record<string, unknown> = {}
): void {
  act(() => {
    showSuggestions(view, {
      suggestions,
      query: 'exa',
      primaryHighlightIndex: 0,
      primaryHighlightReason: 'default',
      ...extra
    });
  });
}

// Destroys the views a test made and empties the page.
export function destroyViews(): void {
  act(() => {
    views.forEach((view) => view.destroy());
  });
  views = [];
  document.body.textContent = '';
}

// A part of a row by its class on either surface (x-nt- or x-ov-).
export function rowPart(item: Element | undefined, name: string): HTMLElement | null {
  return item ? queryHtmlElement(item, `.x-nt-${name}, .x-ov-${name}`) : null;
}

// Every part of a row with that class.
export function rowParts(item: Element | undefined, name: string): HTMLElement[] {
  return item ? queryHtmlElements(item, `.x-nt-${name}, .x-ov-${name}`) : [];
}
