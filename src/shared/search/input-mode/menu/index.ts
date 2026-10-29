// The mode menu (the search scope panel): opening it with the surface's
// items, refreshing and closing it, selecting a mode, filtering by typing,
// and its keys and pointer. It owns its state; what the rest of the input
// does when it opens or closes follows from the events it emits.
import type { EventBus } from '../../../state/events';
import type { CursorTooltipController } from '../../../ui/cursor-tooltip-model';
import type { NavigatorLike } from '../../../../domain/shortcut-display';
import type { PinyinApi } from '../../../../domain/search/pinyin-api';
import type { ModeMenuStore } from '../../../react/search/mode-menu';
import type { ModeMenuIconOptions } from './icons';
import { ModeMenuIcons } from './icons';
import { ModeMenuDrawing } from './drawing';
import { ModeMenuFocus } from './focus';
import { getModeMenuLabels } from './labels';
import { createPinyinRuntime, MODE_MENU_PINYIN_FALLBACKS, requestPinyinRuntime } from './pinyin-runtime';
import type { PinyinRuntime } from './pinyin-runtime';
import { createModeMenuSearch } from './search';
import type { ModeMenuSearchApi } from './search';
import { ModeMenuSurface } from './surface';
import type { ModeMenuLayoutChange, ModeMenuSurfaceWindow } from './surface';
import {
  createModeMenuEntries,
  createModeMenuState,
  findModeMenuEntry,
  getModeMenuGroupKeys,
  moveModeMenuEntries,
  selectModeMenuEntry
} from './state';
import type { ModeMenuState } from './state';
import { handleModeMenuKeydown, isPlainTabKey } from './keyboard';
import type { TabKeyEvent } from './keyboard';
import type { AttachFaviconData, FormatMessage, ModeMenuItem } from '../types';

type ModeMenuItemList = ReadonlyArray<ModeMenuItem | null | undefined> | null | undefined;

interface ModeMenuReorder {
  item: ModeMenuItem | null;
  list: string | undefined;
  // The moved list's items in their new order.
  movedItems: ModeMenuItem[];
  listItems: ModeMenuItem[];
}

// The surface's part of the menu.
interface ModeMenuConfig {
  // The menu's items, now or once loaded.
  getModeMenuItems?(): ModeMenuItemList | PromiseLike<ModeMenuItemList>;
  // May return a promise; focus moves once it settles.
  onModeMenuSelect?(item: ModeMenuItem): unknown;
  // Steps back or forth through the moves made in the panel; true when there was one.
  onModeMenuHistory?(direction: 'undo' | 'redo'): unknown;
  onModeMenuGroupMove?(details: { delta: number; group: string; groups: string[] }): void;
  onModeMenuReorder?(details: ModeMenuReorder): void;
  onModeMenuLayoutChange?(details: ModeMenuLayoutChange): void;
  navigatorLike?: NavigatorLike | null;
  // pinyin-pro for the filter when the surface already has it; null starts
  // without it. By default the menu imports build/pinyin.js on first use.
  pinyinApi?: PinyinApi | null;
}

interface ModeMenuParts {
  menu: HTMLElement;
  content: HTMLElement;
  footer: HTMLElement;
  store: ModeMenuStore;
  container: HTMLElement;
  input: HTMLInputElement;
  // The mode tag, which opens the menu and takes focus back when it closes.
  tag: HTMLElement;
}

type ModeMenuTooltip = Pick<CursorTooltipController, 'bind' | 'hide'>;

interface ModeMenuEnv {
  config: ModeMenuConfig;
  parts: ModeMenuParts;
  doc: Document;
  win: ModeMenuSurfaceWindow & Partial<Pick<Window, 'matchMedia'>> & { navigator?: NavigatorLike };
  options: ModeMenuIconOptions & {
    formatMessage: FormatMessage;
    attachFaviconData: AttachFaviconData | null;
    canMoveModeMenuGroups: boolean;
    canReorderModeMenu: boolean;
  };
  tooltip: ModeMenuTooltip | null;
}

// What happened to the menu, for the rest of the input to follow.
interface ModeMenuEvents {
  // An open was asked for; the items may still be loading.
  opening: undefined;
  openChanged: { open: boolean };
  // Tab moved focus between the input and the open menu.
  focusToggled: undefined;
}

