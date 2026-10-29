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
import type { OverlayPanelElements } from './panel-elements';

interface ResultActivationDeps {
  removeOverlay(overlay: HTMLElement | null): void;
  settings: OverlaySettings;
  currentTabPinned: boolean;
  elements: Pick<OverlayPanelElements, 'overlay' | 'searchInput'>;
}

function createResultActivation(deps: ResultActivationDeps) {
  const { removeOverlay, settings, currentTabPinned, elements } = deps;

  // A pinned tab is kept: results meant for it open in a new tab.
  function isCurrentTabDefault(): boolean {
    return settings.get(overlayOpenInCurrentTab) && !currentTabPinned;
  }

  const resultActivation = new ResultActivation(settings.store, {
    source: 'overlay',
    isCurrentTabDefault,
    openInCurrentTab: (url) => LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'createTab', url, disposition: 'currentTab' })
  });

  // Closes the panel after a result opened, unless it opened in the
  // background; true when the panel closed.
  function finishOverlayResultActivation(event: ActivationEvent | null, canOpenInBackground: boolean): boolean {
    if (canOpenInBackground !== false && resultActivation.opensInBackground(event)) {
      if (elements.searchInput) {
        elements.searchInput.focus({ preventScroll: true });
      }
      return false;
    }
    removeOverlay(elements.overlay);
    return true;
  }

  function getOpenDisposition(event: ActivationEvent | null, fallback?: Disposition): Disposition {
    if (settings.get(numberShortcutInstantEnabled)) {
      return NAVIGATION_DISPOSITION.isMiddleClick(event) ? 'backgroundTab' : (fallback || 'newTab');
    }
    return NAVIGATION_DISPOSITION.getDisposition(event, fallback);
  }

  return {
    resultActivation,
    finishOverlayResultActivation,
    getOpenDisposition
  };
}

export { createResultActivation };
export type { ActivationEvent, ResultActivationDeps };
