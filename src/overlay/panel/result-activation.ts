// The overlay's side of opening a result: results open in a new tab, or in
// the current one when the overlay is set to and the tab is not pinned, and
// the panel closes after a result opened unless it opened in the background.
import * as NAVIGATION_DISPOSITION from '../../domain/navigation-disposition';
import type { Disposition } from '../../domain/navigation-disposition';
import * as LumnoMessaging from '../../platform/messaging';
import { overlayOpenInCurrentTab } from '../../domain/settings/overlay-panel';
import { numberShortcutInstantEnabled } from '../../domain/settings/search';
import type { OverlaySettings } from '../overlay-settings';
import { ResultActivation } from '../../shared/search-panel/result-activation';
import type { ActivationEvent } from '../../shared/search-panel/result-activation';

interface ResultActivationState {
  settings: OverlaySettings;
  overlay: HTMLElement | null;
  searchInput: HTMLInputElement | null;
  currentTabPinned: boolean;
}

interface ResultActivationDeps {
  removeOverlay(overlay: HTMLElement | null): void;
  overlayState: ResultActivationState;
}

function createResultActivation(deps: ResultActivationDeps) {
  const { removeOverlay } = deps;

  // The panel state object shared with search-panel.ts and the other modules.
  const overlayState = deps.overlayState;

  // A pinned tab is kept: results meant for it open in a new tab.
  function isCurrentTabDefault(): boolean {
    return overlayState.settings.get(overlayOpenInCurrentTab) && !overlayState.currentTabPinned;
  }

  const resultActivation = new ResultActivation(overlayState.settings.store, {
    source: 'overlay',
    isCurrentTabDefault,
    openInCurrentTab: (url) => LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'createTab', url, disposition: 'currentTab' })
  });

  // Closes the panel after a result opened, unless it opened in the
  // background; true when the panel closed.
  function finishOverlayResultActivation(event: ActivationEvent | null, canOpenInBackground: boolean): boolean {
    if (canOpenInBackground !== false && resultActivation.opensInBackground(event)) {
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
      return NAVIGATION_DISPOSITION.isMiddleClick(event) ? 'backgroundTab' : (fallback || 'newTab');
    }
    return NAVIGATION_DISPOSITION.getDisposition(event, fallback);
  }

  return {
    resultActivation,
    finishOverlayResultActivation,
    getOpenDisposition,
    isCurrentTabDefault
  };
}

export { createResultActivation };
export type { ActivationEvent, ResultActivationDeps, ResultActivationState };