// Where focus goes once the menu opens: the last item, the active one, the
// input, or the menu itself.
type ModeMenuFocusTarget = 'last' | 'active' | 'input' | 'none';

interface ModeMenuSelectOptions {
  // Where focus goes after selecting: the input, or the item in the panel.
  focusAfterSelect?: 'input' | 'panel';
}

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return Boolean(value) && typeof value === 'object' && value !== null && 'then' in value && typeof value.then === 'function';
}

function isNode(value: EventTarget | null | undefined): value is Node {
  return value !== null && value !== undefined && 'nodeType' in value && typeof value.nodeType === 'number';
}

// nodeType 1 is an element, in whichever window the node belongs to.
function isElement(value: EventTarget | null | undefined): value is Element {
  return isNode(value) && value.nodeType === 1;
}

// nodeType 11 with a host is a shadow root.
function isShadowRoot(node: Node): node is ShadowRoot {
  return node.nodeType === 11 && 'host' in node;
}

function hasDataset(element: Element): element is Element & HTMLOrSVGElement {
  return 'dataset' in element;
}

// Whether a press landed on the input, its tag or its menu. In a closed
// shadow root the press reaches the document as the host's.
function isPressInside(parts: ModeMenuParts, event: Event): boolean {
  const eventPath = event.composedPath();
  const containerRoot = parts.container.getRootNode();
  const containerRootHost = isShadowRoot(containerRoot) ? containerRoot.host : null;
  return (isNode(event.target) && parts.container.contains(event.target)) ||
    eventPath.includes(parts.container) ||
    eventPath.includes(parts.menu) ||
    eventPath.includes(parts.tag) ||
    Boolean(containerRootHost && event.currentTarget !== containerRoot && (
      event.target === containerRootHost ||
      eventPath.includes(containerRootHost)
    ));
}

class ModeMenu {
  readonly state: ModeMenuState = createModeMenuState();
  readonly focus: ModeMenuFocus;
  readonly surface: ModeMenuSurface;
  private readonly env: ModeMenuEnv;
  private readonly events: EventBus<ModeMenuEvents>;
  private readonly pinyin: PinyinRuntime;
  private readonly search: ModeMenuSearchApi;
  private readonly icons: ModeMenuIcons;
  private readonly drawing: ModeMenuDrawing;

  constructor(env: ModeMenuEnv, events: EventBus<ModeMenuEvents>) {
    const { config, parts, options } = env;
    this.env = env;
    this.events = events;
    this.pinyin = createPinyinRuntime(config.pinyinApi);
    this.search = createModeMenuSearch({
      getModeMenuPinyinApi: () => this.pinyin.api,
      MODE_MENU_PINYIN_FALLBACKS,
      modeMenuCursorTooltipController: env.tooltip,
      modeMenu: parts.menu
    });
    this.icons = new ModeMenuIcons(options, () => this.drawing.draw());
    this.drawing = new ModeMenuDrawing({
      store: parts.store,
      state: this.state,
      search: this.search,
      icons: this.icons,
      labels: (filterQuery) => getModeMenuLabels(options.formatMessage, filterQuery, config.navigatorLike || env.win.navigator),
      canMoveGroups: options.canMoveModeMenuGroups,
      canReorder: options.canReorderModeMenu
    }, {
      onSelect: (id) => this.selectById(id),
      onGroupMove: (groupKey, delta) => this.moveGroup(groupKey, delta),
      onReorder: (id, list, orderedIds) => this.reorder(id, list, orderedIds),
      onKeyDown: (event) => this.handleKeydown(event),
      onPointerDown: (event) => this.handlePointerDown(event),
      bindLabelTooltip: (button, label) => this.search.bindModeMenuLabelTooltip(button, label),
      attachIconData: (image, iconUrl, iconHost) => {
        if (options.attachFaviconData) {
          options.attachFaviconData(image, iconUrl, iconHost);
        }
      }
    });
    this.surface = new ModeMenuSurface({ ...parts, win: env.win, doc: env.doc, onLayoutChange: config.onModeMenuLayoutChange }, this.state, this.drawing);
    this.focus = new ModeMenuFocus({ ...parts, doc: env.doc, win: env.win }, this.state, this.drawing);
  }

  redraw(): void {
    this.drawing.draw();
  }

  isOpen(): boolean {
    return this.state.open;
  }

