import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBookmarksView,
  getBookmarkCacheKey,
  type BookmarkCardElement,
  type BookmarkItem,
  type BookmarksViewController,
  type BookmarksViewOptions
} from './bookmarks';
import { BookmarksShown } from '../bookmarks/bookmarks-shown';
import { createViewStore } from '../../shared/react/view-store';
import type { Store } from '../../shared/state/store';
import { expectElement, required } from '../../../tests/fakes/dom';
import { queryHtmlTag } from '../../shared/dom-lookup';

// A view with the owner that draws its grid and the context menu mark the
// menu sets.
interface BookmarksHarness {
  controller: BookmarksViewController;
  shown: BookmarksShown;
  contextMenuBookmark: Store<{ id: string | null }>;
}

let views: BookmarksHarness[] = [];

function createOptions(
  overrides: Partial<BookmarksViewOptions> = {}
): BookmarksViewOptions {
  const grid = document.createElement('div');
  document.body.appendChild(grid);
  return {
    documentObj: document,
    windowObj: window,
    grid,
    cards: [],
    cardElementCache: new Map(),
    folderIconsVisible: true,
    t: (_key, fallback) => fallback,
    formatMessage: (_key, fallback, values) =>
      fallback.replace('{title}', values.title),
    sanitizeDisplayText: (value) => String(value || ''),
    getHostFromUrl: () => 'example.com',
    getSiteDisplayName: (_host, title) => title || 'Example',
    getUrlDisplay: (url) => url,
    initFolderPathMorph: () => {},
    playFolderPathMorph: () => {},
    stableHashCode: () => 0,
    normalizeHost: (host) => host,
    attachFaviconWithFallbacks: (image) => {
      image.src = 'data:image/png;base64,dGVzdA==';
    },
    isLocalNetworkHost: () => false,
    getChromeFaviconUrl: () => 'chrome://favicon/',
    getBrowserPageFaviconUrl: () => 'chrome-extension://favicon/',
    getImmediateThemeForSuggestion: () => ({ accent: 'blue' }),
    queueThemeForTarget: () => {},
    applyCardTheme: (card) => {
      card.dataset.themed = 'true';
    },
    shouldDelayHoverFromRecent: () => false,
    shouldSuppressHover: () => false,
    bindCursorTooltip: () => null,
    hideCursorTooltip: () => {},
    openFolder: () => {},
    openFolderMenu: () => {},
    copyUrl: () => Promise.resolve(true),
    openUrl: () => {},
    onItemContextMenu: () => {},
    ...overrides
  };
}

function createView(
  overrides: Partial<BookmarksViewOptions> = {}
): {
  view: BookmarksHarness;
  options: BookmarksViewOptions;
} {
  const shown = new BookmarksShown();
  const contextMenuBookmark = createViewStore<{ id: string | null }>({ id: null });
  const options = createOptions({ content: shown.grid, contextMenuBookmark, ...overrides });
  const view = { controller: createBookmarksView(options), shown, contextMenuBookmark };
  views.push(view);
  return { view, options };
}

// Draws a page as the pager does; `redraw` forgets what was drawn first.
function renderItems(
  view: BookmarksHarness,
  items: BookmarkItem[],
  state: { folderId?: string; rootFolderId?: string; viewMode?: string; redraw?: boolean } = {}
) {
  const folderId = state.folderId || '1';
  const rootFolderId = state.rootFolderId || '1';
  let changed = false;
  act(() => {
    view.shown.located(rootFolderId, folderId, []);
    if (state.redraw) {
      view.shown.forgetSignature();
    }
    changed = view.shown.draw(items, state.viewMode || 'folder');
  });
  return { changed, isAtRoot: folderId === rootFolderId };
}

afterEach(() => {
  act(() => {
    views.forEach((view) => view.shown.clear());
  });
  views = [];
});

