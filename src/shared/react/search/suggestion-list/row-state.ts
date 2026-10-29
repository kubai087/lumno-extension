// Where a row stands as the list changes: whether it is the selected row
// (or nothing is selected), whether it is under the pointer, the modifier
// keys held, and whether the surface is drawn dark. Each part is read for this row alone, so moving the selection only
// redraws the rows it leaves and reaches.
import { useSyncExternalStore } from 'react';
import { useStore } from '../../use-store';
import type { ModifierState, SuggestionsRuntime } from './types';

// The row is selected, nothing is, or another row is.
type RowSelectionState = 'selected' | 'none' | 'other';

interface RowView {
  selection: RowSelectionState;
  hovering: boolean;
  dark: boolean;
  modifiers: ModifierState;
}

function useRowView(runtime: SuggestionsRuntime, index: number): RowView {
  const { selection, modifiers } = runtime.options;
  const selectionState = useSyncExternalStore(selection.store.subscribe, (): RowSelectionState => {
    const selectedIndex = selection.store.getSnapshot().selectedIndex;
    if (selectedIndex === index) {
      return 'selected';
    }
    return selectedIndex === -1 ? 'none' : 'other';
  });
  const hovering = useSyncExternalStore(runtime.listState.subscribe, () => runtime.listState.getSnapshot().hoveredIndex === index);
  const dark = useSyncExternalStore(runtime.options.colorScheme.subscribe, () => runtime.options.colorScheme.getSnapshot().dark);
  return { selection: selectionState, hovering, dark, modifiers: useStore(modifiers.store) };
}

// Marks the row under the pointer; -1 for none.
function setHoveredRow(runtime: SuggestionsRuntime, index: number): void {
  if (runtime.listState.getSnapshot().hoveredIndex !== index) {
    runtime.listState.setState({ hoveredIndex: index });
  }
}

export { setHoveredRow, useRowView };
export type { RowSelectionState, RowView };
