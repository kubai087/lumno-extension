// What the search scope panel draws: its tiles in their groups, the
// filter's highlights and the footer's labels, and what the panel reports
// back. The input mode controller builds the model; the React panel
// (react/search/mode-menu.tsx) draws it.
import type { RemixIconName } from '../../ui/remix-icon';
import type { ModeMenuRange } from './types';

interface ModeMenuTileIcon {
  // A built-in line icon's name; empty for a glyph or a site icon.
  lineIcon: string;
  // The Remix icon class shown until the site icon loads, or if it fails.
  glyphName: RemixIconName;
  iconUrl: string;
  // The host whose saved icon may replace iconUrl.
  iconHost: string;
}

// A tile's colors, worked out from its mode's theme.
interface ModeMenuTileColors {
  icon: string;
  selectedBackground: string;
  focusRing: string;
}

interface ModeMenuTile {
  id: string;
  label: string;
  // The group title it sits under; a new title starts where it changes.
  group: string;
  // The group's key when groups can move.
  groupKey: string;
  checked: boolean;
  // The order list it drags within; empty when it does not drag.
  sortList: string;
  // Left out by the filter.
  hidden: boolean;
  // The parts of the label the filter matched.
  ranges: readonly ModeMenuRange[];
  icon: ModeMenuTileIcon;
  colors: ModeMenuTileColors;
}

// A line of text with one highlighted run: the filter's query in its sentence.
interface ModeMenuMarkedText {
  before: string;
  mark: string;
  after: string;
}

interface ModeMenuLabels {
  filter: ModeMenuMarkedText;
  navigationKey: string;
  navigation: string;
  selectKey: string;
  select: string;
  inputKey: string;
  input: string;
  shortcutKey: string;
  shortcut: string;
  empty: string;
  moveUp: string;
  moveDown: string;
}

interface ModeMenuModel {
  // Shown at all; the surface motion follows `revealed`.
  open: boolean;
  revealed: boolean;
  busy: boolean;
  // Keys go to the panel rather than the input.
  searchActive: boolean;
  // The input has text, which lifts the panel a little.
  hasQuery: boolean;
  filtered: boolean;
  // The tile that takes Tab focus; empty for none.
  focusId: string;
  canMoveGroups: boolean;
  canReorder: boolean;
  tiles: readonly ModeMenuTile[];
  labels: ModeMenuLabels;
}

interface ModeMenuHandlers {
  onSelect(id: string): void;
  onGroupMove(groupKey: string, delta: number): void;
  // A tile dragged to a new place among the tiles of its order list,
  // which are given in their new order.
  onReorder(id: string, list: string, orderedIds: string[]): void;
  onKeyDown(event: KeyboardEvent): void;
  onPointerDown(event: PointerEvent): void;
  // Shows the full label beside the pointer when the tile cuts it short.
  bindLabelTooltip(button: HTMLButtonElement, label: HTMLElement): void;
  // Swaps the image to the site icon's saved copy once there is one.
  attachIconData(image: HTMLImageElement, iconUrl: string, iconHost: string): void;
}

const EMPTY_LABELS: ModeMenuLabels = Object.freeze({
  filter: Object.freeze({ before: '', mark: '', after: '' }),
  navigationKey: '',
  navigation: '',
  selectKey: '',
  select: '',
  inputKey: '',
  input: '',
  shortcutKey: '',
  shortcut: '',
  empty: '',
  moveUp: '',
  moveDown: ''
});

const CLOSED_MODEL: ModeMenuModel = Object.freeze({
  open: false,
  revealed: false,
  busy: false,
  searchActive: false,
  hasQuery: false,
  filtered: false,
  focusId: '',
  canMoveGroups: false,
  canReorder: false,
  tiles: Object.freeze([]),
  labels: EMPTY_LABELS
});

export type {
  ModeMenuHandlers,
  ModeMenuLabels,
  ModeMenuMarkedText,
  ModeMenuModel,
  ModeMenuTile,
  ModeMenuTileColors,
  ModeMenuTileIcon
};
export { CLOSED_MODEL };
