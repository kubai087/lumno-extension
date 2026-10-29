// The search box's mode: the tag at the input's start that says where a
// search goes (a site, an AI, bookmarks, history), its Tab hint, and the
// mode menu (the search scope panel). The parts live in search/input-mode/
// and are made in dependency order: the menu, the placeholder that reads
// it, the tag that opens it, then the Tab and Backspace keys that read
// both. Each part owns its state; a later part follows an earlier one
// through the events it emits.
import * as LumnoCursorTooltip from '../ui/cursor-tooltip';
import { createEventBus } from '../state/events';
import type { EventBus } from '../state/events';
import type { InputModeConfig, InputModeParts } from './input-mode/controller-types';
import { ModeTabKeys } from './input-mode/keys';
import type { ModeKeyEvent } from './input-mode/keys';
import { ModeMenu } from './input-mode/menu';
import type { ModeMenuEvents, ModeMenuFocusTarget } from './input-mode/menu';
import type { FitModeMenuOptions, ModeMenuResults } from './input-mode/menu/surface';
import { readControllerOptions } from './input-mode/mode-options';
import type { ControllerOptions, ModeMenuTooltipController } from './input-mode/mode-options';
import { getDocument, getWindow, setStyle } from './input-mode/page';
import type { InputModeWindow } from './input-mode/page';
import { InputPlaceholder } from './input-mode/placeholder';
import { ModeTag } from './input-mode/tag';
import type { ModeTagEvents, ModeTagOptions } from './input-mode/tag';
import type { InputModeProvider, InputModeTheme } from './input-mode/types';

// The surface's cursor tooltip for cut-off menu labels, or one the menu
// makes and owns.
interface ModeMenuTooltip {
  controller: ModeMenuTooltipController | null;
  owned: ReturnType<typeof LumnoCursorTooltip.createController> | null;
}

// The mode's parts, as the controller holds them.
interface InputMode {
  parts: InputModeParts;
  doc: Document;
  win: InputModeWindow;
  menu: ModeMenu;
  placeholder: InputPlaceholder;
  tag: ModeTag;
  keys: ModeTabKeys;
  menuEvents: EventBus<ModeMenuEvents>;
  tagEvents: EventBus<ModeTagEvents>;
  tooltip: ModeMenuTooltip;
  lifecycle: { destroyed: boolean };
}

// Where the tag sits and how it moves are the controller's: these start
// its place and rest motion, and the Tab hint's distance from the right.
function placeModeTag(parts: InputModeParts, options: ControllerOptions): void {
  setStyle(parts.modePrefix, 'left', '50px');
  setStyle(parts.modePrefix, 'transform', 'translateY(-50%)');
  setStyle(parts.modePrefix, 'opacity', '1');
  setStyle(parts.modePrefix, 'transition', options.prefixTransition);
  setStyle(parts.modePrefix, 'will-change', 'auto');
  setStyle(parts.modeTabHint, 'right', `${options.rightAnchorOffset}px`);
}

function createModeMenuTooltip(config: InputModeConfig, parts: InputModeParts, doc: Document, win: InputModeWindow): ModeMenuTooltip {
  const provided = config.modeMenuCursorTooltipController || config.modeMenuTooltipController || null;
  if (provided) {
    return { controller: provided, owned: null };
  }
  const owned = LumnoCursorTooltip.createController({
    portals: parts.portals,
    documentObj: doc,
    windowObj: win,
    appendTo: doc.body,
    id: `${parts.modePrefix.id}-label-cursor-tooltip`,
    maxWidth: 320,
    offsetX: 14,
    offsetY: 16
  });
  return { controller: owned, owned };
}

function createModeMenu(config: InputModeConfig, parts: InputModeParts, doc: Document, win: InputModeWindow, options: ControllerOptions) {
  const tooltip = createModeMenuTooltip(config, parts, doc, win);
  const events = createEventBus<ModeMenuEvents>();
  const menu = new ModeMenu({
    config,
    parts: {
      menu: parts.modeMenu,
      content: parts.modeMenuContent,
      footer: parts.modeMenuFooter,
      store: parts.modeMenuStore,
      container: parts.container,
      input: parts.input,
      tag: parts.modePrefix
    },
    doc,
    win,
    options,
    tooltip: tooltip.controller
  }, events);
  return { menu, events, tooltip };
}

function createInputMode(config: InputModeConfig, parts: InputModeParts, doc: Document): InputMode {
  const win = getWindow(config);
  const options = readControllerOptions(config, parts.input);
  placeModeTag(parts, options);
  const lifecycle = { destroyed: false };
  const { menu, events: menuEvents, tooltip } = createModeMenu(config, parts, doc, win, options);
  const placeholder = new InputPlaceholder({ input: parts.input, tag: parts.modePrefix, isMenuOpen: () => menu.isOpen() }, options);
  const tagEvents = createEventBus<ModeTagEvents>();
  const tag = new ModeTag({ config, parts, win, options }, menu, placeholder, tagEvents);
  const keys = new ModeTabKeys(win, config, {
    isDestroyed: () => lifecycle.destroyed,
    inputValue: () => String(parts.input.value || ''),
    isMenuOpen: () => menu.isOpen(),
    isMenuOpenOrPending: () => menu.isOpenOrPending(),
    hasModeTag: () => tag.hasMode()
  });
  return { parts, doc, win, menu, placeholder, tag, keys, menuEvents, tagEvents, tooltip, lifecycle };
}

