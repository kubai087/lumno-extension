// Where the suggestion list sits: shown or hidden, floating under the
// search box, and offset below an open search mode menu.
import type { InputModeController } from '../../shared/search/search-input-mode';
import type { LayoutController } from '../dom/layout';
import type { LayoutMotion } from '../layout-motion';

interface SuggestionsLayoutDeps {
  // Only the mode menu's fit below the results is read from the mode controller.
  searchBox: { readonly modeController: Pick<InputModeController, 'placeModeMenuBelowResults'> | null };
  suggestionsContainer: HTMLElement;
  // The dock's layout, once the dock is made.
  bottomDockParts: {
    readonly layoutController: Pick<LayoutController, 'setSuggestionsVisible' | 'updateSuggestionsFloatingLayout'> | null;
    readonly layoutMotion: Pick<LayoutMotion, 'cancelAll'> | null;
  };
}

function createSuggestionsLayout(deps: SuggestionsLayoutDeps) {
  const { suggestionsContainer, searchBox, bottomDockParts } = deps;

  function syncSearchModeMenuResultOffset(): void {
    const container = suggestionsContainer;
    if (!searchBox.modeController || !container) {
      return;
    }
    const capChanged = searchBox.modeController.placeModeMenuBelowResults({
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
    if (visible && bottomDockParts.layoutMotion) {
      bottomDockParts.layoutMotion.cancelAll();
    }
    if (bottomDockParts.layoutController) {
      bottomDockParts.layoutController.setSuggestionsVisible(visible);
    }
    syncSearchModeMenuResultOffset();
  }

  function updateSuggestionsFloatingLayout(): void {
    if (bottomDockParts.layoutController) {
      bottomDockParts.layoutController.updateSuggestionsFloatingLayout();
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
export type { SuggestionsLayout, SuggestionsLayoutDeps };
