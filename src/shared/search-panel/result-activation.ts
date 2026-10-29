// Where a result opens, and opening it. Ctrl/Cmd or a middle click opens it
// in the background (unless Ctrl/Cmd+number opens rows at once), Option/Alt
// flips the surface's default between the current and a new tab, and Shift
// opens a switch-to-tab row in a new tab instead. Both search panels open
// results here; a surface says which tab is its default and how it opens an
// address in the current tab.
import * as NAVIGATION_DISPOSITION from '../../domain/navigation-disposition';
import type { Disposition } from '../../domain/navigation-disposition';
import * as SUGGESTION_ACTION_MODEL from '../../domain/search/suggestion-action-model';
import type { DisplayedSuggestion } from '../../domain/search/suggestion-action-model';
import { numberShortcutInstantEnabled } from '../../domain/settings/search';
import * as LumnoMessaging from '../../platform/messaging';
import type { SettingsStore } from '../../platform/settings-store';

// The keys and button of the click or key press that opens a result.
interface ActivationEvent {
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  button?: number;
}

// The row a result was opened from: its visit button picks open over switch.
interface ActivatedRow {
  _xVisitButtonAction?: string;
}

interface ResultActivationSurface {
  // Where the worker counts the pick.
  readonly source: 'overlay' | 'newtab';
  // Whether results open in the current tab unless a key says otherwise.
  isCurrentTabDefault(): boolean;
  // New Tab navigates itself; the overlay asks the worker.
  openInCurrentTab(url: string): void;
}

class ResultActivation {
  private readonly settings: Pick<SettingsStore, 'get'>;
  private readonly surface: ResultActivationSurface;

  constructor(settings: Pick<SettingsStore, 'get'>, surface: ResultActivationSurface) {
    this.settings = settings;
    this.surface = surface;
  }

  readonly opensInBackground = (event: ActivationEvent | null | undefined): boolean => {
    if (this.settings.get(numberShortcutInstantEnabled)) {
      return NAVIGATION_DISPOSITION.isMiddleClick(event);
    }
    return NAVIGATION_DISPOSITION.isBackgroundOpenEvent(event);
  };

  readonly getDisposition = (event: ActivationEvent | null | undefined): Disposition => {
    return SUGGESTION_ACTION_MODEL.getSearchResultOpenDisposition({
      openInBackgroundTab: this.opensInBackground(event),
      openInCurrentTab: Boolean(event && event.altKey),
      currentTabByDefault: this.surface.isCurrentTabDefault()
    });
  };

  // For results that always open beside the current tab: Shift on a
  // matched open tab, and aggregate searches.
  readonly getNewTabDisposition = (event: ActivationEvent | null | undefined): 'backgroundTab' | 'newTab' => {
    return this.opensInBackground(event) ? 'backgroundTab' : 'newTab';
  };

  // Teaches the ranking which result was picked for the query.
  readonly recordSelection = (suggestion: DisplayedSuggestion | null | undefined, query: string): void => {
    const trimmedQuery = String(query || '').trim();
    if (!suggestion || suggestion.forceSearch || suggestion.provider || !suggestion.url || !trimmedQuery) {
      return;
    }
    try {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'recordSearchSuggestionSelection',
        query: trimmedQuery,
        url: suggestion.url,
        title: suggestion.title || '',
        type: suggestion.type || 'history',
        source: this.surface.source
      });
    } catch {
      // Selection ranking is best-effort; never block opening the target.
    }
  };

  // Opens the result's address where the keys ask; false without one.
  readonly openUrl = (
    suggestion: DisplayedSuggestion | null | undefined,
    query: string,
    event: ActivationEvent | null | undefined
  ): boolean => {
    if (!suggestion || !suggestion.url) {
      return false;
    }
    this.recordSelection(suggestion, query);
    const disposition = this.getDisposition(event);
    if (disposition === 'currentTab') {
      this.surface.openInCurrentTab(suggestion.url);
    } else {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'createTab', url: suggestion.url, disposition });
    }
    return true;
  };

  // Switches to the tab a result is open in, or opens the result in a new
  // tab when the keys held ask for one.
  readonly openMatchedTab = (
    suggestion: DisplayedSuggestion,
    event: ActivationEvent | null | undefined,
    row: ActivatedRow | null | undefined,
    query: string
  ): void => {
    if (suggestion.url && (this.opensSwitchInNewTab(suggestion, event, row) || this.opensInBackground(event))) {
      this.recordSelection(suggestion, query);
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'createTab',
        url: suggestion.url,
        disposition: this.getNewTabDisposition(event)
      });
      return;
    }
    if (typeof suggestion._xMatchedTabId === 'number') {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'switchToTab', tabId: suggestion._xMatchedTabId });
    }
  };

  private opensSwitchInNewTab(
    suggestion: DisplayedSuggestion,
    event: ActivationEvent | null | undefined,
    row: ActivatedRow | null | undefined
  ): boolean {
    if (!event || !event.shiftKey) {
      return false;
    }
    return SUGGESTION_ACTION_MODEL.shouldOpenSwitchActionInNewTab(suggestion, {
      action: row && row._xVisitButtonAction ? row._xVisitButtonAction : 'switch',
      openSwitchInNewTab: true
    });
  }
}

export { ResultActivation };
export type { ActivatedRow, ActivationEvent, ResultActivationSurface };