function resetPendingKeys(keys: ModeTabKeys): void {
  keys.resetDoubleTab();
  keys.resetRemovalConfirmation();
}

// What follows from the menu and the tag: the placeholder, the container's
// open state, the tag's open look, and letting go of pending keys.
function connectInputMode(mode: InputMode): void {
  const { menu, tag, keys, placeholder, parts } = mode;
  mode.menuEvents.on('opening', () => {
    placeholder.sync();
    resetPendingKeys(keys);
  });
  mode.menuEvents.on('openChanged', ({ open }) => {
    if (!open) {
      resetPendingKeys(keys);
    }
    placeholder.sync();
    if (open) {
      parts.container.setAttribute('data-mode-menu-open', 'true');
    } else {
      parts.container.removeAttribute('data-mode-menu-open');
    }
    tag.setMenuOpen(open);
  });
  mode.menuEvents.on('focusToggled', () => {
    keys.resetDoubleTab();
  });
  mode.tagEvents.on('modeChanged', ({ preserveDoubleTab }) => {
    if (!preserveDoubleTab) {
      keys.resetDoubleTab();
    }
    keys.resetRemovalConfirmation();
  });
  placeholder.sync();
  menu.redraw();
}

function updateLayout(mode: InputMode): void {
  if (mode.lifecycle.destroyed) {
    return;
  }
  mode.tag.layout.updateRightPadding();
  mode.tag.layout.updatePrefixLayout();
  mode.menu.surface.alignFooter();
  if (mode.menu.isOpen()) {
    mode.menu.surface.notifyLayoutChange();
  }
}

// The input's own listeners: typing and keys let go of a pending double
// Tab and tag removal, and a press elsewhere closes the menu.
interface ModeListeners {
  input(): void;
  keydown(event: KeyboardEvent): void;
  blur(): void;
  focus(): void;
  resize(): void;
  pointerRoot: Node;
  resizeObserver: ResizeObserver | null;
}

function createModeListeners(mode: InputMode): ModeListeners {
  const { menu, keys } = mode;
  return {
    input() {
      menu.requestPinyin();
      resetPendingKeys(keys);
      menu.syncQueryLift();
    },
    keydown(event: KeyboardEvent) {
      if (event && event.key !== 'Tab') {
        keys.resetDoubleTab();
      }
      if (event && event.key !== 'Backspace' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        keys.resetRemovalConfirmation();
      }
    },
    blur: () => keys.resetDoubleTab(),
    focus: () => menu.focus.setSearchActive(false),
    resize: () => updateLayout(mode),
    pointerRoot: mode.parts.container.getRootNode(),
    resizeObserver: null
  };
}

function observeModeLayout(mode: InputMode, listeners: ModeListeners): ResizeObserver | null {
  const win = mode.win;
  if (!win || typeof win.ResizeObserver !== 'function') {
    return null;
  }
  const observer = new win.ResizeObserver(listeners.resize);
  observer.observe(mode.parts.modePrefix);
  observer.observe(mode.parts.modeTabHint);
  observer.observe(mode.parts.modeMenuContent);
  const badgeElement = mode.tag.layout.badgeElement();
  if (badgeElement) {
    observer.observe(badgeElement);
  }
  return observer;
}

function addModeListeners(mode: InputMode, config: InputModeConfig, listeners: ModeListeners): void {
  const { parts, doc, menu } = mode;
  parts.input.addEventListener('input', listeners.input);
  parts.input.addEventListener('keydown', listeners.keydown);
  parts.input.addEventListener('blur', listeners.blur);
  parts.input.addEventListener('focus', listeners.focus);
  if (typeof config.onModeMenuHistory === 'function') {
    parts.container.addEventListener('keydown', menu.handleHistoryKeydown, true);
  }
  doc.addEventListener('pointerdown', menu.handleDocumentPointerDown, true);
  if (listeners.pointerRoot !== doc) {
    listeners.pointerRoot.addEventListener('pointerdown', menu.handleDocumentPointerDown, true);
  }
  listeners.resizeObserver = observeModeLayout(mode, listeners);
  mode.win.addEventListener('resize', listeners.resize);
}

