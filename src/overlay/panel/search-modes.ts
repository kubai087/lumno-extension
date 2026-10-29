// Search modes: site search, local scopes and open tabs, their input
// prefixes and labels, and the top-site and trigger candidates that suggest
// switching.
import type { SuggestionSource } from '../../shared/search-panel/suggestion-source';
import type { InputModeProvider, InputModeTheme } from '../../shared/search/input-mode/types';
import type { Translate } from './types';
import type { SearchQuery } from '../../shared/search-panel/search-query';
import type { SearchAutocomplete } from '../../shared/search-panel/autocomplete';
import type { SearchMode } from '../../shared/search-panel/search-mode';
import type { SearchModeActions } from '../../shared/search-panel/mode-actions';
import type { OverlayPanelElements } from './panel-elements';

interface SearchModesDeps {
  modeActions: SearchModeActions<InputModeProvider>;
  searchMode: SearchMode<InputModeProvider>;
  searchAutocomplete: SearchAutocomplete;
  searchQuery: SearchQuery;
  t: Translate;
  // Stops the answers on their way.
  suggestionSource: Pick<SuggestionSource, 'cancel'>;
  clearSearchSuggestions(): void;
  renderCachedTabsForOverlay(query: string): void;
  requestTabsAndRender(query?: string): void;
  isSlashCommandInput(input: string): boolean;
  // Called with no rows: the list rebuilds from the typed command.
  updateSearchSuggestions(rows: never[], query: string): void;
  requestOverlaySearchSuggestions(query: string): void;
  defaultTheme: InputModeTheme;
  elements: Pick<OverlayPanelElements, 'inputModeController' | 'searchInput'>;
}

interface OpenTabsPrefixOptions {
  animate?: boolean;
  preserveModeMenuDoubleTab?: boolean;
}

function createSearchModes(deps: SearchModesDeps) {
  const {
    elements,
    defaultTheme,
    modeActions,
    searchMode,
    searchAutocomplete,
    searchQuery,
    t,
    suggestionSource,
    clearSearchSuggestions,
    renderCachedTabsForOverlay,
    requestTabsAndRender,
    isSlashCommandInput,
    updateSearchSuggestions,
    requestOverlaySearchSuggestions
  } = deps;

  const OVERLAY_OPEN_TABS_PREFIX_FEEDBACK_DELAY_MS = 120;
  let pendingOpenTabsPrefixEntryTimer = 0;

  function setOpenTabsSearchPrefix(theme: InputModeTheme, options?: OpenTabsPrefixOptions): void {
    if (elements.inputModeController) {
      const prefixOptions = options || {};
      elements.inputModeController.setPrefixText(
        t('search_open_tabs_only_entry', '搜索已打开标签页'),
        theme,
        {
          animate: prefixOptions.animate !== false,
          iconName: 'ri-window-line',
          menuIconName: 'browser',
          modeId: 'openTabs',
          preserveModeMenuDoubleTab: Boolean(
            prefixOptions.preserveModeMenuDoubleTab
          )
        }
      );
    }
  }

  function cancelPendingOpenTabsPrefixEntry(): boolean {
    if (!pendingOpenTabsPrefixEntryTimer) {
      return false;
    }
    window.clearTimeout(pendingOpenTabsPrefixEntryTimer);
    pendingOpenTabsPrefixEntryTimer = 0;
    return true;
  }

  // Shows the open tabs prefix a moment later, so a quick second key can
  // still change the mode first.
  function scheduleOpenTabsPrefixEntry(options?: OpenTabsPrefixOptions): void {
    cancelPendingOpenTabsPrefixEntry();
    const prefixOptions = options || {};
    pendingOpenTabsPrefixEntryTimer = window.setTimeout(() => {
      pendingOpenTabsPrefixEntryTimer = 0;
      if (!searchMode.openTabs || searchMode.site || searchMode.local) {
        return;
      }
      setOpenTabsSearchPrefix(defaultTheme, {
        animate: true,
        preserveModeMenuDoubleTab: Boolean(
          prefixOptions.preserveModeMenuDoubleTab
        )
      });
    }, OVERLAY_OPEN_TABS_PREFIX_FEEDBACK_DELAY_MS);
  }

  function activateOpenTabsSearchMode(
    options?: OpenTabsPrefixOptions & { deferPrefixEntry?: boolean; deferResults?: boolean }
  ): void {
    const prefixOptions = options || {};
    cancelPendingOpenTabsPrefixEntry();
    suggestionSource.cancel();
    searchMode.enterOpenTabs();
    searchAutocomplete.clear();
    if (prefixOptions.deferPrefixEntry === true) {
      scheduleOpenTabsPrefixEntry(prefixOptions);
    } else {
      setOpenTabsSearchPrefix(defaultTheme, prefixOptions);
    }
    searchQuery.set(elements.searchInput ? elements.searchInput.value || '' : '');
    if (prefixOptions.deferResults !== true) {
      renderCachedTabsForOverlay(searchQuery.text);
      requestTabsAndRender(searchQuery.text);
    }
  }

  function clearOpenTabsSearchMode(): void {
    if (!searchMode.openTabs) {
      return;
    }
    cancelPendingOpenTabsPrefixEntry();
    searchMode.leaveOpenTabs();
    modeActions.clearSiteSearchPrefix();
    searchAutocomplete.clear();
    const rawValue = elements.searchInput ? elements.searchInput.value || '' : '';
    const query = rawValue.trim();
    searchQuery.set(rawValue, query);
    if (!query) {
      clearSearchSuggestions();
      return;
    }
    if (isSlashCommandInput(query)) {
      updateSearchSuggestions([], query);
      return;
    }
    requestOverlaySearchSuggestions(query);
  }

  return {
    cancelPendingOpenTabsPrefixEntry,
    activateOpenTabsSearchMode,
    clearOpenTabsSearchMode
  };
}

export { createSearchModes };
export type { SearchModesDeps };
