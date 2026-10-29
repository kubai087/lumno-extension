// The search box's mounted parts: the input with its icons and badge, the
// suggestions view and the mode controller that drives the input's prefix
// and mode menu. Each is null until the search box mounts it.
import type { SearchInputParts } from '../../shared/react/search-input';
import type { SuggestionsViewController } from '../../shared/react/search/suggestion-list/types';
import type { InputModeController } from '../../shared/search/search-input-mode';

class SearchBoxParts {
  private input: SearchInputParts | null = null;
  private view: SuggestionsViewController | null = null;
  private mode: InputModeController | null = null;

  get inputParts(): SearchInputParts | null {
    return this.input;
  }

  get suggestionsView(): SuggestionsViewController | null {
    return this.view;
  }

  get modeController(): InputModeController | null {
    return this.mode;
  }

  // Focuses the input without scrolling the page; false when it did not take focus.
  focusInput(): boolean {
    const input = this.input ? this.input.input : null;
    if (!input) {
      return false;
    }
    try {
      input.focus({ preventScroll: true });
    } catch {
      input.focus();
    }
    return document.activeElement === input;
  }

  mountInput(parts: SearchInputParts): void {
    this.input = parts;
  }

  mountSuggestionsView(view: SuggestionsViewController): void {
    this.view = view;
  }

  mountModeController(controller: InputModeController): void {
    this.mode = controller;
  }
}

export { SearchBoxParts };
