// How the results area is laid out: the open tabs viewport and its
// scrollbar gutter, the divider, the offset under an open mode menu,
// collapsing results, the input's right padding and the tab hint.
import type { SearchInputParts } from '../../shared/react/search-input';
import type { SuggestionsViewController } from '../../shared/react/search/suggestion-list/types';
import type { InputModeController } from '../../shared/search/search-input-mode';
import type { InputModeProvider } from '../../shared/search/input-mode/types';
import { overlayOpenTabsDefaultVisible } from '../../domain/settings/overlay-panel';
import { searchResultDisplayLimit } from '../../domain/settings/search';
import type { OverlaySettings } from '../overlay-settings';
import type { SearchMode } from '../../shared/search-panel/search-mode';
import type { SearchResults } from '../../shared/search-panel/search-results';
import type { OverlaySuggestion } from './types';
import * as SUGGESTION_NAVIGATION from '../../shared/search/suggestion-navigation';
import * as SUGGESTIONS_HEIGHT_LAYOUT from '../../shared/search/suggestions-height-layout';

interface ResultsLayoutState {
  settings: Pick<OverlaySettings, 'get' | 'isLoaded'>;
  overlay: HTMLElement | null;
  inputContainer: HTMLElement | null;
  inputParts: Pick<SearchInputParts, 'setChrome'> | null;
  suggestionsContainer: HTMLElement | null;
  // The panel's styles live in its own shadow root, so inline styles need
  // no !important.
  inputModeController: Pick<InputModeController,
    'placeModeMenuBelowResults' | 'updateLayout' | 'setTabHintVisible'> | null;
  lastRenderedQuery: string;
  lastRenderedActionContextKey: string;
}

interface ResultsLayoutDeps {
  searchResults: SearchResults<OverlaySuggestion>;
  searchMode: SearchMode<InputModeProvider>;
  normalizeSearchResultDisplayLimit(value: unknown): number;
  setInputScopedStyle(element: HTMLElement | null, property: string, value: string): void;
  ensureOverlaySuggestionsView(): Pick<SuggestionsViewController, 'clear'>;
  // The rendered rows; emptied with the list.
  suggestionItems: unknown[];
  overlayState: ResultsLayoutState;
}

type CssPixelProperty = 'borderLeftWidth' | 'borderRightWidth' | 'paddingTop' | 'paddingBottom' | `--${string}`;

function isCustomProperty(property: string): property is `--${string}` {
  return property.startsWith('--');
}

