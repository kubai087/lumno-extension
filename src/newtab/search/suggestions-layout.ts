// Where the suggestion list sits: shown or hidden, floating under the
// search box, and offset below an open search mode menu.
import type { InputModeController } from '../../shared/search/search-input-mode';
import type { LayoutController } from '../layout';
import type { LayoutMotion } from '../layout-motion';

interface SuggestionsLayoutState {
  suggestionsContainer: HTMLElement | null;
  inputModeController: Pick<InputModeController, 'setModeMenuResultOffset' | 'fitModeMenuWithinViewport'> | null;
  layoutMotion: Pick<LayoutMotion, 'cancelAll'> | null;
  layoutController: Pick<LayoutController, 'setSuggestionsVisible' | 'updateSuggestionsFloatingLayout'> | null;
}

interface SuggestionsLayoutDeps {
  pageState: SuggestionsLayoutState;
}

function createSuggestionsLayout(deps: SuggestionsLayoutDeps) {
  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  function getSearchModeMenuResultOffset(): number {
    if (!pageState.suggestionsContainer ||
        pageState.suggestionsContainer.getAttribute('data-visible') !== 'true') {
      return 0;
    }
    const layoutHeight = Math.max(
      0,
      Number(pageState.suggestionsContainer.offsetHeight) || 0
    );
    if (layoutHeight > 0) {
      return layoutHeight;
    }
    const rect = pageState.suggestionsContainer.getBoundingClientRect();
    return Math.max(0, Number(rect && rect.height) || 0);
  }

  function syncSearchModeMenuResultOffset(): void {
    const container = pageState.suggestionsContainer;
    if (!pageState.inputModeController || !container) {
      return;
    }
    const fitMaxHeightProperty =
      '--x-nt-suggestions-menu-fit-max-height';
    const previousLimit = container.style.getPropertyValue(fitMaxHeightProperty);
    // The menu goes below the list at the list's own height, so the list
    // is measured without the menu's cap (#126).
    container.style.removeProperty(fitMaxHeightProperty);
    const resultHeightLimit = pageState.inputModeController.fitModeMenuWithinViewport({
      bottomInset: 24,
      resultHeight: getSearchModeMenuResultOffset()
    });
    if (resultHeightLimit !== null && Number.isFinite(resultHeightLimit)) {
      container.style.setProperty(
        fitMaxHeightProperty,
        `${resultHeightLimit}px`
      );
    } else {
      container.style.removeProperty(fitMaxHeightProperty);
    }
    // The list grows or shrinks with the limit; the frame drawn around it
    // follows now rather than at the next render, or closing the menu
    // leaves it around the old, shorter list (#121).
    if (container.style.getPropertyValue(fitMaxHeightProperty) !== previousLimit) {
      updateSuggestionsFloatingLayout();
    }
    pageState.inputModeController.setModeMenuResultOffset(
      getSearchModeMenuResultOffset()
    );
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
