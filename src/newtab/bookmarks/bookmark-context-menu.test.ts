import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { SurfaceLocale } from '../../shared/i18n/surface-locale';
import { createViewStore } from '../../shared/react/view-store';
import { createOptionsTestSettings } from '../../../tests/fakes/options-settings';
import { createSelectMenuController } from '../react/select-menu';
import { createBookmarkContextMenu } from './bookmark-context-menu';
import { createBookmarksRuntime } from './bookmarks-runtime';

// A context menu opened from a folder menu row closes once the pointer moves
// away from it; one opened from a bookmark card stays until a click.
const MENU_RECT = { left: 300, top: 200, right: 460, bottom: 380, width: 160, height: 180 };

function setUp() {
  const settings = createOptionsTestSettings({ sync: {}, local: {} });
  const controller = createSelectMenuController();
  const menu = createBookmarkContextMenu({
    bookmarksRuntime: createBookmarksRuntime({ chromeApi: null }),
    t: (_key, fallback) => fallback,
    openFolderColorPicker: () => Promise.resolve(),
    openExternalNewTabUrl() {},
    openBookmarkEditor() {},
    openBookmarkFolderTabGroupConfirmation() {},
    deleteBookmarkFromContextTarget: () => false,
    hasShortcutForSite: () => false,
    addSiteToShortcuts() {},
    hasShortcutForBookmarkFolder: () => false,
    addBookmarkFolderToShortcuts: () => Promise.resolve(false),
    hideCursorTooltip() {},
    bookmarkContextMenuSelectController: controller,
    bookmarkParts: { cascade: null, contextMenuBookmark: createViewStore<{ id: string | null }>({ id: null }) },
    dragSessions: { bookmark: null },
    locale: new SurfaceLocale(settings.store, async () => ({})),
    otherContextMenus: []
  });
  return { controller, menu };
}

function openAt(menu: ReturnType<typeof setUp>['menu'], sourceKind: 'cascade' | 'card', x: number, y: number): void {
  const element = document.createElement('button');
  document.body.appendChild(element);
  act(() => {
    menu.handleBookmarkItemContextMenu({
      event: new MouseEvent('contextmenu', { clientX: x, clientY: y, cancelable: true }),
      item: { id: 'site', title: 'Site', url: 'https://example.com/', type: 'bookmark', parentId: 'folder', index: 0 },
      element,
      sourceKind
    });
  });
}

function moveTo(x: number, y: number): void {
  act(() => {
    document.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: x, clientY: y }));
  });
}

function isOpen(): boolean {
  const surface = document.querySelector('.x-nt-bookmark-context-menu-portal');
  return surface ? surface.getAttribute('data-open') === 'true' : false;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('New Tab bookmark context menu: pointer leaving', () => {
  it('closes a menu opened from a folder menu row once the pointer moves away', () => {
    const { menu } = setUp();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ ...MENU_RECT, x: 300, y: 200, toJSON: () => MENU_RECT });
    openAt(menu, 'cascade', 310, 190);
    expect(isOpen()).toBe(true);

    // Heading into the menu and across it keeps it open.
    moveTo(310, 192);
    moveTo(320, 210);
    moveTo(450, 370);
    expect(isOpen()).toBe(true);

    // Out past its edge by less than the tolerance still keeps it.
    moveTo(470, 370);
    expect(isOpen()).toBe(true);

    moveTo(500, 370);
    expect(isOpen()).toBe(false);
  });

  it('closes when the pointer moves away without ever reaching the menu', () => {
    const { menu } = setUp();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ ...MENU_RECT, x: 300, y: 200, toJSON: () => MENU_RECT });
    openAt(menu, 'cascade', 310, 190);
    moveTo(310, 190);
    moveTo(310, 160);
    expect(isOpen()).toBe(false);
  });

  it('keeps a menu opened from a bookmark card open as the pointer leaves', () => {
    const { menu } = setUp();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ ...MENU_RECT, x: 300, y: 200, toJSON: () => MENU_RECT });
    openAt(menu, 'card', 310, 190);
    moveTo(320, 210);
    moveTo(800, 600);
    expect(isOpen()).toBe(true);
  });
});