function createResultsLayout(deps: ResultsLayoutDeps) {
  const {
    searchResults,
    searchMode,
    normalizeSearchResultDisplayLimit,
    setInputScopedStyle,
    ensureOverlaySuggestionsView,
    suggestionItems,
  } = deps;

  // The panel state object shared with search-panel.ts and the other modules.
  const overlayState = deps.overlayState;

  const setOverlayPanelScopedStyle = (element: HTMLElement | null, property: string, value: string): void => {
    if (!element) {
      return;
    }
    element.style.setProperty(property, value, 'important');
  };
  function readComputedCssPixels(computedStyle: CSSStyleDeclaration | null, property: CssPixelProperty): number {
    if (!computedStyle) {
      return 0;
    }
    const rawValue: unknown = isCustomProperty(property) &&
        typeof computedStyle.getPropertyValue === 'function'
      ? computedStyle.getPropertyValue(property)
      : Reflect.get(computedStyle, property);
    const value = Number.parseFloat(String(rawValue));
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }
  // Gives rows back the width of the open tabs list's real scrollbar.
  function syncOpenTabsScrollbarGutter(computedStyle?: CSSStyleDeclaration): void {
    const container = overlayState.suggestionsContainer;
    if (!container || !container.hasAttribute('data-open-tabs-visible-row-limit')) {
      return;
    }
    const style = computedStyle || window.getComputedStyle(container);
    const gutterWidth = Math.max(
      0,
      Math.round(
        (Number(container.offsetWidth) || 0) -
        (Number(container.clientWidth) || 0) -
        readComputedCssPixels(style, 'borderLeftWidth') -
        readComputedCssPixels(style, 'borderRightWidth')
      )
    );
    // Keep the CSS fallback while an async stylesheet has not exposed its
    // native gutter yet. Once it has, give that exact width back to rows.
    if (!gutterWidth) {
      return;
    }
    container.style.setProperty(
      '--x-ov-open-tabs-scrollbar-gutter',
      `${gutterWidth}px`
    );
  }
  // Caps the open tabs list at the display limit's rows, scrolling the rest.
  function setOpenTabsResultsViewport(active: boolean, itemCount?: number): void {
    const container = overlayState.suggestionsContainer;
    if (!container) {
      return;
    }
    if (!active) {
      container.style.removeProperty('--x-ov-suggestions-max-height');
      container.style.removeProperty('--x-ov-open-tabs-scrollbar-gutter');
      container.removeAttribute('data-open-tabs-visible-row-limit');
      return;
    }
    const visibleRowLimit = normalizeSearchResultDisplayLimit(
      overlayState.settings.get(searchResultDisplayLimit)
    );
    const normalizedItemCount = Math.max(0, Math.floor(Number(itemCount) || 0));
    // A complete result set should keep its natural height. Only reserve a
    // scrollbar and cap the viewport when there are rows that actually need
    // to scroll; otherwise one opened tab can look clipped by an empty
    // scrollbar gutter.
    if (normalizedItemCount <= visibleRowLimit) {
      container.style.removeProperty('--x-ov-suggestions-max-height');
      container.style.removeProperty('--x-ov-open-tabs-scrollbar-gutter');
      container.removeAttribute('data-open-tabs-visible-row-limit');
      return;
    }
    container.setAttribute(
      'data-open-tabs-visible-row-limit',
      String(visibleRowLimit)
    );
    const computedStyle = window.getComputedStyle(container);
    syncOpenTabsScrollbarGutter(computedStyle);
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        syncOpenTabsScrollbarGutter();
      });
    }
    const maxHeight = SUGGESTION_NAVIGATION.getVisibleRowsViewportHeight({
      visibleRowLimit,
      itemCount: normalizedItemCount,
      rowHeight: readComputedCssPixels(computedStyle, '--x-ov-suggestion-row-height'),
      rowGap: readComputedCssPixels(computedStyle, '--x-ov-suggestion-row-gap'),
      paddingTop: readComputedCssPixels(computedStyle, 'paddingTop'),
      paddingBottom: readComputedCssPixels(computedStyle, 'paddingBottom')
    });
    if (maxHeight > 0) {
      container.style.setProperty(
        '--x-ov-suggestions-max-height',
        `${maxHeight}px`
      );
    } else {
      container.style.removeProperty('--x-ov-suggestions-max-height');
    }
  }

  function setInputDividerVisible(visible: boolean): void {
    if (overlayState.inputParts) {
      overlayState.inputParts.setChrome({ underline: visible });
    }
  }

  // Keeps an open mode menu clear of the results and inside the viewport.
  function syncSearchModeMenuResultOffset(): void {
    const controller = overlayState.inputModeController;
    const container = overlayState.suggestionsContainer;
    if (!controller || !container) {
      return;
    }
    controller.placeModeMenuBelowResults({
      element: container,
      capProperty: '--x-ov-suggestions-menu-fit-max-height',
      isShown: () => container.getAttribute('data-collapsed') !== 'true' &&
        container.getAttribute('aria-hidden') !== 'true'
    });
  }

  // Collapses the results under the input, or opens them; deferLayoutSync
  // leaves the mode menu's offset to the caller.
  function setOverlayResultsCollapsed(collapsed: boolean, options?: { deferLayoutSync?: boolean } | null): void {
    const stateOptions: { deferLayoutSync?: boolean } = options && typeof options === 'object'
      ? options
      : {};
    const container = overlayState.suggestionsContainer;
    if (!container) {
      return;
    }
    const shouldSyncLayout = stateOptions.deferLayoutSync !== true;
    const shouldCollapse = Boolean(collapsed);
    const wasCollapsed = container.getAttribute('data-collapsed') === 'true';
    if (overlayState.overlay) {
      overlayState.overlay.setAttribute('data-open-tabs-default-collapsed', shouldCollapse ? 'true' : 'false');
    }
    container.setAttribute('data-collapsed', shouldCollapse ? 'true' : 'false');
    container.setAttribute('aria-hidden', shouldCollapse ? 'true' : 'false');
    setOverlayPanelScopedStyle(
      overlayState.overlay,
      'border-radius',
      'var(--x-ov-panel-radius, 26px)'
    );
    setInputScopedStyle(
      overlayState.inputContainer,
      'border-radius',
      shouldCollapse
        ? 'var(--x-ov-content-radius, 25px)'
        : 'var(--x-ov-content-radius, 25px) var(--x-ov-content-radius, 25px) 0 0'
    );
    if (shouldCollapse) {
      SUGGESTIONS_HEIGHT_LAYOUT.applyNaturalSuggestionsHeightLayout(container);
      container.style.setProperty('max-height', '0px');
      container.style.setProperty('min-height', '0px');
      container.style.setProperty('padding-top', '0px');
      container.style.setProperty('padding-bottom', '0px');
      container.style.setProperty('opacity', '0');
      container.style.setProperty('pointer-events', 'none');
      container.style.setProperty('overflow', 'hidden');
      setInputDividerVisible(false);
      syncSearchModeMenuResultOffset();
      return;
    }
    SUGGESTIONS_HEIGHT_LAYOUT.applyNaturalSuggestionsHeightLayout(container);
    if (!wasCollapsed) {
      setInputDividerVisible(true);
      if (shouldSyncLayout) {
        syncSearchModeMenuResultOffset();
      }
      return;
    }
    container.style.removeProperty('max-height');
    container.style.removeProperty('min-height');
    container.style.removeProperty('padding-top');
    container.style.removeProperty('padding-bottom');
    container.style.removeProperty('opacity');
    container.style.removeProperty('pointer-events');
    container.style.removeProperty('overflow');
    container.removeAttribute('aria-hidden');
    setInputDividerVisible(true);
    if (shouldSyncLayout) {
      syncSearchModeMenuResultOffset();
    }
  }

  function shouldShowOpenTabsForEmptyQuery(): boolean {
    if (searchMode.site || searchMode.local) {
      return false;
    }
    return searchMode.openTabs ||
      (overlayState.settings.isLoaded() && overlayState.settings.get(overlayOpenTabsDefaultVisible));
  }

  function clearDefaultOpenTabsSuggestions(): void {
    ensureOverlaySuggestionsView().clear();
    setOpenTabsResultsViewport(false);
    if (overlayState.suggestionsContainer) {
      overlayState.suggestionsContainer.removeAttribute('data-scope-result-enter');
    }
    suggestionItems.length = 0;
    searchResults.show([]);
    overlayState.lastRenderedQuery = '';
    overlayState.lastRenderedActionContextKey = '';
    searchResults.select(-1);
    setOverlayResultsCollapsed(true);
  }

  function updateInputRightPadding(): void {
    if (overlayState.inputModeController) {
      overlayState.inputModeController.updateLayout();
    }
  }

  function setSiteSearchTabHint(provider: InputModeProvider): void {
    if (overlayState.inputModeController) {
      overlayState.inputModeController.setTabHintVisible(true, provider);
    }
  }

  function clearSiteSearchTabHint(): void {
    if (overlayState.inputModeController) {
      overlayState.inputModeController.setTabHintVisible(false);
    }
  }

  return {
    syncOpenTabsScrollbarGutter,
    setOpenTabsResultsViewport,
    syncSearchModeMenuResultOffset,
    setOverlayResultsCollapsed,
    shouldShowOpenTabsForEmptyQuery,
    clearDefaultOpenTabsSuggestions,
    updateInputRightPadding,
    setSiteSearchTabHint,
    clearSiteSearchTabHint
  };
}

export { createResultsLayout };
export type { ResultsLayoutDeps, ResultsLayoutState };
