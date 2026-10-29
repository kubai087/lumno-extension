// Page-wide keys: Tab into site search, Escape through the dismiss stack,
// and the modifier keys suggestion actions follow.
import type { NumberShortcutContainer, NumberShortcutItem, NumberShortcutOptions } from '../shared/search/suggestion-navigation';
import type { DismissStack } from './dismiss-stack';
import type { SuggestionModifiers } from '../shared/search-panel/suggestion-modifiers';
import * as SUGGESTION_NAVIGATION from '../shared/search/suggestion-navigation';
import type { SearchBoxParts } from './search/search-box-parts';
import type { DragSessions } from './drag-sessions';
import type { RecentCardDrag } from './recent/recent-card-drag';

interface PageKeyboardState {
  folderColorPicker: { isOpen(): boolean } | null;
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
  suggestionItems: ReadonlyArray<NumberShortcutItem | null | undefined>;
  numberShortcutOptions: NumberShortcutOptions;
  searchBox: Pick<SearchBoxParts, 'inputParts'>;
  suggestionsContainer: NumberShortcutContainer | null;
  dragSessions: Pick<DragSessions, 'bookmark' | 'recentCard' | 'shortcut'>;
  pageState: PageKeyboardState;
  finishRecentCardDrag: RecentCardDrag['finishRecentCardDrag'];
}

function createPageKeyboard(deps: PageKeyboardDeps): void {
  const {
    dragSessions,
    suggestionsContainer,
    searchBox,
    suggestionModifiers,
    handleSearchTabKey,
    dismissStack,
    finishShortcutDrag,
    finishBookmarkDrag,
    isEditableElement,
    performBookmarkMoveHistoryAction,
    suggestionItems,
    numberShortcutOptions,
    finishRecentCardDrag
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  // Escape cancels a drag before it closes any open layer.
  dismissStack.register('drag', {
    priority: 1,
    isOpen: () => Boolean(dragSessions.shortcut || dragSessions.bookmark || dragSessions.recentCard),
    close: () => {
      finishShortcutDrag(null, { cancel: true });
      finishBookmarkDrag(null, { canceled: true });
      finishRecentCardDrag(null, { cancel: true });
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
      suggestionsContainer,
      numberShortcutOptions
    )) {
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    if (!searchBox.inputParts || document.activeElement !== searchBox.inputParts.input) {
      return;
    }
    handleSearchTabKey(event);
  }, true);
  document.addEventListener('keyup', function(event) {
    suggestionModifiers.syncFromEvent(event);
    SUGGESTION_NAVIGATION.handleNumberShortcutKeyEvent(
      event,
      suggestionItems,
      suggestionsContainer,
      numberShortcutOptions
    );
  }, true);
  window.addEventListener('blur', function() {
    suggestionModifiers.set(false, false, false);
    SUGGESTION_NAVIGATION.cancelNumberShortcuts(suggestionsContainer);
  });
}

export { createPageKeyboard };
export type { PageKeyboardDeps, PageKeyboardState };
