// Draws the mode menu: the React view (react/search/mode-menu.tsx) shows
// the model built here from the menu's state, with the filter's matches,
// the tiles' icons and colors and the copy. The view reports what the user
// does through the handlers the menu gives it.
import type { ModeMenuHandlers, ModeMenuLabels, ModeMenuModel, ModeMenuTile } from '../mode-menu-model';
import type { ModeMenuStore } from '../../../react/search/mode-menu';
import type { ModeMenuEntry } from '../types';
import type { ModeMenuIcons } from './icons';
import type { ModeMenuSearchApi } from './search';
import type { ModeMenuState } from './state';

interface ModeMenuDrawingParts {
  store: ModeMenuStore;
  state: ModeMenuState;
  search: Pick<ModeMenuSearchApi, 'normalizeModeMenuSearchText' | 'getModeMenuItemMatch'>;
  icons: ModeMenuIcons;
  labels(filterQuery: string): ModeMenuLabels;
  // The surface lets groups move, and tiles reorder within their lists.
  canMoveGroups: boolean;
  canReorder: boolean;
}

class ModeMenuDrawing {
  private readonly parts: ModeMenuDrawingParts;
  private readonly handlers: ModeMenuHandlers;

  constructor(parts: ModeMenuDrawingParts, handlers: ModeMenuHandlers) {
    this.parts = parts;
    this.handlers = handlers;
  }

  // Draws the menu from its state; returns the model drawn. The view has
  // committed when this returns, so the menu can measure and focus it.
  draw(): ModeMenuModel {
    const model = this.buildModel();
    this.parts.store.setState({ model, handlers: this.handlers });
    return model;
  }

  // Whether the typed filter narrows the tiles.
  isFiltered(): boolean {
    return Boolean(this.parts.search.normalizeModeMenuSearchText(this.parts.state.filterQuery));
  }

  private buildModel(): ModeMenuModel {
    const { state, search, canMoveGroups, canReorder } = this.parts;
    const normalizedQuery = search.normalizeModeMenuSearchText(state.filterQuery);
    return {
      open: state.open,
      revealed: state.revealed,
      busy: state.busy,
      searchActive: state.searchActive,
      hasQuery: state.hasQuery,
      filtered: Boolean(normalizedQuery),
      focusId: state.focusId,
      canMoveGroups,
      canReorder,
      labels: this.parts.labels(state.filterQuery),
      tiles: state.entries.map((entry) => this.buildTile(entry, normalizedQuery))
    };
  }

  private buildTile(entry: ModeMenuEntry, normalizedQuery: string): ModeMenuTile {
    const { search, icons, canReorder } = this.parts;
    const item = entry.item;
    const match = search.getModeMenuItemMatch(entry, normalizedQuery);
    return {
      id: String(item.id),
      label: entry.labelText,
      group: entry.group,
      groupKey: item.groupKey ? String(item.groupKey) : '',
      checked: entry.checked,
      // Items of one order list drag among themselves inside their group.
      sortList: canReorder && item.orderList && item.orderList !== 'pinned' ? String(item.orderList) : '',
      hidden: !match.matched,
      ranges: match.ranges,
      icon: icons.tileIcon(item),
      colors: icons.tileColors(item)
    };
  }
}

export type { ModeMenuDrawingParts };
export { ModeMenuDrawing };
