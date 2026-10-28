// Page-wide keys: Tab into site search, Escape through the dismiss stack,
// and the modifier keys suggestion actions follow.
import type * as SuggestionNavigation from '../shared/search/suggestion-navigation';
import type { NumberShortcutContainer, NumberShortcutItem, NumberShortcutOptions } from '../shared/search/suggestion-navigation';
import type { DismissStack } from './dismiss-stack';
import type { SuggestionModifiers } from '../shared/search-panel/suggestion-modifiers';

interface PageKeyboardState {
  // Moves into site search on Tab, when the search box allows it.
  handleTabKey: ((event: KeyboardEvent) => void) | null;
  shortcutDragState: unknown;
  bookmarkDragState: unknown;
  recentCardDragRuntime: {
    hasRecentCardDragSession(): boolean;
    finishRecentCardDrag(event: null, options: { cancel: boolean }): void;
  } | null;
  folderColorPicker: { isOpen(): boolean } | null;
  suggestionsContainer: NumberShortcutContainer | null;
  inputParts: { input: HTMLElement } | null;
}

interface PageKeyboardDeps {
  suggestionModifiers: SuggestionModifiers;
  handleSearchTabKey(event: KeyboardEvent): void;
  dismissStack: Pick<DismissStack, 'register'>;
  finishShortcutDrag(event: null, options: { cancel: boolean }): void;
  finishBookmarkDrag(event: null, options: { canceled: boolean }): void;
  isEditableElement(target: EventTarget | null): boolean;
  // Undoes or redoes a bookmark move; false when there was none.
  performBookmarkMoveHistoryAction(direction: 'undo' | 'redo'): boolean;
  SUGGESTION_NAVIGATION: Pick<typeof SuggestionNavigation, 'handleNumberShortcutKeyEvent' | 'cancelNumberShortcuts'>;
  suggestionItems: ReadonlyArray<NumberShortcutItem | null | undefined>;
  numberShortcutOptions: NumberShortcutOptions;
  pageState: PageKeyboardState;
}

function createPageKeyboard(deps: PageKeyboardDeps): void {
  const {
    suggestionModifiers,
    handleSearchTabKey,
    dismissStack,
    finishShortcutDrag,
    finishBookmarkDrag,
    isEditableElement,
    performBookmarkMoveHistoryAction,
    SUGGESTION_NAVIGATION,
    suggestionItems,
    numberShortcutOptions,
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  pageState.handleTabKey = handleSearchTabKey;

  // Escape cancels a drag before it closes any open layer.
  dismissStack.register('drag', {
    priority: 1,
    isOpen: () => Boolean(pageState.shortcutDragState || pageState.bookmarkDragState ||
      (pageState.recentCardDragRuntime && pageState.recentCardDragRuntime.hasRecentCardDragSession())),
    close: () => {
      finishShortcutDrag(null, { cancel: true });
      finishBookmarkDrag(null, { canceled: true });
      if (pageState.recentCardDragRuntime) {
        pageState.recentCardDragRuntime.finishRecentCardDrag(null, { cancel: true });
      }
    }
  });

  document.addEventListener('keydown', function(event) {
    if (pageState.folderColorPicker && pageState.folderColorPicker.isOpen()) return;
    if (!event || event.defaultPrevented || event.altKey || isEditableElement(event.target)) {
      return;
    }
    const hasCommandModifier = event.metaKey || event.ctrlKey;
    if (!hasCommandModifier) {
      return;
    }
    const key = String(event.key || '').toLowerCase();
    const wantsUndo = key === 'z' && !event.shiftKey;
    const wantsRedo = (key === 'z' && event.shiftKey) ||
      (key === 'y' && event.ctrlKey && !event.metaKey);
    const direction = wantsUndo ? 'undo' : wantsRedo ? 'redo' : '';
    if (!direction || !performBookmarkMoveHistoryAction(direction)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }, true);

  document.addEventListener('keydown', function(event) {
    if (pageState.folderColorPicker && pageState.folderColorPicker.isOpen()) return;
    suggestionModifiers.syncFromEvent(event);
    if (SUGGESTION_NAVIGATION.handleNumberShortcutKeyEvent(
      event,
      suggestionItems,
      pageState.suggestionsContainer,
      numberShortcutOptions
    )) {
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    if (!pageState.inputParts || document.activeElement !== pageState.inputParts.input) {
      return;
    }
    if (pageState.handleTabKey) {
      pageState.handleTabKey(event);
    }
  }, true);
  document.addEventListener('keyup', function(event) {
    suggestionModifiers.syncFromEvent(event);
    SUGGESTION_NAVIGATION.handleNumberShortcutKeyEvent(
      event,
      suggestionItems,
      pageState.suggestionsContainer,
      numberShortcutOptions
    );
  }, true);
  window.addEventListener('blur', function() {
    suggestionModifiers.set(false, false, false);
    SUGGESTION_NAVIGATION.cancelNumberShortcuts(pageState.suggestionsContainer);
  });
}

export { createPageKeyboard };
export type { PageKeyboardDeps, PageKeyboardState };
