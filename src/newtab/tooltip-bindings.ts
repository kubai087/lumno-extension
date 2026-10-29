// Binds and hides the New Tab tooltips: top actions, search input, shortcut
// tiles, the shortcut dialog and bookmark cursor tooltips.
import type { CursorTooltipController, CursorTooltipOptions, CursorTooltipTextSource } from '../shared/ui/cursor-tooltip-model';
import type { TooltipBindOptions, TooltipController, TooltipShowOptions, TooltipTextSource } from '../shared/ui/tooltip';
import type { Translate } from './newtab-types';
import { newtabShortcutDockMagnificationEnabled } from '../domain/settings/newtab-shortcuts';
import type { SettingPreview } from './setting-preview';
import type { SearchBoxParts } from './search/search-box-parts';
import type { DragSessions } from './drag-sessions';
import { isBookmarkHoverSuppressed } from './dom/drag-hover';
import type { SelectMenuController } from './newtab-types';

interface TooltipBindingsDeps {
  preview: Pick<SettingPreview, 'get'>;
  topActionTooltipController: TooltipController;
  searchInputCursorTooltipController: CursorTooltipController;
  shortcutTooltipController: TooltipController;
  t: Translate;
  shortcutDialogTooltipController: TooltipController;
  bookmarkCursorTooltipController: CursorTooltipController;
  searchBox: Pick<SearchBoxParts, 'inputParts'>;
  shortcutGrid: HTMLElement;
  dragSessions: Pick<DragSessions, 'bookmark' | 'bookmarkDragging' | 'recentCardDragging' | 'shortcutDragging'>;
  // The context menus' select menus: tooltips hide as one opens, and tiles
  // show none while the shortcut menu is open.
  shortcutContextMenuSelectController: Pick<SelectMenuController, 'events' | 'isAnyOpen'>;
  bookmarkContextMenuSelectController: Pick<SelectMenuController, 'events'>;
  recentContextMenuSelectController: Pick<SelectMenuController, 'events'>;
}

