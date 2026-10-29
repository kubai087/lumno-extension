import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createShortcutsView,
  type VisibleShortcutItem,
  type ShortcutsLayout,
  type ShortcutTileElement,
  type ShortcutsViewController,
  type ShortcutsViewOptions
} from './shortcuts';
import { expectElement, getElement, getTag, required } from '../../../tests/react/dom';
import { queryHtmlTag } from '../../shared/dom-lookup';
import type { ShortcutLink, VisibleShortcutFolder } from '../../domain/shortcuts/types';

let views: ShortcutsViewController[] = [];

// A link shortcut; its host stays empty unless given, so tiles read it
// from getHostFromUrl.
function site(fields: Omit<ShortcutLink, 'host'> & { host?: string }): ShortcutLink {
  return { host: '', ...fields };
}

const folderEntry: VisibleShortcutFolder = { id: 'folder-entry', type: 'folder', folderId: '42', title: 'Design' };

function createOptions(
  overrides: Partial<ShortcutsViewOptions> = {}
): ShortcutsViewOptions {
  const grid = document.createElement('div');
  document.body.appendChild(grid);
  return {
    grid,
    tiles: [],
    getShortcutTitle: (shortcut) => shortcut.title || ('host' in shortcut ? shortcut.host : ''),
    getHostFromUrl: () => 'example.com',
    getShortcutIconDataUrl: () => '',
    getShortcutFaviconCandidateUrl: () => '',
    getImmediateThemeForSuggestion: () => ({ accent: 'blue' }),
    applyShortcutTileTheme: (tile) => {
      tile.dataset.themed = 'true';
    },
    queueThemeForTarget: () => {},
    attachFaviconWithFallbacks: (image) => {
      image.src = 'data:image/png;base64,dGVzdA==';
    },
    bindTooltip: () => null,
    hideTooltip: () => {},
    formatOpenLabel: (title) => `Open ${title}`,
    isMiddleClick: (event) => event.button === 1,
    openShortcut: () => {},
    onContextMenu: () => {},
    onNativeDragStart: (event) => event.preventDefault(),
    getAddLabel: () => 'Add shortcut',
    getAddVisible: () => true,
    onAdd: () => {},
    onAddContextMenu: () => {},
    ...overrides
  };
}

function createView(
  overrides: Partial<ShortcutsViewOptions> = {}
): {
  view: ShortcutsViewController;
  options: ShortcutsViewOptions;
} {
  const options = createOptions(overrides);
  const view = createShortcutsView(options);
  views.push(view);
  return { view, options };
}

function renderItems(
  view: ShortcutsViewController,
  items: VisibleShortcutItem[],
  layout?: ShortcutsLayout
): { count: number } {
  let result = { count: 0 };
  act(() => {
    result = view.render(items, layout);
  });
  return result;
}

afterEach(() => {
  act(() => {
    views.forEach((view) => view.clear());
  });
  views = [];
});