function removeModeListeners(mode: InputMode, listeners: ModeListeners): void {
  const { parts, doc, menu } = mode;
  parts.container.removeEventListener('keydown', menu.handleHistoryKeydown, true);
  mode.win.removeEventListener('resize', listeners.resize);
  if (listeners.resizeObserver) {
    listeners.resizeObserver.disconnect();
    listeners.resizeObserver = null;
  }
  parts.input.removeEventListener('input', listeners.input);
  parts.input.removeEventListener('keydown', listeners.keydown);
  parts.input.removeEventListener('blur', listeners.blur);
  parts.input.removeEventListener('focus', listeners.focus);
  doc.removeEventListener('pointerdown', menu.handleDocumentPointerDown, true);
  if (listeners.pointerRoot !== doc) {
    listeners.pointerRoot.removeEventListener('pointerdown', menu.handleDocumentPointerDown, true);
  }
}

function destroyInputMode(mode: InputMode, listeners: ModeListeners): void {
  const { menu, tag, keys, tooltip } = mode;
  mode.lifecycle.destroyed = true;
  menu.destroy();
  resetPendingKeys(keys);
  tag.cancelMotion();
  removeModeListeners(mode, listeners);
  tag.clear();
  tag.setTabHintVisible(false);
  if (tooltip.owned) {
    tooltip.owned.destroy();
  } else if (tooltip.controller) {
    tooltip.controller.hide();
  }
  mode.menuEvents.clear();
  mode.tagEvents.clear();
}

// The controller's API for the surface: the tag, the menu, the keys, and
// the layout they share.
function createInputModeApi(mode: InputMode, listeners: ModeListeners) {
  const { parts, menu, tag, keys } = mode;
  return Object.freeze({
    prefixElement: parts.modePrefix,
    tabHintElement: parts.modeTabHint,
    menuElement: parts.modeMenu,
    setProviderPrefix: (provider: InputModeProvider | null | undefined, theme?: InputModeTheme | null, tagOptions?: ModeTagOptions | null) => (
      tag.setProvider(provider, theme, tagOptions)
    ),
    setPrefixText: (prefixText: string, theme?: InputModeTheme | null, tagOptions?: ModeTagOptions | null) => (
      tag.setText(prefixText, theme, tagOptions)
    ),
    clearProviderPrefix: () => tag.clear(),
    setTabHintVisible: (visible: boolean, provider?: InputModeProvider | null) => tag.setTabHintVisible(visible, provider),
    hasActiveModeTag: () => tag.isActive(),
    openModeMenu: (focusTarget?: ModeMenuFocusTarget) => menu.open(focusTarget),
    refreshModeMenu: (preferredModeId?: string) => menu.refresh(preferredModeId),
    closeModeMenu: (restoreFocus?: boolean) => menu.close(restoreFocus),
    isModeMenuVisible: () => menu.surface.isVisible(),
    getModeMenuFilterQuery: () => menu.state.filterQuery,
    refreshModeMenuLanguage: () => {
      menu.redraw();
      mode.placeholder.sync();
    },
    placeModeMenuBelowResults: (results: ModeMenuResults, options?: FitModeMenuOptions | null) => (
      menu.surface.placeBelow(results, options)
    ),
    handleModeMenuTabFocusToggle: (event: ModeKeyEvent | null | undefined) => menu.toggleFocus(event),
    handleModeMenuKeyEvent: (event: KeyboardEvent) => menu.handleKeyEvent(event),
    shouldHandleModeMenuKeyEvent: (event: { target?: EventTarget | null } | null | undefined) => menu.focus.ownsKeyEvent(event),
    resetModeMenuDoubleTab: () => keys.resetDoubleTab(),
    resetModeTagRemovalConfirmation: () => keys.resetRemovalConfirmation(),
    shouldOpenModeMenuOnDoubleTab: (event: ModeKeyEvent | null | undefined) => keys.shouldOpenMenuOnDoubleTab(event),
    shouldCompleteModeMenuDoubleTab: (event: ModeKeyEvent | null | undefined) => keys.shouldCompleteMenuDoubleTab(event),
    shouldOpenModeMenuForActiveModeOnTab: (event: ModeKeyEvent | null | undefined) => keys.shouldOpenMenuForActiveModeOnTab(event),
    shouldRemoveModeTagOnBackspace: (event?: ModeKeyEvent | null) => keys.shouldRemoveTagOnBackspace(event),
    updateLayout: () => updateLayout(mode),
    destroy: () => destroyInputMode(mode, listeners)
  });
}

function createInputModeController(parts: InputModeParts, options?: InputModeConfig | null) {
  const config: InputModeConfig = options || {};
  const doc = getDocument(config);
  if (!doc || !parts || !parts.container || !parts.input) {
    throw new Error('createInputModeController requires input parts');
  }
  const mode = createInputMode(config, parts, doc);
  connectInputMode(mode);
  const listeners = createModeListeners(mode);
  addModeListeners(mode, config, listeners);
  return createInputModeApi(mode, listeners);
}

type InputModeController = ReturnType<typeof createInputModeController>;

export { createInputModeController };
export type { InputModeController };
