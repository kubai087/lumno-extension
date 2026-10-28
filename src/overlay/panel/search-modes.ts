// Search modes: site search, local scopes and open tabs, their input
// prefixes and labels, and the top-site and trigger candidates that suggest
// switching.
import type { InputModeController } from '../../shared/search/search-input-mode';
import type { InputModeProvider, InputModeTheme } from '../../shared/search/input-mode/types';
import type { Translate } from './types';
import type { OverlaySettings } from '../overlay-settings';
import type { SearchQuery } from '../../shared/search-panel/search-query';
import type { SearchAutocomplete } from '../../shared/search-panel/autocomplete';
import type { SearchMode } from '../../shared/search-panel/search-mode';
import type { SearchModeActions } from '../../shared/search-panel/mode-actions';

interface SearchModesState {
  settings: Pick<OverlaySettings, 'get'>;
  inputModeController: Pick<InputModeController,
    'updateLayout' | 'setProviderPrefix' | 'setPrefixText' | 'clearProviderPrefix'> | null;
  searchInput: HTMLInputElement | null;
  defaultTheme: InputModeTheme;
}

interface SearchModesDeps {
  modeActions: SearchModeActions<InputModeProvider>;
  searchMode: SearchMode<InputModeProvider>;
  searchAutocomplete: SearchAutocomplete;
  searchQuery: SearchQuery;
  t: Translate;
  cancelPendingOverlaySuggestionRequests(): void;
  clearSearchSuggestions(): void;
  renderCachedTabsForOverlay(query: string): void;
  requestTabsAndRender(query?: string): void;
  isSlashCommandInput(input: string): boolean;
  // Called with no rows: the list rebuilds from the typed command.
  updateSearchSuggestions(rows: never[], query: string): void;
  requestOverlaySearchSuggestions(query: string): void;
  overlayState: SearchModesState;
}

interface OpenTabsPrefixOptions {
  animate?: boolean;
  preserveModeMenuDoubleTab?: boolean;
}

function createSearchModes(deps: SearchModesDeps) {
  const {
    modeActions,
    searchMode,
    searchAutocomplete,
    searchQuery,
    t,
    cancelPendingOverlaySuggestionRequests,
    clearSearchSuggestions,
    renderCachedTabsForOverlay,
    requestTabsAndRender,
    isSlashCommandInput,
    updateSearchSuggestions,
    requestOverlaySearchSuggestions
  } = deps;

  // The panel state object shared with search-panel.ts and the other modules.
  const overlayState = deps.overlayState;

  const OVERLAY_OPEN_TABS_PREFIX_FEEDBACK_DELAY_MS = 120;
  let pendingOpenTabsPrefixEntryTimer = 0;



  function setOpenTabsSearchPrefix(theme: InputModeTheme, options?: OpenTabsPrefixOptions): void {
    if (overlayState.inputModeController) {
      const prefixOptions = options || {};
      overlayState.inputModeController.setPrefixText(
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
      setOpenTabsSearchPrefix(overlayState.defaultTheme, {
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
    cancelPendingOverlaySuggestionRequests();
    searchMode.enterOpenTabs();
    searchAutocomplete.clear();
    if (prefixOptions.deferPrefixEntry === true) {
      scheduleOpenTabsPrefixEntry(prefixOptions);
    } else {
      setOpenTabsSearchPrefix(overlayState.defaultTheme, prefixOptions);
    }
    searchQuery.set(overlayState.searchInput ? overlayState.searchInput.value || '' : '');
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
    const rawValue = overlayState.searchInput ? overlayState.searchInput.value || '' : '';
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
export type { SearchModesDeps, SearchModesState };