describe('Shortcuts React island', () => {
  it('renders a live folder entry with the shared animated icon and menu semantics', () => {
    const initFolderIcon = vi.fn();
    const animateFolderIcon = vi.fn();
    const openShortcut = vi.fn();
    const queueThemeForTarget = vi.fn();
    const resolveShortcutFaviconDataUrl = vi.fn(() => Promise.resolve(''));
    const { view, options } = createView({
      initFolderIcon, animateFolderIcon, openShortcut, resolveShortcutFaviconDataUrl,
      queueThemeForTarget
    });
    renderItems(view, [folderEntry]);
    const tile = getTag(required(options.grid, 'options.grid'), '[data-shortcut-id="folder-entry"]', 'button');
    expect(tile.getAttribute('aria-haspopup')).toBe('menu');
    expect(tile.getAttribute('data-bookmark-drop-folder-id')).toBe('42');
    expect(tile.querySelector('svg[data-folder-color-id="42"]')).not.toBeNull();
    expect(tile.querySelector('#x-nt-folder-filter-lower-base-shortcut-folder-entry')).not.toBeNull();
    expect(tile.dataset.themed).toBe('true');
    expect(tile.querySelector('.x-nt-shortcut-icon--folder')?.classList.contains('x-nt-shortcut-icon')).toBe(true);
    expect(initFolderIcon).toHaveBeenCalledTimes(1);
    expect(resolveShortcutFaviconDataUrl).not.toHaveBeenCalled();
    expect(queueThemeForTarget).not.toHaveBeenCalled();
    act(() => tile.click());
    expect(openShortcut).toHaveBeenCalledWith(expect.objectContaining({ folderId: '42' }), expect.anything());
    const folderTile: ShortcutTileElement = tile;
    required(folderTile._xSetBookmarkMenuVisualActive, 'folderTile._xSetBookmarkMenuVisualActive')(true);
    expect(animateFolderIcon).toHaveBeenLastCalledWith(tile.querySelector('.x-nt-shortcut-icon'), true);
    expect(tile.hasAttribute('data-shortcut-folder-open')).toBe(true);
    required(folderTile._xSetBookmarkMenuVisualActive, 'folderTile._xSetBookmarkMenuVisualActive')(false);
    expect(tile.hasAttribute('data-shortcut-folder-open')).toBe(false);
  });
  it('preserves animated SVG nodes when a folder shortcut rerenders or is renamed', () => {
    const { view, options } = createView();
    const folder = folderEntry;
    renderItems(view, [folder]);
    const path = required(required(options.grid, 'grid').querySelector('path'), 'path');
    path.setAttribute('d', 'M9 13');
    renderItems(view, [folder]);
    renderItems(view, [{ ...folder, title: 'Design renamed' }]);
    expect(required(options.grid, 'options.grid').querySelector('path')).toBe(path);
    expect(path.getAttribute('d')).toBe('M9 13');
    expect(required(options.grid, 'options.grid').querySelector('[data-shortcut-title="Design renamed"]')).not.toBeNull();
  });
  it('keeps the folder icon open while the pointer moves into its context menu', () => {
    const animateFolderIcon = vi.fn();
    const { view } = createView({
      animateFolderIcon
    });
    renderItems(view, [folderEntry]);
    const tile = view.getTiles()[0];
    const icon = tile.querySelector('.x-nt-shortcut-icon');
    act(() => view.setContextMenuMark({ kind: 'shortcut', shortcutId: 'folder-entry' }));
    expect(animateFolderIcon).toHaveBeenLastCalledWith(icon, true);
    expect(tile.hasAttribute('data-shortcut-folder-open')).toBe(true);
    animateFolderIcon.mockClear();
    act(() => tile.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: document.body })));
    expect(animateFolderIcon).not.toHaveBeenCalled();
    // A folder contents menu can open and close while the context menu stays open.
    required(tile._xSetBookmarkMenuVisualActive, 'tile._xSetBookmarkMenuVisualActive')(true);
    required(tile._xSetBookmarkMenuVisualActive, 'tile._xSetBookmarkMenuVisualActive')(false);
    expect(tile.hasAttribute('data-shortcut-folder-open')).toBe(true);
    act(() => view.setContextMenuMark(null));
    expect(animateFolderIcon).toHaveBeenLastCalledWith(icon, false);
    expect(tile.hasAttribute('data-shortcut-folder-open')).toBe(false);
  });
  it('keeps an open folder contents menu expanded when its context menu closes', () => {
    const animateFolderIcon = vi.fn();
    const onFolderMenuChange = vi.fn();
    const { view } = createView({ animateFolderIcon, onFolderMenuChange });
    renderItems(view, [folderEntry]);
    const tile = view.getTiles()[0];
    required(tile._xSetBookmarkMenuVisualActive, 'tile._xSetBookmarkMenuVisualActive')(true);
    expect(tile.getAttribute('aria-expanded')).toBe('true');
    expect(onFolderMenuChange).toHaveBeenLastCalledWith(tile);
    act(() => view.setContextMenuMark({ kind: 'shortcut', shortcutId: 'folder-entry' }));
    act(() => view.setContextMenuMark(null));
    expect(animateFolderIcon).toHaveBeenLastCalledWith(tile.querySelector('.x-nt-shortcut-icon'), true);
    expect(tile.hasAttribute('data-shortcut-folder-open')).toBe(true);
    required(tile._xSetBookmarkMenuVisualActive, 'tile._xSetBookmarkMenuVisualActive')(false);
    expect(tile.getAttribute('aria-expanded')).toBe('false');
    expect(tile.hasAttribute('data-shortcut-folder-open')).toBe(false);
  });
  it('marks the tile or add button its context menu is open for', () => {
    const { view } = createView();
    renderItems(view, [
      site({ id: 'docs', title: 'Docs', url: 'https://example.com/docs' }),
      site({ id: 'mail', title: 'Mail', url: 'https://example.com/mail' })
    ]);
    const marked = () => view.getTiles().map((tile) => tile.getAttribute('data-shortcut-context-menu-open'));

    act(() => view.setContextMenuMark({ kind: 'shortcut', shortcutId: 'mail' }));
    expect(marked()).toEqual([null, 'true']);
    act(() => view.setContextMenuMark({ kind: 'add' }));
    expect(marked()).toEqual([null, null]);
    expect(view.getAddButton()?.getAttribute('data-shortcut-context-menu-open')).toBe('true');
    act(() => view.setContextMenuMark(null));
    expect(view.getAddButton()?.hasAttribute('data-shortcut-context-menu-open')).toBe(false);
  });

  it('renders shortcut metadata and keeps the external tile cache synchronous', () => {
    const attachFavicon = vi.fn((image: HTMLImageElement) => {
      image.src = 'data:image/png;base64,dGVzdA==';
    });
    const applyTheme = vi.fn((tile: HTMLButtonElement) => {
      tile.dataset.themed = 'true';
    });
    const bindTooltip = vi.fn();
    const { view, options } = createView({
      attachFaviconWithFallbacks: attachFavicon,
      applyShortcutTileTheme: applyTheme,
      bindTooltip
    });
    const result = renderItems(view, [site({
      id: 'docs',
      title: 'Docs',
      url: 'https://example.com/docs'
    })]);
    const grid = expectElement(options.grid);
    const tile = view.getTiles()[0];

    expect(result).toEqual({ count: 1 });
    expect(grid.dataset.reactIsland).toBe('shortcuts');
    expect(tile.dataset.shortcutId).toBe('docs');
    expect(tile.dataset.shortcutUrl).toBe('https://example.com/docs');
    expect(tile.dataset.shortcutDraggable).toBe('true');
    expect(tile.dataset.themed).toBe('true');
    expect(tile.getAttribute('aria-label')).toBe('Open Docs');
    expect(tile._xHost).toBe('example.com');
    expect(view.getAddButton()?.dataset.tooltip).toBe('Add shortcut');
    expect(attachFavicon).toHaveBeenCalledWith(
      expect.any(HTMLImageElement),
      'https://example.com/docs',
      'example.com',
      {
        primaryUrl: '',
        pageSpecificUrl: '',
        skipPersisted: true,
        sourceProfile: 'shortcut'
      }
    );
    expect(applyTheme).toHaveBeenCalledOnce();
    expect(bindTooltip).toHaveBeenCalledTimes(2);
  });

  it('routes click, keyboard, middle-click, context menu, and add actions', () => {
    const openShortcut = vi.fn();
    const onContextMenu = vi.fn();
    const onAdd = vi.fn();
    const onAddContextMenu = vi.fn();
    const { view } = createView({
      openShortcut,
      onContextMenu,
      onAdd,
      onAddContextMenu
    });
    renderItems(view, [site({
      id: 'docs',
      title: 'Docs',
      url: 'https://example.com/docs'
    })]);
    const tile = view.getTiles()[0];

    act(() => {
      tile.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        button: 0
      }));
      tile.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'Enter'
      }));
      tile.dispatchEvent(new MouseEvent('auxclick', {
        bubbles: true,
        button: 1
      }));
      tile.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true
      }));
      view.getAddButton()?.click();
      view.getAddButton()?.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true
      }));
    });

    expect(openShortcut).toHaveBeenCalledTimes(3);
    expect(onContextMenu).toHaveBeenCalledOnce();
    expect(onAdd).toHaveBeenCalledWith(view.getAddButton());
    expect(onAddContextMenu).toHaveBeenCalledWith(view.getAddButton());
  });

  it('does not open a tile for presses meant for a context menu', () => {
    const openShortcut = vi.fn();
    let suppressed = true;
    const { view } = createView({
      openShortcut,
      isActivationSuppressed: () => suppressed
    });
    renderItems(view, [site({
      id: 'docs',
      title: 'Docs',
      url: 'https://example.com/docs'
    })]);
    const tile = view.getTiles()[0];
    const press = () => {
      act(() => {
        tile.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
        tile.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1 }));
      });
    };

    press();
    act(() => {
      tile.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    });
    expect(openShortcut).toHaveBeenCalledTimes(1);

    suppressed = false;
    press();
    expect(openShortcut).toHaveBeenCalledTimes(3);
  });

  it('moves a focused tile with Alt+Arrow instead of navigating', () => {
    const moveShortcut = vi.fn(() => true);
    const openShortcut = vi.fn();
    const { view } = createView({ moveShortcut, openShortcut });
    renderItems(view, [
      site({ id: 'docs', title: 'Docs', url: 'https://example.com/docs' }),
      site({ id: 'mail', title: 'Mail', url: 'https://example.com/mail' })
    ]);
    const tile = view.getTiles()[0];
    const press = (key: string, init: KeyboardEventInit = {}) => {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, ...init });
      act(() => {
        tile.dispatchEvent(event);
      });
      return event;
    };

    expect(press('ArrowRight', { altKey: true }).defaultPrevented).toBe(true);
    expect(press('ArrowLeft', { altKey: true }).defaultPrevented).toBe(true);
    press('ArrowRight');
    press('ArrowRight', { altKey: true, shiftKey: true });
    expect(moveShortcut.mock.calls).toEqual([['docs', 1], ['docs', -1]]);
    expect(openShortcut).not.toHaveBeenCalled();
    expect(tile.getAttribute('aria-keyshortcuts')).toBe('Alt+ArrowLeft Alt+ArrowRight');
  });

  it('hides the add tile when the preference is off and restores it live', () => {
    let addVisible = false;
    const { view } = createView({
      getAddVisible: () => addVisible
    });

    renderItems(view, [site({
      id: 'docs',
      title: 'Docs',
      url: 'https://example.com/docs'
    })]);
    expect(view.getAddButton()?.hidden).toBe(true);

    addVisible = true;
    renderItems(view, [site({
      id: 'docs',
      title: 'Docs',
      url: 'https://example.com/docs'
    })]);
    expect(view.getAddButton()?.hidden).toBe(false);
  });

  it('hides the add tile at capacity without removing existing shortcuts', () => {
    const { view } = createView({
      maxShortcuts: 2
    });
    renderItems(view, [
      site({
        id: 'one',
        title: 'One',
        url: 'https://one.example/'
      }),
      site({
        id: 'two',
        title: 'Two',
        url: 'https://two.example/'
      })
    ]);

    expect(view.getTiles()).toHaveLength(2);
    expect(view.getAddButton()?.hidden).toBe(true);

    renderItems(view, [site({
      id: 'one',
      title: 'One',
      url: 'https://one.example/'
    })]);

    expect(view.getAddButton()?.hidden).toBe(false);
  });

  it('renders uploaded icons without invoking the favicon fallback runtime', () => {
    const attachFavicon = vi.fn();
    const getImmediateTheme = vi.fn(() => ({ accent: 'custom' }));
    const queueTheme = vi.fn();
    const { view } = createView({
      getShortcutIconDataUrl: (shortcutId) =>
        shortcutId === 'custom'
          ? 'data:image/png;base64,Y3VzdG9t'
          : '',
      attachFaviconWithFallbacks: attachFavicon,
      getImmediateThemeForSuggestion: getImmediateTheme,
      queueThemeForTarget: queueTheme
    });
    renderItems(view, [site({
      id: 'custom',
      title: 'Custom',
      url: 'https://example.com/'
    })]);
    const tile = view.getTiles()[0];
    const image = queryHtmlTag(tile, '.x-nt-shortcut-favicon', 'img');

    expect(tile.dataset.shortcutCustomIcon).toBe('true');
    expect(image?.src).toContain('data:image/png;base64,Y3VzdG9t');
    expect(attachFavicon).not.toHaveBeenCalled();
    expect(getImmediateTheme).toHaveBeenCalledWith(expect.objectContaining({
      customIconDataUrl: 'data:image/png;base64,Y3VzdG9t'
    }));
    expect(queueTheme).toHaveBeenCalledWith(
      tile,
      expect.objectContaining({
        customIconDataUrl: 'data:image/png;base64,Y3VzdG9t'
      }),
      expect.any(Function),
      { priority: 0 }
    );
  });

  it('puts see-through artwork on a plate unless the shortcut turns it off', () => {
    const analyze = vi.fn(() => ({ transparent: true, accent: [238, 77, 45], palette: [[238, 77, 45]] }));
    const { view } = createView({
      // Stands in for a decoded image, which jsdom never produces.
      attachFaviconWithFallbacks: (image) => {
        Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 32 });
        Object.defineProperty(image, 'complete', { configurable: true, value: true });
        image.src = 'data:image/png;base64,dGVzdA==';
      },
      analyzeShortcutIcon: analyze,
      resolveShortcutIconPlate: ({ mode, analysis, eligible }) => (
        mode !== 'off' && eligible !== false && (mode === 'on' || analysis?.transparent)
          ? { light: 'rgb(253, 236, 231)', dark: 'rgb(80, 40, 30)', custom: false } : null)
    });
    renderItems(view, [site({ id: 'shopee', title: 'Shopee', url: 'https://shopee.example/' })]);
    const mask = () => getElement(view.getTiles()[0], '.x-nt-shortcut-favicon-mask');
    expect(mask().dataset.iconPlate).toBe('true');
    expect(mask().style.getPropertyValue('--x-nt-shortcut-icon-plate-light')).toBe('rgb(253, 236, 231)');

    renderItems(view, [site({ id: 'shopee', title: 'Shopee', url: 'https://shopee.example/', iconPlate: 'off' })]);
    expect(mask().dataset.iconPlate).toBeUndefined();

    // Another site's artwork is read again before it gets a plate.
    analyze.mockReturnValueOnce({ transparent: false, accent: [238, 77, 45], palette: [[238, 77, 45]] });
    renderItems(view, [site({ id: 'shopee', title: 'Shopee', url: 'https://other.example/' })]);
    expect(mask().dataset.iconPlate).toBeUndefined();
  });

  it('reads the artwork once the favicon runtime clears its placeholder mark', async () => {
    const analyze = vi.fn(() => ({ transparent: true, accent: [238, 77, 45], palette: [[238, 77, 45]] }));
    const { view } = createView({
      attachFaviconWithFallbacks: (image) => {
        Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 32 });
        Object.defineProperty(image, 'complete', { configurable: true, value: true });
        image.setAttribute('data-favicon-placeholder', 'true');
        image.src = 'data:image/png;base64,dGVzdA==';
      },
      analyzeShortcutIcon: analyze,
      resolveShortcutIconPlate: ({ analysis }) => (analysis?.transparent
        ? { light: 'rgb(253, 236, 231)', dark: 'rgb(80, 40, 30)', custom: false } : null)
    });
    renderItems(view, [site({ id: 'shopee', title: 'Shopee', url: 'https://shopee.example/' })]);
    const tile = view.getTiles()[0];
    const image = getTag(tile, 'img', 'img');
    act(() => {
      image.dispatchEvent(new Event('load'));
    });
    expect(analyze).not.toHaveBeenCalled();
    expect(getElement(tile, '.x-nt-shortcut-favicon-mask').dataset.iconPlate).toBeUndefined();
    // The runtime's own load handler runs after React's and clears the mark.
    await act(async () => {
      image.removeAttribute('data-favicon-placeholder');
      await Promise.resolve();
    });
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(getElement(tile, '.x-nt-shortcut-favicon-mask').dataset.iconPlate).toBe('true');
  });

  it('uses bundled artwork without acquiring an icon from the browser or a remote service', () => {
    const assetUrl = 'chrome-extension://abc/assets/images/site-search/glyph-xhs.png';
    const attachFavicon = vi.fn();
    const resolveShortcutFaviconDataUrl = vi.fn(() => Promise.resolve(''));
    const { view } = createView({
      getShortcutFaviconCandidateUrl: () => assetUrl,
      resolveShortcutFaviconDataUrl,
      attachFaviconWithFallbacks: attachFavicon
    });
    renderItems(view, [site({ id: 'xhs', title: '小红书', url: 'https://www.xiaohongshu.com/' })]);
    expect(resolveShortcutFaviconDataUrl).not.toHaveBeenCalled();
    expect(document.querySelector('.x-nt-shortcut-favicon-mask')?.getAttribute('data-builtin-icon')).toBe('true');
    expect(attachFavicon).toHaveBeenLastCalledWith(
      expect.any(HTMLImageElement), 'https://www.xiaohongshu.com/', 'example.com',
      { primaryUrl: assetUrl, pageSpecificUrl: '', skipPersisted: true, sourceProfile: 'shortcut' }
    );
  });

  it('retries a missing snapshot after policy changes and then retains the saved image', async () => {
    let revision = 0;
    let cachedDataUrl = '';
    const savedImage = 'data:image/png;base64,c25hcHNob3Q=';
    const acquireIcon = vi.fn()
      .mockResolvedValueOnce('')
      .mockImplementationOnce(async () => {
        cachedDataUrl = savedImage;
        return savedImage;
      });
    const attachFavicon = vi.fn();
    const { view } = createView({
      getShortcutFaviconPolicyRevision: () => revision,
      getShortcutFaviconDataUrl: () => cachedDataUrl,
      resolveShortcutFaviconDataUrl: acquireIcon,
      attachFaviconWithFallbacks: attachFavicon
    });
    const items = [site({ id: 'stable', title: 'Stable', url: 'https://unlisted.example/' })];
    renderItems(view, items);
    await act(async () => { await Promise.resolve(); });
    expect(acquireIcon).toHaveBeenCalledTimes(1);
    revision += 1;
    renderItems(view, items);
    await act(async () => { await Promise.resolve(); });
    expect(acquireIcon).toHaveBeenCalledTimes(2);
    expect(attachFavicon).toHaveBeenLastCalledWith(
      expect.any(HTMLImageElement), 'https://unlisted.example/', 'example.com',
      { primaryUrl: '', pageSpecificUrl: savedImage, skipPersisted: true, sourceProfile: 'shortcut' }
    );
    revision += 1;
    renderItems(view, items);
    expect(acquireIcon).toHaveBeenCalledTimes(2);
  });

  it('waits for a saved icon without displaying a live browser favicon', async () => {
    const attachFavicon = vi.fn();
    let finishResolution: (dataUrl: string) => void = () => {};
    const resolveShortcutFaviconDataUrl = vi.fn(() => new Promise<string>((resolve) => {
      finishResolution = resolve;
    }));
    const { view } = createView({
      attachFaviconWithFallbacks: attachFavicon,
      getShortcutFaviconDataUrl: () => '',
      resolveShortcutFaviconDataUrl
    });
    renderItems(view, [site({
      id: 'docs',
      title: 'Docs',
      url: 'https://example.com/docs'
    })]);

    expect(attachFavicon).toHaveBeenCalledOnce();
    expect(resolveShortcutFaviconDataUrl).toHaveBeenCalledWith(
      'https://example.com/docs'
    );

    await act(async () => {
      finishResolution('data:image/png;base64,aGlnaC1yZXM=');
      await Promise.resolve();
    });

    expect(attachFavicon).toHaveBeenCalledTimes(2);
    expect(attachFavicon).toHaveBeenLastCalledWith(
      expect.any(HTMLImageElement),
      'https://example.com/docs',
      'example.com',
      {
        primaryUrl: '',
        pageSpecificUrl: 'data:image/png;base64,aGlnaC1yZXM=',
        skipPersisted: true,
        sourceProfile: 'shortcut'
      }
    );
  });

  it('uses a cached page-specific icon without acquiring a new one', () => {
    const attachFavicon = vi.fn();
    const resolveShortcutFaviconDataUrl = vi.fn(() => Promise.resolve(''));
    const developerConsoleUrl =
      'https://chrome.google.com/webstore/devconsole/example?hl=zh-cn';
    const { view } = createView({
      attachFaviconWithFallbacks: attachFavicon,
      getShortcutFaviconDataUrl: () => 'data:image/png;base64,Y2FjaGVkLWhk',
      resolveShortcutFaviconDataUrl
    });
    renderItems(view, [site({
      id: 'docs',
      title: 'Docs',
      url: developerConsoleUrl
    })]);

    const image = queryHtmlTag(view.getTiles()[0], '.x-nt-shortcut-favicon', 'img');
    expect(image?.getAttribute('src')).toBeNull();
    expect(attachFavicon).toHaveBeenCalledWith(
      image,
      developerConsoleUrl,
      'example.com',
      {
        primaryUrl: '',
        pageSpecificUrl: 'data:image/png;base64,Y2FjaGVkLWhk',
        skipPersisted: true,
        sourceProfile: 'shortcut'
      }
    );
    expect(resolveShortcutFaviconDataUrl).not.toHaveBeenCalled();
  });

  it('keeps page-specific icons isolated for shortcuts on the same host', () => {
    const attachFavicon = vi.fn();
    const profileUrl = 'https://x.com/thsottiaux';
    const homeUrl = 'https://x.com/home';
    const profileIcon = 'data:image/jpeg;base64,dGlibw==';
    const homeIcon = 'data:image/png;base64,eA==';
    const { view } = createView({
      getHostFromUrl: () => 'x.com',
      getShortcutFaviconDataUrl: (url) =>
        url === profileUrl ? profileIcon : homeIcon,
      getShortcutFaviconCandidateUrl: () => '',
      attachFaviconWithFallbacks: attachFavicon
    });

    renderItems(view, [
      site({ id: 'profile', title: 'Tibo', url: profileUrl }),
      site({ id: 'home', title: 'X', url: homeUrl })
    ]);

    expect(attachFavicon).toHaveBeenCalledTimes(2);
    expect(attachFavicon).toHaveBeenCalledWith(
      expect.any(HTMLImageElement),
      profileUrl,
      'x.com',
      {
        primaryUrl: '',
        pageSpecificUrl: profileIcon,
        skipPersisted: true,
        sourceProfile: 'shortcut'
      }
    );
    expect(attachFavicon).toHaveBeenCalledWith(
      expect.any(HTMLImageElement),
      homeUrl,
      'x.com',
      {
        primaryUrl: '',
        pageSpecificUrl: homeIcon,
        skipPersisted: true,
        sourceProfile: 'shortcut'
      }
    );
  });

  it('preserves keyed tile nodes when legacy drag order is synchronized', () => {
    const { view, options } = createView();
    const first = site({
      id: 'first',
      title: 'First',
      url: 'https://first.example/'
    });
    const second = site({
      id: 'second',
      title: 'Second',
      url: 'https://second.example/'
    });
    renderItems(view, [first, second]);
    const firstTile = view.getTiles()[0];
    const secondTile = view.getTiles()[1];
    const grid = expectElement(options.grid);

    grid.insertBefore(secondTile, firstTile);
    renderItems(view, [second, first]);

    expect(view.getTiles()).toEqual([secondTile, firstTile]);
    expect(view.getTiles()[0].dataset.shortcutId).toBe('second');
    expect(view.getTiles()[1].dataset.shortcutId).toBe('first');
  });
  describe('groups', () => {
    const groups = [{ id: 'g0', title: '' }, { id: 'work', title: '工作' }];
    const items = [
      site({ id: 'a', title: 'A', url: 'https://a.example/', groupId: 'g0' }),
      site({ id: 'b', title: 'B', url: 'https://b.example/', groupId: 'work' }),
      site({ id: 'c', title: 'C', url: 'https://c.example/', groupId: 'work' })
    ];
    const childSummary = (grid: HTMLElement) => Array.from(grid.children).map((child) => (
      child.classList.contains('x-nt-shortcut-group-header')
        ? `#${child.getAttribute('data-shortcut-group-id')}`
        : child.getAttribute('data-shortcut-id') || 'add'
    ));

    it('renders each group title before its tiles in one grid', () => {
      const groupHeaders: HTMLElement[] = [];
      const { view, options } = createView({
        groupHeaders,
        getGroupPlaceholder: () => 'Add a title'
      });
      const grid = expectElement(options.grid);
      renderItems(view, items, { grouped: true, groups });

      expect(grid.getAttribute('data-shortcut-grouped')).toBe('true');
      expect(childSummary(grid)).toEqual(['#g0', 'a', '#work', 'b', 'c', 'add']);
      expect(groupHeaders.map((header) => header.dataset.shortcutGroupId)).toEqual(['g0', 'work']);
      expect(view.getTiles().map((tile) => tile.dataset.shortcutGroupId)).toEqual(['g0', 'work', 'work']);
      expect(groupHeaders[0].dataset.shortcutGroupUntitled).toBe('true');
      expect(groupHeaders[0].textContent).toContain('Add a title');
      expect(groupHeaders[1].querySelector('.x-nt-shortcut-group-title')?.textContent).toBe('工作');

      renderItems(view, items, { grouped: false, groups });
      expect(grid.hasAttribute('data-shortcut-grouped')).toBe(false);
      expect(childSummary(grid)).toEqual(['a', 'b', 'c', 'add']);
      expect(groupHeaders).toEqual([]);
    });

    it('gives an empty group a slot that adds to it and stands in for an empty last group\'s add tile', () => {
      const onGroupAdd = vi.fn();
      const { view, options } = createView({ onGroupAdd, getGroupEmptyLabel: () => 'Add site' });
      const grid = expectElement(options.grid);
      const withEmpty = [...groups, { id: 'empty', title: 'Empty' }];
      renderItems(view, items, { grouped: true, groups: withEmpty });

      expect(childSummary(grid)).toEqual(['#g0', 'a', '#work', 'b', 'c', '#empty', 'add', 'add']);
      const slot = getTag(grid, '.x-nt-shortcut-group-empty', 'button');
      expect(slot.dataset.shortcutGroupId).toBe('empty');
      expect(slot.getAttribute('aria-label')).toBe('Add site');
      expect(view.getAddButton()?.hidden).toBe(true);
      act(() => { slot.click(); });
      expect(onGroupAdd).toHaveBeenCalledWith('empty', slot);

      renderItems(view, items, { grouped: true, groups: [withEmpty[0], withEmpty[2], withEmpty[1]] });
      expect(view.getAddButton()?.hidden).toBe(false);
      expect(grid.querySelectorAll('.x-nt-shortcut-group-empty')).toHaveLength(1);
    });

    it('hugs the longest group row so short groups stay centered', () => {
      const { view, options } = createView({ maxShortcuts: 50 });
      const grid = expectElement(options.grid);
      const columns = () => grid.style.getPropertyValue('--x-nt-shortcut-grouped-columns');

      renderItems(view, items, { grouped: true, groups });
      // The last group's two sites and its add tile.
      expect(columns()).toBe('3');
      // An empty last group holds its slot instead of the add tile.
      renderItems(view, items, { grouped: true, groups: [...groups, { id: 'empty', title: 'Empty' }] });
      expect(columns()).toBe('2');
      renderItems(view, items, { grouped: false, groups });
      expect(columns()).toBe('');
    });

    it('fits the grouped grid to the longest row as a dragged tile joins or leaves it', () => {
      const { view, options } = createView({ maxShortcuts: 50 });
      const grid = expectElement(options.grid);
      const columns = () => grid.style.getPropertyValue('--x-nt-shortcut-grouped-columns');
      const others = [
        site({ id: 'd', title: 'D', url: 'https://d.example/', groupId: 'g0' }),
        site({ id: 'e', title: 'E', url: 'https://e.example/', groupId: 'g0' }),
        site({ id: 'f', title: 'F', url: 'https://f.example/', groupId: 'g0' })
      ];
      renderItems(view, [items[0], ...others, items[1], items[2]], { grouped: true, groups });
      expect(columns()).toBe('4');

      // The first group grows to five while the drag has not rendered.
      expect(view.fitGroupedColumns([items[0], ...others, { ...items[1], groupId: 'g0' }, items[2]], groups)).toBe(true);
      expect(columns()).toBe('5');
      // Leaving it again narrows the grid without waiting for the drop.
      expect(view.fitGroupedColumns([items[0], ...others, items[1], items[2]], groups)).toBe(true);
      expect(columns()).toBe('4');
      // A move that keeps the longest row's length changes nothing.
      expect(view.fitGroupedColumns([...others, items[1], { ...items[0], groupId: 'work' }, items[2]], groups)).toBe(false);
      expect(columns()).toBe('4');

      renderItems(view, items, { grouped: false, groups });
      expect(view.fitGroupedColumns(items, groups)).toBe(false);
      expect(columns()).toBe('');
    });

    it('keeps a tile node when it moves into another group', () => {
      const { view } = createView();
      renderItems(view, items, { grouped: true, groups });
      const tile = view.getTiles()[0];
      renderItems(view, [{ ...items[1] }, { ...items[0], groupId: 'work' }, items[2]], { grouped: true, groups });

      expect(view.getTiles()[1]).toBe(tile);
      expect(tile.dataset.shortcutGroupId).toBe('work');
    });

    it('opens the group menu from its button or a right click', () => {
      const onGroupMenu = vi.fn();
      const { view, options } = createView({ onGroupMenu, getGroupActionsLabel: (title) => `${title} actions` });
      renderItems(view, items, { grouped: true, groups });
      const header = getElement(required(options.grid, 'grid'), '[data-shortcut-group-id="work"]');
      const more = getTag(header, '.x-nt-shortcut-group-more', 'button');

      expect(more.getAttribute('aria-label')).toBe('工作 actions');
      act(() => { more.click(); });
      act(() => {
        header.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      });
      expect(onGroupMenu).toHaveBeenNthCalledWith(1, 'work', more);
      expect(onGroupMenu).toHaveBeenNthCalledWith(2, 'work', more);
    });

    it('asks to rename a group from a double-clicked title or an untitled group\'s placeholder', () => {
      const onGroupRename = vi.fn();
      const { view, options } = createView({ onGroupRename });
      const grid = expectElement(options.grid);
      renderItems(view, items, { grouped: true, groups });

      const title = getElement(grid, '[data-shortcut-group-id="work"] .x-nt-shortcut-group-title');
      act(() => { title.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
      expect(onGroupRename).toHaveBeenLastCalledWith('work', title);

      const placeholder = getTag(grid, '.x-nt-shortcut-group-title--placeholder', 'button');
      act(() => { placeholder.click(); });
      expect(onGroupRename).toHaveBeenLastCalledWith('g0', placeholder);
      expect(grid.querySelector('input')).toBeNull();
    });
  });
});
