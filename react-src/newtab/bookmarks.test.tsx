import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBookmarksView,
  createBookmarksViewApi,
  getBookmarkCacheKey,
  getBookmarksSignature,
  type BookmarkCardElement,
  type BookmarkItem,
  type BookmarksViewController,
  type BookmarksViewOptions
} from './bookmarks';

let views: BookmarksViewController[] = [];

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
    getRiSvg: (id, sizeClass = '') =>
      `<i class="${sizeClass} ${id}"></i>`,
    getFigmaFolderSvg: (id) =>
      `<svg data-folder-id="${id}"></svg>`,
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
  view: BookmarksViewController;
  options: BookmarksViewOptions;
} {
  const options = createOptions(overrides);
  const view = createBookmarksView(options);
  views.push(view);
  return { view, options };
}

function renderItems(
  view: BookmarksViewController,
  items: BookmarkItem[],
  state: {
    signature?: string;
    folderId?: string;
    rootFolderId?: string;
    viewMode?: string;
    menuMode?: boolean;
  } = {}
) {
  let result = {
    changed: false,
    count: 0,
    isAtRoot: true,
    signature: ''
  };
  act(() => {
    result = view.render(items, {
      folderId: '1',
      rootFolderId: '1',
      viewMode: 'folder',
      ...state
    });
  });
  return result;
}

afterEach(() => {
  act(() => {
    views.forEach((view) => view.clear());
  });
  views = [];
});