  isOpenOrPending(): boolean {
    return this.state.open || this.state.pending;
  }

  // Loads pinyin-pro and the Han variant table for the filter, once.
  requestPinyin(): PromiseLike<unknown> | null | undefined {
    return requestPinyinRuntime(this.pinyin, () => this.refreshSearchIndexes());
  }

  open(focusTarget?: ModeMenuFocusTarget): boolean | Promise<boolean> {
    const getItems = this.env.config.getModeMenuItems;
    if (this.state.destroyed || typeof getItems !== 'function') {
      return false;
    }
    this.drawing.draw();
    this.events.emit('opening', undefined);
    const requestId = ++this.state.requestId;
    this.state.pending = true;
    const items = getItems();
    this.requestPinyin();
    const pinyinReady = this.pinyin.ready;
    if (!isPromiseLike(items) && !isPromiseLike(pinyinReady)) {
      return this.finishOpen(requestId, items, focusTarget);
    }
    this.setBusy(true);
    return Promise.all([Promise.resolve(items), Promise.resolve(pinyinReady)]).then(([resolvedItems]) => (
      requestId === this.state.requestId && this.finishOpen(requestId, resolvedItems, focusTarget)
    ), () => this.failRequest(requestId));
  }

  // Draws the items again, keeping focus on the same mode where it can.
  refresh(preferredModeId?: string): boolean | Promise<boolean> {
    const getItems = this.env.config.getModeMenuItems;
    if (this.state.destroyed || !this.state.open || typeof getItems !== 'function') {
      return false;
    }
    const focusedModeId = preferredModeId ? String(preferredModeId) : this.readFocusedModeId();
    const requestId = ++this.state.requestId;
    this.state.pending = true;
    const items = getItems();
    if (!isPromiseLike(items)) {
      return this.finishRefresh(requestId, items, focusedModeId);
    }
    this.setBusy(true);
    return Promise.resolve(items).then(
      (resolvedItems) => this.finishRefresh(requestId, resolvedItems, focusedModeId),
      () => this.failRequest(requestId)
    );
  }

  close(restoreFocus?: boolean): boolean {
    const state = this.state;
    if (!state.open && !state.pending) {
      return false;
    }
    state.requestId += 1;
    state.pending = false;
    this.surface.cancelReveal();
    this.hideTooltip();
    state.open = false;
    state.busy = false;
    state.filterQuery = '';
    state.focusId = '';
    state.searchActive = false;
    this.surface.conceal();
    this.events.emit('openChanged', { open: false });
    this.surface.notifyLayoutChange();
    if (restoreFocus) {
      this.env.parts.tag.focus({ preventScroll: true });
    }
    return true;
  }

  select(item: ModeMenuItem, selectionOptions?: ModeMenuSelectOptions | null): void {
    const focusAfterSelect = selectionOptions && selectionOptions.focusAfterSelect === 'panel' ? 'panel' : 'input';
    const onSelect = this.env.config.onModeMenuSelect;
    const result = typeof onSelect === 'function' ? onSelect(item) : null;
    const settle = (): void => this.settleSelection(item, focusAfterSelect);
    if (result && typeof result === 'object' && 'then' in result && typeof result.then === 'function') {
      Promise.resolve(result).then(settle, settle);
      return;
    }
    settle();
  }

  // Shows only the items that match; returns how many do.
  applyFilter(query: unknown, filterOptions?: { preserveScroll?: boolean } | null): number {
    this.state.filterQuery = String(query || '');
    const model = this.drawing.draw();
    if (!filterOptions || filterOptions.preserveScroll !== true) {
      this.env.parts.content.scrollTop = 0;
    }
    this.surface.alignFooter();
    this.surface.notifyLayoutChange();
    return model.tiles.filter((tile) => !tile.hidden).length;
  }

  // The panel lifts a little while the input has text.
  syncQueryLift(): void {
    const hasQuery = Boolean(String(this.env.parts.input.value || '').trim());
    if (hasQuery !== this.state.hasQuery) {
      this.state.hasQuery = hasQuery;
      this.drawing.draw();
    }
  }

  // Keys while the menu has focus: arrows, Home, End, Enter, Escape, Tab,
  // and letters, digits and spaces typed into the filter.
  handleKeydown(event: KeyboardEvent): boolean {
    if (event.key === 'Tab') {
      return this.toggleFocus(event);
    }
    return handleModeMenuKeydown(this, event);
  }

