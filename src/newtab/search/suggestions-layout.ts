// Where the suggestion list sits: shown or hidden, floating under the
// search box, and offset below an open search mode menu.
import type { InputModeController } from '../../shared/search/search-input-mode';
import type { LayoutController } from '../layout';
import type { LayoutMotion } from '../layout-motion';

interface SuggestionsLayoutState {
  suggestionsContainer: HTMLElement | null;
  inputModeController: Pick<InputModeController, 'placeModeMenuBelowResults'> | null;
  layoutMotion: Pick<LayoutMotion, 'cancelAll'> | null;
  layoutController: Pick<LayoutController, 'setSuggestionsVisible' | 'updateSuggestionsFloatingLayout'> | null;
}

interface SuggestionsLayoutDeps {
  pageState: SuggestionsLayoutState;
}

function createSuggestionsLayout(deps: SuggestionsLayoutDeps) {
  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  function syncSearchModeMenuResultOffset(): void {
    const container = pageState.suggestionsContainer;
    if (!pageState.inputModeController || !container) {
      return;
    }
    const capChanged = pageState.inputModeController.placeModeMenuBelowResults({
      element: container,
      capProperty: '--x-nt-suggestions-menu-fit-max-height',
      isShown: () => container.getAttribute('data-visible') === 'true'
    });
    // The list grows or shrinks with its cap; the frame drawn around it
    // follows now rather than at the next render, or closing the menu
    // leaves it around the old, shorter list.
    if (capChanged) {
      updateSuggestionsFloatingLayout();
    }
  }

  function setSuggestionsVisible(visible: boolean): void {
    // The open list is placed from the search box's drawn position, so the
    // box lands first.
    if (visible && pageState.layoutMotion) {
      pageState.layoutMotion.cancelAll();
    }
    if (pageState.layoutController) {
      pageState.layoutController.setSuggestionsVisible(visible);
    }
    syncSearchModeMenuResultOffset();
  }

  function updateSuggestionsFloatingLayout(): void {
    if (pageState.layoutController) {
      pageState.layoutController.updateSuggestionsFloatingLayout();
    }
  }

  return {
    syncSearchModeMenuResultOffset,
    setSuggestionsVisible,
    updateSuggestionsFloatingLayout
  };
}

type SuggestionsLayout = ReturnType<typeof createSuggestionsLayout>;

export { createSuggestionsLayout };
export type { SuggestionsLayout, SuggestionsLayoutDeps, SuggestionsLayoutState };
