import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createCascadeMenu,
  type CascadeMenuHandlers,
  type CascadeMenuModel,
  type CascadeMenuView,
  type CascadeRowModel
} from './bookmark-cascade-view';
import { getElement, getTag, getTags } from '../../../tests/fakes/dom';
import { createViewStore } from '../../shared/react/view-store';

let view: CascadeMenuView | null = null;

afterEach(() => {
  if (view) {
    act(() => view?.destroy());
  }
  view = null;
  document.body.replaceChildren();
});

function createHandlers(overrides: Partial<CascadeMenuHandlers> = {}): CascadeMenuHandlers {
  return {
    onLevelElement: vi.fn(),
    onRowPointerEnter: vi.fn(),
    onRowPointerLeave: vi.fn(),
    onRowPointerDown: vi.fn(),
    onRowFocus: vi.fn(),
    onRowClick: vi.fn(),
    onRowAuxClick: vi.fn(),
    onRowKeyDown: vi.fn(),
    onRowContextMenu: vi.fn(),
    onCopyShow: vi.fn(),
    onCopyHide: vi.fn(),
    onCopyClick: vi.fn(),
    onSiteIconMount: vi.fn(),
    onSiteButtonMount: vi.fn(),
    onFolderIconMount: vi.fn(),
    onFolderIconOpenChange: vi.fn(),
    ...overrides
  };
}

function row(overrides: Partial<CascadeRowModel>): CascadeRowModel {
  return {
    key: 'id:1',
    isFolder: false,
    title: 'Row',
    bookmarkId: '1',
    parentId: '10',
    bookmarkIndex: '0',
    draggable: true,
    active: false,
    expanded: false,
    hoverSuppressed: false,
    contextMenuOpen: false,
    folderIconSuffix: '',
    iconUrl: '',
    iconMonochrome: false,
    iconAlt: 'Site',
    copyLabel: 'Copy link',
    ...overrides
  };
}

const folderRow = row({
  key: 'id:2',
  isFolder: true,
  title: 'Assets',
  bookmarkId: '2',
  folderIconSuffix: '2-cascade-0'
});
const siteRow = row({ key: 'id:3', title: 'Lumno', bookmarkId: '3', bookmarkIndex: '1' });

let levels = createViewStore<CascadeMenuModel>({ levels: [] });

function mount(handlers: CascadeMenuHandlers, rows: CascadeRowModel[] = [folderRow, siteRow]): CascadeMenuView {
  levels = createViewStore<CascadeMenuModel>({ levels: [] });
  const menu = createCascadeMenu(document, handlers, levels);
  document.body.appendChild(menu.element);
  view = menu;
  act(() => levels.setState({ levels: [{ key: 'level-0', levelIndex: 0, title: 'Design', emptyLabel: 'No content', rows }] }));
  return menu;
}

describe('New Tab React bookmark cascade view', () => {
  it('draws a level with folder and site rows from the model', () => {
    const handlers = createHandlers();
    const menu = mount(handlers);

    expect(menu.element.dataset.reactIsland).toBe('newtab-bookmark-cascade');
    expect(menu.element.getAttribute('role')).toBe('menu');
    const level = getElement(menu.element, '.x-nt-bookmark-cascade-level');
    expect(handlers.onLevelElement).toHaveBeenCalledWith('level-0', level);
    expect(level.dataset.menuSurfaceWidth).toBe('content');
    expect(level.querySelector('.x-nt-bookmark-cascade-title')?.textContent).toBe('Design');

    const [folder, site] = getTags(menu.element, '.x-nt-bookmark-cascade-item', 'button');
    expect(folder.dataset.bookmarkDropFolderId).toBe('2');
    expect(folder.getAttribute('aria-expanded')).toBe('false');
    expect(folder.querySelector('svg[data-folder-color-id="2"]')).not.toBeNull();
    expect(folder.querySelector('#x-nt-folder-filter-lower-base-2-cascade-0')).not.toBeNull();
    expect(site.dataset.bookmarkIndex).toBe('1');
    expect(getTag(menu.element, '.x-nt-bookmark-cascade-copy-trigger', 'button').dataset.tooltip).toBe('Copy link');
    expect(handlers.onFolderIconMount).toHaveBeenCalledTimes(1);
    expect(handlers.onSiteIconMount).toHaveBeenCalledWith(0, 'id:3', site.querySelector('img'));
    expect(handlers.onSiteButtonMount).toHaveBeenCalledWith(site, expect.any(Function));
  });

  it('shows row state and plays the folder icon when its row opens', () => {
    const handlers = createHandlers();
    const menu = mount(handlers);
    act(() => levels.setState({
      levels: [{
        key: 'level-0',
        levelIndex: 0,
        title: 'Design',
        emptyLabel: 'No content',
        rows: [{ ...folderRow, active: true, expanded: true }, { ...siteRow, hoverSuppressed: true }]
      }]
    }));

    const [folder, site] = getTags(menu.element, '.x-nt-bookmark-cascade-item', 'button');
    expect(folder.dataset.active).toBe('true');
    expect(folder.tabIndex).toBe(0);
    expect(folder.getAttribute('aria-expanded')).toBe('true');
    expect(site.dataset.hoverSuppressed).toBe('true');
    expect(site.tabIndex).toBe(-1);
    expect(handlers.onFolderIconOpenChange).toHaveBeenCalledWith(folder.querySelector('span'), true);
  });

  it('hands row events to the controller with the level, row key and button', () => {
    const handlers = createHandlers();
    const menu = mount(handlers);
    const site = getTags(menu.element, '.x-nt-bookmark-cascade-item', 'button')[1];
    act(() => site.click());
    expect(handlers.onRowClick).toHaveBeenCalledWith(0, 'id:3', expect.any(MouseEvent), site);

    const copy = getTag(menu.element, '.x-nt-bookmark-cascade-copy-trigger', 'button');
    act(() => copy.click());
    expect(handlers.onCopyClick).toHaveBeenCalledWith(0, 'id:3', expect.any(MouseEvent), copy);
    expect(handlers.onRowClick).toHaveBeenCalledTimes(1);
  });

  it('says so when a folder is empty', () => {
    const menu = mount(createHandlers(), []);
    expect(menu.element.querySelector('.x-nt-bookmark-cascade-empty')?.textContent).toBe('No content');
  });
});