describe('Bookmarks React island', () => {
  it('pins without opening, copying or changing the bookmark and refreshes after removal', async () => {
    const item = { id: 'pin', type: 'bookmark', title: 'Docs', url: 'https://example.com/docs' };
    const original = { ...item };
    let added = false;
    let finish!: (value: boolean) => void;
    const openUrl = vi.fn();
    const copyUrl = vi.fn();
    const addShortcut = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
    const { view } = createView({ addShortcut, hasShortcut: () => added, openUrl, copyUrl });
    renderItems(view, [item]);
    const pin = view.getCards()[0].querySelector<HTMLButtonElement>('.x-nt-bookmark-pin-action')!;
    expect(pin.getAttribute('aria-label')).toBe('Add to shortcuts: Docs');
    act(() => { pin.click(); pin.click(); });
    expect(addShortcut).toHaveBeenCalledTimes(1);
    expect(pin.getAttribute('aria-busy')).toBe('true');
    expect(openUrl).not.toHaveBeenCalled();
    expect(copyUrl).not.toHaveBeenCalled();
    act(() => pin.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(openUrl).not.toHaveBeenCalled();
    await act(async () => { added = true; finish(true); });
    expect(pin.dataset.added).toBe('true');
    expect(pin.querySelector('.ri-pushpin-fill')).not.toBeNull();
    expect(pin.getAttribute('aria-disabled')).toBe('true');
    act(() => pin.click());
    expect(addShortcut).toHaveBeenCalledTimes(1);
    expect(item).toEqual(original);
    act(() => { added = false; view.refreshShortcutStates(); });
    expect(pin.dataset.added).toBe('false');
    expect(pin.querySelector('.ri-pushpin-line')).not.toBeNull();
  });

  it('keeps failed pins retryable and does not claim they were added', async () => {
    const addShortcut = vi.fn().mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('Storage failed'));
    let added = false;
    const { view } = createView({ addShortcut, hasShortcut: () => added });
    renderItems(view, [{ id: 'retry', type: 'bookmark', title: 'Retry', url: 'https://example.com/' }]);
    const pin = view.getCards()[0].querySelector<HTMLButtonElement>('.x-nt-bookmark-pin-action')!;
    await act(async () => { pin.click(); });
    expect(pin.dataset.added).toBe('false');
    expect(pin.getAttribute('aria-busy')).toBe('false');
    expect(pin.title).toContain('Try again');
    await act(async () => { pin.click(); });
    expect(pin.getAttribute('aria-disabled')).toBe('false');
    act(() => { added = true; view.refreshShortcutStates(); });
    expect(pin.dataset.added).toBe('true');
  });

  it('does not pin folders, supports compact topbar items and suppresses stale context presses', () => {
    const addShortcut = vi.fn();
    const { view } = createView({ addShortcut, isActivationSuppressed: () => true });
    const site = { id: 's', type: 'bookmark', title: 'Site', url: 'https://example.com/' };
    renderItems(view, [{ id: 'f', type: 'folder', title: 'Folder' }, site]);
    expect(view.getCards()[0].querySelector('.x-nt-bookmark-pin-action')).toBeNull();
    act(() => view.getCards()[1].querySelector<HTMLButtonElement>('.x-nt-bookmark-pin-action')!.click());
    expect(addShortcut).not.toHaveBeenCalled();
    renderItems(view, [site], { viewMode: 'top' });
    expect(view.getCards()[0].querySelector('.x-nt-bookmark-pin-action')).not.toBeNull();
  });
  it('preserves signatures through the React API', () => {
    const item = {
      id: 'docs',
      type: 'bookmark',
      title: 'Docs',
      url: 'https://example.com/docs'
    };
    expect(getBookmarksSignature([item])).toBe(
      '0::docs::bookmark::Docs::https://example.com/docs::'
    );
    expect(getBookmarkCacheKey(item)).toBe(
      'docs::bookmark::Docs::https://example.com/docs::'
    );

    const options = createOptions();
    const view = createBookmarksView(options);
    views.push(view);

    expect(createBookmarksViewApi().implementation).toBe('react');
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
    const initialCards = view.getCards().slice();
    const grid = options.grid as HTMLElement;

    expect(initial.changed).toBe(true);
    expect(grid.dataset.reactIsland).toBe('bookmarks');
    expect(initialCards).toHaveLength(2);
    expect(initialCards[0]._xBookmarkItem).toBe(first);
    expect(initialCards[0]._xBookmarkPageIndex).toBe(0);
    expect(initialCards[0]._xTitleText).toBe('First');
    expect(initialCards[0]._xHost).toBe('example.com');
    expect(initialCards[0].dataset.bookmarkDraggable).toBe('true');
    expect(initialCards[0].dataset.themed).toBe('true');
    expect(attachFavicon).toHaveBeenCalledTimes(2);
    expect(bindTooltip).toHaveBeenCalledTimes(2);
    expect(applyTheme).toHaveBeenCalledTimes(2);

    const next = renderItems(view, [second, first], {
      signature: initial.signature
    });
    const reorderedCards = view.getCards();
    expect(next.changed).toBe(true);
    expect(reorderedCards[0]).toBe(initialCards[1]);
    expect(reorderedCards[1]).toBe(initialCards[0]);
    expect(reorderedCards[0]._xBookmarkPageIndex).toBe(0);
    expect(reorderedCards[1]._xBookmarkPageIndex).toBe(1);

    const unchanged = renderItems(view, [second, first], {
      signature: next.signature
    });
    expect(unchanged.changed).toBe(false);
    expect(view.getCards()[0]).toBe(initialCards[1]);
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
      viewMode: 'list',
      menuMode: true
    });
    const card = view.getCards()[0];

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
      view.setFolderIconsVisible(false);
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
      getFigmaFolderSvg: () => '<svg><path d="M0 0" /></svg>',
      playFolderPathMorph: morph
    });
    const folder: BookmarkItem = { id: 'design', parentId: '1', index: 0, type: 'folder', title: 'Design' };
    renderItems(view, [folder], { viewMode: 'top', menuMode: true });
    const card = view.getCards()[0];
    const path = card.querySelector('path')!;
    card.setAttribute('aria-expanded', 'true');
    card._xSetBookmarkMenuVisualActive?.(true);
    path.setAttribute('d', 'M9 13');
    morph.mockClear();
    renderItems(view, [{ id: 'link', parentId: '1', index: 0, title: 'Link', url: 'https://example.com/' }, { ...folder, title: 'Renamed', index: 1 }], { viewMode: 'top', menuMode: true });
    expect(view.getCards()[1]).toBe(card);
    expect(card.querySelector('path')).toBe(path);
    expect(path.getAttribute('d')).toBe('M9 13');
    expect(card.getAttribute('aria-expanded')).toBe('true');
    expect(card.classList.contains('x-nt-bookmark-card--folder-expanded')).toBe(true);
    expect(morph.mock.calls.every(([, active]) => active)).toBe(true);
    act(() => card.dispatchEvent(new PointerEvent('pointerout', { bubbles: true })));
    expect(card.classList.contains('x-nt-bookmark-card--folder-expanded')).toBe(true);
    card.setAttribute('aria-expanded', 'false');
    card._xSetBookmarkMenuVisualActive?.(false);
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
      viewMode: 'top',
      menuMode: true
    });

    expect(view.getCards()[0].dataset.bookmarkViewMode).toBe('top');
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
        viewMode,
        menuMode: viewMode !== 'folder'
      });

      expect(
        view.getCards().map((card) => card.dataset.bookmarkId)
      ).toEqual(['existing', 'moved']);
      expect(
        view.getCards().every(
          (card) => card.dataset.bookmarkDraggable === 'true'
        )
      ).toBe(true);
    }
  );

  it('preserves background opening, drag click suppression, and copy action', async () => {
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
    const card = view.getCards()[0];
    const copyButton = card.querySelector<HTMLButtonElement>(
      '.x-nt-bookmark-copy-action'
    );

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

    card._xBookmarkSuppressClick = true;
    act(() => {
      card.click();
    });
    expect(opened).toHaveLength(2);
    expect(card._xBookmarkSuppressClick).toBe(false);

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
    const card = view.getCards()[0];
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

  it('clears stale drag click suppression when a folder card is reused', () => {
    const openedFolders: string[] = [];
    const { view } = createView({
      openFolder: (folderId) => {
        openedFolders.push(String(folderId || ''));
      }
    });
    const folder: BookmarkItem = {
      id: 'nested-folder',
      parentId: 'parent-folder',
      index: 0,
      type: 'folder',
      title: 'Nested folder'
    };
    const sibling: BookmarkItem = {
      id: 'sibling',
      parentId: 'parent-folder',
      index: 1,
      type: 'bookmark',
      title: 'Sibling',
      url: 'https://example.com/sibling'
    };
    const initial = renderItems(view, [folder, sibling], {
      folderId: 'parent-folder'
    });
    const folderCard = view.getCards()[0];
    folderCard._xBookmarkSuppressClick = true;
    folderCard._xBookmarkSuppressClickTimer = window.setTimeout(
      () => {},
      420
    );

    renderItems(view, [
      { ...sibling, index: 0 },
      { ...folder, index: 1 }
    ], {
      folderId: 'parent-folder',
      signature: initial.signature
    });

    const reusedFolderCard = view.getCards()[1];
    expect(reusedFolderCard).toBe(folderCard);
    expect(reusedFolderCard._xBookmarkSuppressClick).toBe(false);
    act(() => {
      reusedFolderCard.click();
    });
    expect(openedFolders).toEqual(['nested-folder']);
  });

  it('renders the non-root empty state without a legacy cache', () => {
    const options = createOptions();
    const view = createBookmarksView(options);
    views.push(view);

    const result = renderItems(view, [], {
      folderId: 'child',
      rootFolderId: '1'
    });
    expect(result.isAtRoot).toBe(false);
    expect(
      options.grid?.querySelector('.x-nt-bookmark-empty')
    ).not.toBeNull();
    expect(view.getCards()).toEqual([]);

  });
});

interface OpenedBookmark {
  url: string;
  background: boolean;
}