describe('Bookmarks React island', () => {
  it('keys a card by what it shows', () => {
    const item = {
      id: 'docs',
      type: 'bookmark',
      title: 'Docs',
      url: 'https://example.com/docs'
    };
    expect(getBookmarkCacheKey(item)).toBe(
      'docs::bookmark::Docs::https://example.com/docs::'
    );
  });

  it('leaves a card alone when the grid renders again with the same bookmark', () => {
    const applyTheme = vi.fn();
    const attachFavicon = vi.fn();
    // The page hands out cached theme objects, the same one for the same site.
    const theme = { accent: 'blue' };
    const { view } = createView({
      applyCardTheme: applyTheme,
      attachFaviconWithFallbacks: attachFavicon,
      getImmediateThemeForSuggestion: () => theme
    });
    const items: BookmarkItem[] = [
      { id: 'site', parentId: '1', index: 0, type: 'bookmark', title: 'Site', url: 'https://example.com/' },
      { id: 'folder', parentId: '1', index: 1, type: 'folder', title: 'Folder', previewUrls: ['https://a.example/'] }
    ];
    renderItems(view, items, { redraw: true });
    const themed = applyTheme.mock.calls.length;
    const attached = attachFavicon.mock.calls.length;

    renderItems(view, items, { redraw: true });
    expect(applyTheme.mock.calls.length).toBe(themed);
    expect(attachFavicon.mock.calls.length).toBe(attached);
  });

  it('marks the card whose context menu is open', () => {
    const { view } = createView();
    const bookmark = (id: string, index: number): BookmarkItem => ({
      id,
      parentId: '1',
      index,
      type: 'bookmark',
      title: id,
      url: `https://example.com/${id}`
    });
    renderItems(view, [bookmark('first', 0), bookmark('second', 1)]);
    const marked = () => view.controller.getCards().map((card) => card.getAttribute('data-bookmark-context-menu-open'));

    act(() => view.contextMenuBookmark.setState({ id: 'first' }));
    expect(marked()).toEqual(['true', null]);
    act(() => view.contextMenuBookmark.setState({ id: null }));
    expect(marked()).toEqual([null, null]);
  });

  it('renders synchronously with external metadata and stable keyed cards', () => {
    const attachFavicon = vi.fn();
    const bindTooltip = vi.fn();
    const applyTheme = vi.fn((card: BookmarkCardElement) => {
      card.dataset.themed = 'true';
    });
    const { view, options } = createView({
      attachFaviconWithFallbacks: attachFavicon,
      bindCursorTooltip: bindTooltip,
      applyCardTheme: applyTheme
    });
    const first: BookmarkItem = {
      id: 'first',
      parentId: '1',
      index: 0,
      type: 'bookmark',
      title: 'First',
      url: 'https://example.com/first'
    };
    const second: BookmarkItem = {
      id: 'second',
      parentId: '1',
      index: 1,
      type: 'bookmark',
      title: 'Second',
      url: 'https://example.com/second'
    };

    const initial = renderItems(view, [first, second]);
    const initialCards = view.controller.getCards().slice();
    const grid = expectElement(options.grid);

    expect(initial.changed).toBe(true);
    expect(grid.dataset.reactIsland).toBe('bookmarks');
    expect(initialCards).toHaveLength(2);
    expect(initialCards[0]._xBookmarkItem).toBe(first);
    expect(initialCards[0]._xBookmarkPageIndex).toBe(0);
    expect(initialCards[0]._xTitleText).toBe('First');
    expect(initialCards[0].dataset.bookmarkDraggable).toBe('true');
    expect(initialCards[0].dataset.themed).toBe('true');
    expect(attachFavicon).toHaveBeenCalledTimes(2);
    expect(bindTooltip).toHaveBeenCalledTimes(2);
    expect(applyTheme).toHaveBeenCalledTimes(2);

    const next = renderItems(view, [second, first]);
    const reorderedCards = view.controller.getCards();
    expect(next.changed).toBe(true);
    expect(reorderedCards[0]).toBe(initialCards[1]);
    expect(reorderedCards[1]).toBe(initialCards[0]);
    expect(reorderedCards[0]._xBookmarkPageIndex).toBe(0);
    expect(reorderedCards[1]._xBookmarkPageIndex).toBe(1);

    const unchanged = renderItems(view, [second, first]);
    expect(unchanged.changed).toBe(false);
    expect(view.controller.getCards()[0]).toBe(initialCards[1]);
  });

  it('keeps folder hover, menu locking, and live icon visibility hooks', () => {
    const morphStates: boolean[] = [];
    let suppressHover = false;
    const openedFolders: Array<{
      item: BookmarkItem;
      card: BookmarkCardElement;
    }> = [];
    const { view } = createView({
      playFolderPathMorph: (_icon, active) => {
        morphStates.push(active);
      },
      shouldSuppressHover: () => suppressHover,
      openFolderMenu: (item, card) => {
        openedFolders.push({ item, card });
      }
    });
    const folder: BookmarkItem = {
      id: 'design',
      parentId: '1',
      index: 0,
      type: 'folder',
      title: 'Design',
      previewUrls: ['https://example.com/one']
    };
    renderItems(view, [folder], {
      viewMode: 'list'
    });
    const card = view.controller.getCards()[0];

    act(() => {
      card.dispatchEvent(new PointerEvent('pointerover', {
        bubbles: true,
        pointerType: 'mouse'
      }));
    });
    expect(card.classList.contains('x-nt-bookmark-card--hover')).toBe(
      true
    );
    expect(
      card.classList.contains(
        'x-nt-bookmark-card--folder-expanded'
      )
    ).toBe(true);
    expect(card.dataset.bookmarkViewMode).toBe('grid');

    act(() => {
      view.controller.setFolderIconsVisible(false);
    });
    expect(
      card.classList.contains(
        'x-nt-bookmark-card--folder-expanded'
      )
    ).toBe(false);

    act(() => {
      card.click();
      suppressHover = true;
      card.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        pointerType: 'mouse'
      }));
      card.click();
    });
    expect(openedFolders).toEqual([{ item: folder, card }, { item: folder, card }]);
    expect(card.classList.contains('x-nt-bookmark-card--hover')).toBe(
      true
    );
    expect(
      card.classList.contains(
        'x-nt-bookmark-card--folder-expanded'
      )
    ).toBe(true);

    act(() => {
      card.setAttribute('aria-expanded', 'false');
      card._xSetBookmarkMenuVisualActive?.(false);
    });
    expect(card.classList.contains('x-nt-bookmark-card--hover')).toBe(
      false
    );
    expect(morphStates).toEqual([true, false, true, false]);
  });

  it('keeps an open folder and its animated SVG through rename and reorder refreshes', () => {
    const morph = vi.fn();
    const { view } = createView({
      playFolderPathMorph: morph
    });
    const folder: BookmarkItem = { id: 'design', parentId: '1', index: 0, type: 'folder', title: 'Design' };
    renderItems(view, [folder], { viewMode: 'top' });
    const card = view.controller.getCards()[0];
    const path = required(card.querySelector('path'), 'path');
    card._xSetBookmarkMenuVisualActive?.(true);
    expect(card.getAttribute('aria-expanded')).toBe('true');
    path.setAttribute('d', 'M9 13');
    morph.mockClear();
    renderItems(view, [{ id: 'link', parentId: '1', index: 0, title: 'Link', url: 'https://example.com/' }, { ...folder, title: 'Renamed', index: 1 }], { viewMode: 'top' });
    expect(view.controller.getCards()[1]).toBe(card);
    expect(card.querySelector('path')).toBe(path);
    expect(path.getAttribute('d')).toBe('M9 13');
    expect(card.getAttribute('aria-expanded')).toBe('true');
    expect(card.classList.contains('x-nt-bookmark-card--folder-expanded')).toBe(true);
    expect(morph.mock.calls.every(([, active]) => active)).toBe(true);
    act(() => card.dispatchEvent(new PointerEvent('pointerout', { bubbles: true })));
    expect(card.classList.contains('x-nt-bookmark-card--folder-expanded')).toBe(true);
    card._xSetBookmarkMenuVisualActive?.(false);
    expect(card.getAttribute('aria-expanded')).toBe('false');
    expect(card.classList.contains('x-nt-bookmark-card--folder-expanded')).toBe(false);
  });

  it('marks topbar cards so drag previews keep the compact layout', () => {
    const { view } = createView();
    renderItems(view, [{
      id: 'design',
      parentId: '1',
      index: 0,
      type: 'folder',
      title: '设计规范分布'
    }], {
      viewMode: 'top'
    });

    expect(view.controller.getCards()[0].dataset.bookmarkViewMode).toBe('top');
  });

  it.each(['folder', 'list', 'top'] as const)(
    'keeps distinct same-URL bookmark cards in %s mode',
    (viewMode) => {
      const { view } = createView();
      renderItems(view, [
        {
          id: 'existing',
          parentId: '1',
          index: 0,
          type: 'bookmark',
          title: 'Existing',
          url: 'https://same.example/'
        },
        {
          id: 'moved',
          parentId: '1',
          index: 1,
          type: 'bookmark',
          title: 'Moved',
          url: 'https://same.example/'
        }
      ], {
        viewMode
      });

      expect(
        view.controller.getCards().map((card) => card.dataset.bookmarkId)
      ).toEqual(['existing', 'moved']);
      expect(
        view.controller.getCards().every(
          (card) => card.dataset.bookmarkDraggable === 'true'
        )
      ).toBe(true);
    }
  );

  it('preserves background opening, plain clicks, and copy action', async () => {
    const opened: OpenedBookmark[] = [];
    const copied: string[] = [];
    const { view } = createView({
      openUrl: (url, options) => {
        opened.push({
          url: String(url || ''),
          background: Boolean(options?.openInBackgroundTab)
        });
      },
      copyUrl: (url) => {
        copied.push(String(url || ''));
        return Promise.resolve(true);
      }
    });
    renderItems(view, [{
      id: 'docs',
      parentId: '1',
      index: 0,
      type: 'bookmark',
      title: 'Docs',
      url: 'https://example.com/docs'
    }]);
    const card = view.controller.getCards()[0];
    const copyButton = queryHtmlTag(card, '.x-nt-bookmark-copy-action', 'button');

    act(() => {
      card.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        ctrlKey: true
      }));
      card.dispatchEvent(new MouseEvent('auxclick', {
        bubbles: true,
        button: 1
      }));
    });
    expect(opened).toEqual([
      {
        url: 'https://example.com/docs',
        background: true
      },
      {
        url: 'https://example.com/docs',
        background: true
      }
    ]);

    act(() => {
      card.click();
    });
    expect(opened).toEqual([
      {
        url: 'https://example.com/docs',
        background: true
      },
      {
        url: 'https://example.com/docs',
        background: true
      },
      {
        url: 'https://example.com/docs',
        background: false
      }
    ]);

    expect(copyButton).toBeInstanceOf(HTMLButtonElement);
    await act(async () => {
      copyButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(copied).toEqual(['https://example.com/docs']);
  });

  it('does not open a card for presses meant for a context menu', () => {
    const openUrl = vi.fn();
    let suppressed = true;
    const { view } = createView({
      openUrl,
      isActivationSuppressed: () => suppressed
    });
    renderItems(view, [{
      id: 'docs',
      parentId: '1',
      index: 0,
      type: 'bookmark',
      title: 'Docs',
      url: 'https://example.com/docs'
    }]);
    const card = view.controller.getCards()[0];
    const press = () => {
      act(() => {
        card.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
        card.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1 }));
      });
    };

    press();
    expect(openUrl).not.toHaveBeenCalled();

    suppressed = false;
    press();
    expect(openUrl).toHaveBeenCalledTimes(2);
  });

  it('renders the non-root empty state without a legacy cache', () => {
    const { view, options } = createView();
    const result = renderItems(view, [], {
      folderId: 'child',
      rootFolderId: '1'
    });
    expect(result.isAtRoot).toBe(false);
    expect(
      options.grid?.querySelector('.x-nt-bookmark-empty')
    ).not.toBeNull();
    expect(view.controller.getCards()).toEqual([]);

  });
});

interface OpenedBookmark {
  url: string;
  background: boolean;
}