function createTooltipBindings(deps: TooltipBindingsDeps) {
  const {
    shortcutGrid,
    searchBox,
    preview,
    topActionTooltipController,
    searchInputCursorTooltipController,
    shortcutTooltipController,
    t,
    shortcutDialogTooltipController,
    bookmarkCursorTooltipController,
    dragSessions,
    shortcutContextMenuSelectController,
    bookmarkContextMenuSelectController,
    recentContextMenuSelectController
  } = deps;

  function showTopActionTooltip(
    button: HTMLElement | null | undefined,
    text: string | null | undefined,
    options?: TooltipShowOptions | null
  ): void {
    if (!button || !text) {
      return;
    }
    const tooltipOptions = options && typeof options === 'object' ? options : {};
    const placement = tooltipOptions.placement === 'left' || tooltipOptions.placement === 'left-above'
      ? tooltipOptions.placement
      : 'top';
    topActionTooltipController.show(button, text, {
      ...tooltipOptions,
      placement,
      maxWidth: 420
    });
  }

  function hideTopActionTooltip(): void {
    topActionTooltipController.hide();
  }

  function bindSearchInputCursorTooltip(
    button: HTMLElement | null | undefined,
    getText: CursorTooltipTextSource | null | undefined
  ): HTMLElement | null {
    if (!button) {
      return null;
    }
    return searchInputCursorTooltipController.bind(button, getText, {
      maxWidth: 420,
      deferHideVisibility: true,
      preserveVisibleOnTargetSwitch: true,
      handoffRoot: searchBox.inputParts && searchBox.inputParts.container
        ? searchBox.inputParts.container
        : null
    });
  }

  function hideSearchInputCursorTooltip(): void {
    searchInputCursorTooltipController.hide();
  }

  function bindShortcutTooltip(
    target: HTMLElement | null | undefined,
    getText?: TooltipTextSource | null,
    options?: TooltipBindOptions | null
  ): HTMLElement | null {
    if (!target) {
      return null;
    }
    const tooltipOptions = options && typeof options === 'object' ? options : {};
    const resolveText: TooltipTextSource = typeof getText === 'function'
      ? getText
      : () => (typeof target.getAttribute === 'function' ? target.getAttribute('data-tooltip') : '');
    return shortcutTooltipController.bind(target, (tooltipTarget) => {
      if (isShortcutTooltipSuppressed()) {
        return '';
      }
      const tooltip = shortcutTooltipController.element;
      if (tooltip && (tooltipTarget.classList.contains('x-nt-shortcut-tile--folder') ||
          tooltipTarget.getAttribute('data-shortcut-from-bookmark') === 'true')) {
        tooltip.setAttribute('data-shortcut-origin-label',
          t('newtab_shortcuts_from_bookmarks', '(from bookmarks)'));
      } else if (tooltip) {
        tooltip.removeAttribute('data-shortcut-origin-label');
      }
      return resolveText(tooltipTarget);
    }, {
      placement: 'bottom',
      maxWidth: 360,
      spacing: () => (preview.get(newtabShortcutDockMagnificationEnabled) ? -6 : -2),
      showOnFocus: false,
      ...tooltipOptions
    });
  }

  function isShortcutTooltipSuppressed(): boolean {
    return Boolean(
      dragSessions.shortcutDragging ||
      (dragSessions.bookmarkDragging || dragSessions.recentCardDragging) ||
      (shortcutGrid && shortcutGrid.getAttribute('data-shortcut-dragging') === 'true') ||
      shortcutContextMenuSelectController.isAnyOpen()
    );
  }

  function hideShortcutTooltip(): void {
    shortcutTooltipController.hide();
  }

  function bindShortcutDialogTooltip(
    target: HTMLElement | null | undefined,
    getText?: TooltipTextSource | null,
    options?: TooltipBindOptions | null
  ): HTMLElement | null {
    if (!target) {
      return null;
    }
    return shortcutDialogTooltipController.bind(target, getText, {
      placement: 'top',
      maxWidth: 320,
      ...options
    });
  }

  function hideShortcutDialogTooltip(): void {
    shortcutDialogTooltipController.hide();
  }

  function bindCursorTooltip(
    target: HTMLElement | null | undefined,
    getText?: CursorTooltipTextSource | null,
    options?: CursorTooltipOptions | null
  ): HTMLElement | null {
    if (!target) {
      return null;
    }
    const tooltipOptions = options && typeof options === 'object' ? options : {};
    const originalShouldShow = typeof tooltipOptions.shouldShow === 'function'
      ? tooltipOptions.shouldShow
      : null;
    return bookmarkCursorTooltipController.bind(target, getText, {
      maxWidth: 460,
      ...tooltipOptions,
      shouldShow: (tooltipTarget, inputEvent) => {
        if (isBookmarkCursorTooltipSuppressed(tooltipTarget)) {
          return false;
        }
        return originalShouldShow ? originalShouldShow(tooltipTarget, inputEvent) !== false : true;
      }
    });
  }

  function isBookmarkCursorTooltipSuppressed(target: HTMLElement): boolean {
    return isBookmarkHoverSuppressed(dragSessions, target);
  }

  function hideCursorTooltip(): void {
    bookmarkCursorTooltipController.hide();
  }


  shortcutContextMenuSelectController.events.on('opening', () => {
    hideShortcutTooltip();
    hideTopActionTooltip();
  });
  [bookmarkContextMenuSelectController, recentContextMenuSelectController].forEach((controller) => {
    controller.events.on('opening', () => {
      hideCursorTooltip();
      hideTopActionTooltip();
    });
  });
  return {
    showTopActionTooltip,
    hideTopActionTooltip,
    bindSearchInputCursorTooltip,
    hideSearchInputCursorTooltip,
    bindShortcutTooltip,
    hideShortcutTooltip,
    bindShortcutDialogTooltip,
    hideShortcutDialogTooltip,
    bindCursorTooltip,
    hideCursorTooltip
  };
}

type TooltipBindings = ReturnType<typeof createTooltipBindings>;

export { createTooltipBindings };
export type { TooltipBindings, TooltipBindingsDeps };
