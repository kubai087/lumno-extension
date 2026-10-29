// Opening a result: the modifier keys that pick the current, a new or a
// background tab, and switching to an open tab instead. Results open in a
// new tab, or in the current one when the overlay is set to and the tab is
// not pinned; Option/Alt flips that.
import * as NAVIGATION_DISPOSITION from '../../domain/navigation-disposition';
import type { Disposition } from '../../domain/navigation-disposition';
import type { DisplayedSuggestion } from '../../domain/search/suggestion-action-model';
import * as LumnoMessaging from '../../platform/messaging';
import type { SuggestionsViewController } from '../../shared/react/search/suggestion-list/types';
import { overlayOpenInCurrentTab } from '../../domain/settings/overlay-panel';
import { numberShortcutInstantEnabled } from '../../domain/settings/search';
import type { OverlaySettings } from '../overlay-settings';
import type { SuggestionModifiers } from '../../shared/search-panel/suggestion-modifiers';
import * as SUGGESTION_ACTION_MODEL from '../../domain/search/suggestion-action-model';

// The keys and button of the click or key press that opens a result.
interface ActivationEvent {
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  button?: number;
}

// The rendered row a result was opened from.
interface ActivatedItem {
  _xVisitButtonAction?: string;
}

interface ResultActivationState {
  settings: Pick<OverlaySettings, 'get'>;
  overlay: HTMLElement | null;
  searchInput: HTMLInputElement | null;
  currentTabPinned: boolean;
}

interface ResultActivationDeps {
  suggestionModifiers: SuggestionModifiers;
  ensureOverlaySuggestionsView(): Pick<SuggestionsViewController,
    'setOpenInCurrentTabModifierActive' | 'setOpenSwitchInNewTabModifierActive' | 'setOpenInBackgroundTabModifierActive'>;
  removeOverlay(overlay: HTMLElement | null): void;
  recordSearchSuggestionSelectionFromSuggestion(suggestion: DisplayedSuggestion, query: string, surface: string): void;
  overlayState: ResultActivationState;
}

function createResultActivation(deps: ResultActivationDeps) {
  const {
    suggestionModifiers,
    ensureOverlaySuggestionsView,
    removeOverlay,
    recordSearchSuggestionSelectionFromSuggestion
  } = deps;

  // The panel state object shared with search-panel.ts and the other modules.
  const overlayState = deps.overlayState;

  // The rows show what the held modifier keys make of their action.
  suggestionModifiers.store.subscribe(() => {
    const view = ensureOverlaySuggestionsView();
    const modifiers = suggestionModifiers.store.getSnapshot();
    view.setOpenInCurrentTabModifierActive(modifiers.openInCurrentTab);
    view.setOpenSwitchInNewTabModifierActive(modifiers.openSwitchInNewTab);
    view.setOpenInBackgroundTabModifierActive(modifiers.openInBackgroundTab);
  });



  function shouldUseNewTabForSwitchAction(
    suggestion: DisplayedSuggestion,
    event: ActivationEvent | null,
    item: ActivatedItem | null
  ): boolean {
    if (!event || !event.shiftKey) {
      return false;
    }
    const action = item && item._xVisitButtonAction ? item._xVisitButtonAction : 'switch';
    return SUGGESTION_ACTION_MODEL.shouldOpenSwitchActionInNewTab(suggestion, {
      action,
      openSwitchInNewTab: true
    });
  }

  // A pinned tab is kept: results meant for it open in a new tab.
  function isCurrentTabDefault(): boolean {
    return overlayState.settings.get(overlayOpenInCurrentTab) && !overlayState.currentTabPinned;
  }

  // Where a result opens for the keys and button of `event`.
  function getSearchResultDisposition(event: ActivationEvent | null): Disposition {
    return SUGGESTION_ACTION_MODEL.getSearchResultOpenDisposition({
      openInBackgroundTab: Boolean(event && (
        ((event.metaKey || event.ctrlKey) && !overlayState.settings.get(numberShortcutInstantEnabled)) ||
        NAVIGATION_DISPOSITION.isMiddleClick(event)
      )),
      openInCurrentTab: Boolean(event && event.altKey),
      currentTabByDefault: isCurrentTabDefault()
    });
  }

  function shouldOpenSearchResultInBackgroundTab(event: ActivationEvent | null): boolean {
    return getSearchResultDisposition(event) === 'backgroundTab';
  }

  // Closes the panel after a result opened, unless it opened in the
  // background; true when the panel closed.
  function finishOverlayResultActivation(event: ActivationEvent | null, canOpenInBackground: boolean): boolean {
    if (canOpenInBackground !== false &&
        shouldOpenSearchResultInBackgroundTab(event)) {
      if (overlayState.searchInput) {
        overlayState.searchInput.focus({ preventScroll: true });
      }
      return false;
    }
    removeOverlay(overlayState.overlay);
    return true;
  }

  function getOpenDisposition(event: ActivationEvent | null, fallback?: Disposition): Disposition {
    if (overlayState.settings.get(numberShortcutInstantEnabled)) {
      return (NAVIGATION_DISPOSITION.isMiddleClick(event) || Boolean(event && (event.metaKey || event.ctrlKey) && !overlayState.settings.get(numberShortcutInstantEnabled)))
        ? 'backgroundTab'
        : (fallback || 'newTab');
    }
    return NAVIGATION_DISPOSITION.getDisposition(event, fallback);
  }

  // For results that always open beside the current tab: Shift on a
  // matched open tab, and aggregate searches.
  function getSearchResultNewTabDisposition(event: ActivationEvent | null): 'backgroundTab' | 'newTab' {
    return shouldOpenSearchResultInBackgroundTab(event) ? 'backgroundTab' : 'newTab';
  }

  // Switches to the tab a result is open in, or opens the result in a new
  // tab when the keys held ask for one.
  function openMatchedTabSuggestion(
    suggestion: DisplayedSuggestion,
    event: ActivationEvent | null,
    item: ActivatedItem | null,
    query: string
  ): void {
    if (suggestion && suggestion.url &&
        (shouldUseNewTabForSwitchAction(suggestion, event, item) ||
          shouldOpenSearchResultInBackgroundTab(event))) {
      recordSearchSuggestionSelectionFromSuggestion(suggestion, query, 'overlay');
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'createTab',
        url: suggestion.url,
        disposition: getSearchResultNewTabDisposition(event)
      });
      return;
    }
    if (typeof suggestion._xMatchedTabId !== 'number') {
      return;
    }
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
      action: 'switchToTab',
      tabId: suggestion._xMatchedTabId
    });
  }

  return {
    shouldOpenSearchResultInBackgroundTab,
    finishOverlayResultActivation,
    getOpenDisposition,
    getSearchResultNewTabDisposition,
    getSearchResultDisposition,
    isCurrentTabDefault,
    openMatchedTabSuggestion
  };
}

export { createResultActivation };
export type { ActivationEvent, ResultActivationDeps, ResultActivationState };