  handleKeyEvent(event: KeyboardEvent): boolean {
    return this.focus.ownsKeyEvent(event) && this.handleKeydown(event);
  }

  // Tab moves focus between the input and the open menu.
  toggleFocus(event: TabKeyEvent | null | undefined): boolean {
    if (this.state.destroyed || !isPlainTabKey(event) || !this.isOpenOrPending()) {
      return false;
    }
    if (typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    this.events.emit('focusToggled', undefined);
    if (this.focus.hasFocusInMenu()) {
      this.focus.focusInput();
    } else {
      this.focus.focusSearch();
    }
    return true;
  }

  // The tag opens the menu, or closes it when it is open.
  toggleFromTag(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isOpenOrPending()) {
      this.close(true);
    } else {
      this.open('none');
    }
  }

  handleTagKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.open(event.key === 'ArrowUp' ? 'last' : 'active');
    } else if (event.key === 'Escape' && this.state.open) {
      event.preventDefault();
      this.close(true);
    }
  }

  // A press outside the input and its menu closes the menu.
  readonly handleDocumentPointerDown = (event: Event): void => {
    if (this.state.open && !isPressInside(this.env.parts, event)) {
      this.close(false);
    }
  };

  // While the panel is open, Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z step back and
  // forth through the moves made in it. The host answers whether it had a
  // step to take; when it had none, the keys keep their usual meaning.
  readonly handleHistoryKeydown = (event: KeyboardEvent): void => {
    const onHistory = this.env.config.onModeMenuHistory;
    if (!this.state.open || event.altKey || !(event.metaKey || event.ctrlKey) || typeof onHistory !== 'function') {
      return;
    }
    const key = String(event.key || '').toLowerCase();
    const redo = key === 'y' && event.ctrlKey && !event.metaKey && !event.shiftKey;
    const direction = key === 'z' ? (event.shiftKey ? 'redo' : 'undo') : (redo ? 'redo' : '');
    if (direction && onHistory(direction) === true) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  destroy(): void {
    this.state.destroyed = true;
    this.state.requestId += 1;
    this.state.pending = false;
    this.surface.cancelReveal();
    this.icons.dispose();
  }

  private handlePointerDown(event: PointerEvent): void {
    if (!this.state.open) {
      return;
    }
    this.focus.setSearchActive(true);
    const target = event.target;
    const button = isElement(target) ? target.closest('[role="menuitemradio"]') : null;
    // Native pointer focus can scroll the panel's ancestors before click
    // returns focus to the input. All menu focus is managed with preventScroll.
    event.preventDefault();
    if (!button) {
      this.focus.focusSearch();
    }
  }

  private finishOpen(requestId: number, items: ModeMenuItemList, focusTarget: ModeMenuFocusTarget | undefined): boolean {
    const state = this.state;
    if (state.destroyed || requestId !== state.requestId) {
      return false;
    }
    state.pending = false;
    state.busy = false;
    state.filterQuery = '';
    state.focusId = '';
    this.hideTooltip();
    this.icons.clear();
    const shown = this.setItems(items);
    if (shown.length === 0) {
      this.drawing.draw();
      return false;
    }
    state.open = true;
    state.hasQuery = Boolean(String(this.env.parts.input.value || '').trim());
    this.drawing.draw();
    this.surface.alignFooter();
    this.surface.reveal();
    this.events.emit('openChanged', { open: true });
    this.surface.notifyLayoutChange();
    this.focusOnOpen(shown, focusTarget);
    return true;
  }

  private focusOnOpen(shown: readonly ModeMenuItem[], focusTarget: ModeMenuFocusTarget | undefined): void {
    if (focusTarget === 'input') {
      this.focus.focusInput();
    } else if (focusTarget === 'none') {
      this.focus.focusSearch();
    } else {
      const activeIndex = shown.findIndex((item) => item.active);
      this.focus.focusButton(focusTarget === 'last' ? shown.length - 1 : Math.max(activeIndex, 0));
    }
  }

  private finishRefresh(requestId: number, items: ModeMenuItemList, focusedModeId: string): boolean {
    const state = this.state;
    if (state.destroyed || requestId !== state.requestId || !state.open) {
      return false;
    }
    state.pending = false;
    state.busy = false;
    this.hideTooltip();
    const shown = this.setItems(items);
    state.hasQuery = Boolean(String(this.env.parts.input.value || '').trim());
    this.drawing.draw();
    if (shown.length === 0) {
      this.close(false);
      return false;
    }
    this.surface.alignFooter();
    this.surface.notifyLayoutChange();
    if (focusedModeId) {
      this.focus.focusMode(focusedModeId);
    }
    return true;
  }

  // A request whose items failed to load leaves the menu as it was.
  private failRequest(requestId: number): boolean {
    if (requestId === this.state.requestId) {
      this.state.pending = false;
      this.setBusy(false);
    }
    return false;
  }

  private readFocusedModeId(): string {
    const activeElement = this.focus.activeElement();
    return activeElement && activeElement.getAttribute('role') === 'menuitemradio' && hasDataset(activeElement)
      ? String(activeElement.dataset.modeId || '')
      : '';
  }

  // Takes the items to show; returns those that can be shown.
  private setItems(items: ModeMenuItemList): ModeMenuItem[] {
    this.state.entries = createModeMenuEntries(items, (item) => this.search.buildModeMenuSearchIndex(item));
    const shown = this.state.entries.map((entry) => entry.item);
    this.icons.request(shown);
    return shown;
  }

  private setBusy(busy: boolean): void {
    if (this.state.busy !== busy) {
      this.state.busy = busy;
      this.drawing.draw();
    }
  }

  private hideTooltip(): void {
    if (this.env.tooltip) {
      this.env.tooltip.hide();
    }
  }

  private settleSelection(item: ModeMenuItem, focusAfterSelect: 'input' | 'panel'): void {
    if (this.state.destroyed || !this.state.open) {
      return;
    }
    const selectedModeId = item && item.id ? String(item.id) : '';
    const shown = selectModeMenuEntry(this.state.entries, selectedModeId);
    this.drawing.draw();
    if (!shown) {
      this.refresh(selectedModeId);
    }
    if (focusAfterSelect === 'input') {
      this.focus.focusInput();
    } else if (!this.focus.focusMode(selectedModeId)) {
      this.focus.focusSearch();
    }
  }

  private selectById(id: string): void {
    const entry = findModeMenuEntry(this.state.entries, id);
    if (entry) {
      this.select(entry.item, { focusAfterSelect: 'input' });
    }
  }

  // The host stores the new group order and refreshes the menu.
  private moveGroup(groupKey: string, delta: number): void {
    const onGroupMove = this.env.config.onModeMenuGroupMove;
    if (typeof onGroupMove === 'function') {
      onGroupMove({ delta, group: groupKey, groups: getModeMenuGroupKeys(this.state.entries) });
    }
  }

  // A tile dropped in a new place among its list's tiles: they take their
  // new order where the last of them was. The host stores the order through
  // `onModeMenuReorder` and may refresh the menu afterwards.
  private reorder(id: string, list: string, orderedIds: string[]): void {
    const result = moveModeMenuEntries(this.state.entries, orderedIds);
    if (!result) {
      return;
    }
    this.state.entries = result.entries;
    this.drawing.draw();
    const onReorder = this.env.config.onModeMenuReorder;
    if (typeof onReorder !== 'function') {
      return;
    }
    const entry = findModeMenuEntry(this.state.entries, id);
    onReorder({
      item: entry ? entry.item : null,
      list,
      movedItems: result.moved.map((moved) => moved.item),
      listItems: this.state.entries.filter((candidate) => candidate.item.orderList === list).map((candidate) => candidate.item)
    });
  }

  private refreshSearchIndexes(): void {
    if (this.state.entries.length === 0) {
      return;
    }
    this.state.entries.forEach((entry) => {
      entry.searchIndex = this.search.buildModeMenuSearchIndex(entry.item);
    });
    if (this.drawing.isFiltered()) {
      this.applyFilter(this.state.filterQuery, { preserveScroll: true });
    }
  }
}

export type {
  ModeMenuConfig,
  ModeMenuEnv,
  ModeMenuEvents,
  ModeMenuFocusTarget,
  ModeMenuItemList,
  ModeMenuParts,
  ModeMenuReorder,
  ModeMenuSelectOptions,
  ModeMenuTooltip
};
export { ModeMenu };
