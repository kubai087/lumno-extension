// Tab in the search input: moves focus into and out of the mode menu, takes
// the row the arrows show as typed text or its address to edit, opens the
// menu for the active mode or on a double Tab, turns a typed trigger into
// its site search or local scope, or takes the inline completion.
import type { SuggestionInputPreview } from '../../domain/search/suggestion-input-preview';
import type { SiteSearchProvider, SuggestionLike } from '../../domain/search/types';
import type { InputModeController } from '../search/search-input-mode';
import type { SearchAutocomplete } from './autocomplete';
import type { SearchMatching } from './matching';
import type { SearchModeActions } from './mode-actions';
import type { SearchModeMenu } from './mode-menu';
import type { SearchMode } from './search-mode';
import type { SearchQuery } from './search-query';
import type { SearchResults } from './search-results';
import type { SiteSearchCatalog } from './site-search/catalog';
import { getLoadedShortcutRules, loadShortcutRules } from './shortcut-rules';

type TabModeController = Pick<InputModeController,
  'handleModeMenuTabFocusToggle' | 'shouldCompleteModeMenuDoubleTab' | 'shouldOpenModeMenuForActiveModeOnTab' |
  'openModeMenu' | 'shouldOpenModeMenuOnDoubleTab'>;

// What differs per surface.
interface SearchTabKeySurface {
  getInput(): HTMLInputElement | null;
  getModeController(): TabModeController | null;
  // The row the arrows selected whose text Tab may take; null for none.
  getSelectedRow(): SuggestionLike | null;
  // A first Tab in the empty input that the mode controller took (the
  // overlay arms its open tabs mode for the second).
  onEmptyTab?(): void;
}

interface SearchTabKeyOptions {
  query: SearchQuery;
  mode: SearchMode<SiteSearchProvider>;
  results: Pick<SearchResults<SuggestionLike>, 'rows'>;
  autocomplete: Pick<SearchAutocomplete, 'state' | 'accept'>;
  matching: Pick<SearchMatching, 'getTopSiteMatchCandidate' | 'getSiteSearchTriggerCandidate' | 'getLocalSearchScopeCandidate'>;
  catalog: Pick<SiteSearchCatalog, 'triggerProviders' | 'loadedProviders' | 'loadProviders' | 'loadAggregates'>;
  actions: Pick<SearchModeActions<SiteSearchProvider>, 'activateSiteSearch' | 'activateLocalSearchScope'>;
  modeMenu: Pick<SearchModeMenu, 'openFromDoubleTab'>;
  preview: Pick<SuggestionInputPreview, 'commit' | 'editAddress'>;
  surface: SearchTabKeySurface;
}

class SearchTabKey {
  private readonly options: SearchTabKeyOptions;

  constructor(options: SearchTabKeyOptions) {
    this.options = options;
  }

  // True when Tab was used.
  readonly handle = (event: KeyboardEvent | null): boolean => {
    const { query, mode, autocomplete, actions, modeMenu, preview, surface } = this.options;
    const input = surface.getInput();
    if (!event || event.defaultPrevented || !input) {
      return false;
    }
    const controller = surface.getModeController();
    if (controller && controller.handleModeMenuTabFocusToggle(event)) {
      return true;
    }
    // Tab takes the suggestion the arrows show as typed text.
    if (!event.shiftKey && preview.commit()) {
      return this.takeInputText(event, input);
    }
    if (controller && controller.shouldCompleteModeMenuDoubleTab(event)) {
      void modeMenu.openFromDoubleTab();
      return true;
    }
    if (event.defaultPrevented) {
      return true;
    }
    if (controller && controller.shouldOpenModeMenuForActiveModeOnTab(event)) {
      void controller.openModeMenu('none');
      return true;
    }
    if (mode.site || mode.local || mode.openTabs) {
      return false;
    }
    // On a page the arrows selected, Tab puts its address in the input to edit.
    if (!event.shiftKey && preview.editAddress(input, surface.getSelectedRow())) {
      return this.takeInputText(event, input);
    }
    const triggerInput = (query.raw || input.value).trim();
    if (!triggerInput) {
      if (!controller) {
        return false;
      }
      if (controller.shouldOpenModeMenuOnDoubleTab(event)) {
        void modeMenu.openFromDoubleTab();
        return true;
      }
      if (event.defaultPrevented && surface.onEmptyTab) {
        surface.onEmptyTab();
      }
      return event.defaultPrevented;
    }
    const siteTrigger = mode.siteTrigger;
    if (siteTrigger && siteTrigger.rawInput === triggerInput && siteTrigger.provider) {
      event.preventDefault();
      actions.activateSiteSearch(siteTrigger.provider);
      return true;
    }
    const scopeTrigger = mode.localTrigger;
    if (scopeTrigger && scopeTrigger.rawInput === triggerInput && scopeTrigger.scope) {
      event.preventDefault();
      return actions.activateLocalSearchScope(scopeTrigger.scope);
    }
    event.preventDefault();
    if (!this.activateTrigger(triggerInput, getLoadedShortcutRules(), false)) {
      const { catalog } = this.options;
      void Promise.all([catalog.loadProviders(), catalog.loadAggregates(), loadShortcutRules()]).then(([, , rules]) => {
        // The input or the mode may have changed while the lists loaded.
        const liveInput = surface.getInput();
        if (!liveInput || mode.site || mode.local || mode.openTabs ||
            String(liveInput.value || '').trim() !== triggerInput) {
          return;
        }
        if (!this.activateTrigger(triggerInput, rules, true) && autocomplete.state && autocomplete.state.completion) {
          autocomplete.accept();
        }
      });
    }
    return true;
  };

  // Starts the site search or local scope the typed text names; a scope
  // only once the site searches are known, unless `loaded`.
  private activateTrigger(triggerInput: string, rules: ReturnType<typeof getLoadedShortcutRules>, loaded: boolean): boolean {
    const { results, matching, catalog, actions } = this.options;
    const topSiteMatch = matching.getTopSiteMatchCandidate(results.rows, triggerInput);
    const provider = matching.getSiteSearchTriggerCandidate(triggerInput, catalog.triggerProviders, topSiteMatch);
    if (provider) {
      actions.activateSiteSearch(provider);
      return true;
    }
    const scope = matching.getLocalSearchScopeCandidate(triggerInput, rules);
    if (scope && (loaded || catalog.loadedProviders)) {
      actions.activateLocalSearchScope(scope);
      return true;
    }
    return false;
  }

  private takeInputText(event: KeyboardEvent, input: HTMLInputElement): boolean {
    event.preventDefault();
    this.options.query.set(input.value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
}

export { SearchTabKey };
export type { SearchTabKeySurface };
