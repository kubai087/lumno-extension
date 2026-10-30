import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBookmarkHeaderModel } from './bookmark-header.fixtures';
import {
  createPageStructure,
  type PageStructureRuntime
} from './page-structure';
import { getElement, getTag, getTags } from '../../../tests/fakes/dom';

let runtime: PageStructureRuntime | null = null;

afterEach(() => {
  if (runtime) {
    act(() => runtime?.destroy());
  }
  runtime = null;
  document.body.replaceChildren();
});

function mount(): PageStructureRuntime {
  act(() => {
    runtime = createPageStructure({ documentObj: document });
  });
  if (!runtime) {
    throw new Error('Expected page structure runtime');
  }
  document.body.append(runtime.bookmark.section, runtime.recent.section);
  return runtime;
}

describe('New Tab React page structure', () => {
  it('creates stable hosts and refs for the page adapters', () => {
    const page = mount();

    expect(page.shortcut.section.dataset.reactIsland).toBe('newtab-shortcut-section');
    expect(page.shortcut.grid.className).toBe('x-nt-shortcuts-grid');
    expect(page.bookmark.titleWrap.parentElement?.className).toBe('x-nt-bookmarks-header');
    expect(page.bookmark.previousButton.parentElement).toBe(page.bookmark.pager);
    expect(page.bookmark.grid.parentElement).toBe(page.bookmark.section);
    expect(page.recent.grid.parentElement).toBe(page.recent.section);
    expect(page.suggestions.container.dataset.visible).toBe('false');
    expect(page.searchLayer.dataset.reactIsland).toBe('newtab-search-layer');
  });

  it('draws the bookmark header from its model', () => {
    const page = mount();
    const model = createBookmarkHeaderModel({ onPage: vi.fn(), onOpenManager: vi.fn(), showTooltip: vi.fn() });
    act(() => page.bookmark.headerStore.setState({ model }));

    const heading = getElement(page.bookmark.titleWrap, '.x-nt-bookmarks-heading');
    expect(heading.textContent).toBe('Bookmarks');
    expect(heading.getAttribute('role')).toBeNull();
    expect(heading.dataset.bookmarkDropFolderId).toBe('1');
    expect(getElement(page.bookmark.titleWrap, '.x-nt-bookmarks-breadcrumb').style.display).toBe('none');

    const buttons = getTags(page.bookmark.pager, '.x-nt-bookmarks-pager-btn', 'button');
    expect(buttons.map((button) => button.dataset.tooltip)).toEqual(['Previous page', 'Next page', 'Open bookmark manager']);
    expect(buttons.every((button) => !button.hasAttribute('title') && !button.disabled)).toBe(true);
    expect(buttons.map((button) => button.getAttribute('aria-disabled'))).toEqual(['true', 'false', 'false']);
    expect(buttons[2].dataset.browserOnly).toBe('chromium');
    expect(page.bookmark.pager.lastElementChild?.id).toBe('bookmark-mode');

    act(() => buttons[0].click());
    act(() => buttons[1].click());
    act(() => buttons[2].click());
    expect(model.onPage).toHaveBeenCalledTimes(1);
    expect(model.onPage).toHaveBeenCalledWith(1);
    expect(model.onOpenManager).toHaveBeenCalledTimes(1);

    buttons[1].dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    expect(model.showTooltip).toHaveBeenCalledWith(buttons[1], 'Next page', 'top');
  });

  it('turns the heading into a way back to the root inside a folder', () => {
    const page = mount();
    const model = createBookmarkHeaderModel({
      crumbs: [{ id: '5', title: 'Work' }, { id: '9', title: 'Docs' }],
      onNavigate: vi.fn()
    });
    act(() => page.bookmark.headerStore.setState({ model }));

    const heading = getElement(page.bookmark.titleWrap, '.x-nt-bookmarks-heading');
    expect(heading.classList.contains('x-nt-bookmarks-heading--link')).toBe(true);
    expect(heading.getAttribute('role')).toBe('button');
    act(() => heading.click());
    act(() => {
      heading.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    });
    expect(model.onNavigate).toHaveBeenCalledTimes(2);
    expect(model.onNavigate).toHaveBeenCalledWith('1');

    const crumbs = getTags(page.bookmark.titleWrap, '.x-nt-bookmarks-crumb', 'button');
    expect(crumbs.map((crumb) => crumb.textContent)).toEqual(['Work', 'Docs']);
    expect(crumbs.map((crumb) => crumb.disabled)).toEqual([false, true]);
    expect(crumbs[0].dataset.bookmarkDropFolderId).toBe('5');
    act(() => crumbs[0].click());
    expect(model.onNavigate).toHaveBeenLastCalledWith('5');
  });

  it('leaves the actions to the top bar while it holds the bookmarks', () => {
    const page = mount();
    act(() => page.bookmark.headerStore.setState({ model: createBookmarkHeaderModel({ actionsInTopbar: true }) }));

    expect(getTags(page.bookmark.pager, '.x-nt-bookmarks-pager-btn', 'button')).toHaveLength(2);
    expect(page.bookmark.pager.querySelector('#bookmark-mode')).toBeNull();
  });

  it('gives a pager button that turns unavailable up from focus', () => {
    const page = mount();
    const model = createBookmarkHeaderModel({ hideTooltip: vi.fn() });
    act(() => page.bookmark.headerStore.setState({ model }));
    const next = getTags(page.bookmark.pager, '.x-nt-bookmarks-pager-btn', 'button')[1];
    next.focus();
    expect(document.activeElement).toBe(next);

    act(() => page.bookmark.headerStore.setState({ model: { ...model, next: { label: 'Next page', enabled: false } } }));
    expect(document.activeElement).not.toBe(next);
    expect(next.tabIndex).toBe(-1);
    expect(model.hideTooltip).toHaveBeenCalled();
  });

  it('draws the recent heading, or the mode switch in its place', () => {
    const page = mount();
    act(() => page.recent.headerStore.setState({ heading: 'Recent visits', modeSwitch: null }));
    const heading = getElement(page.recent.header, '.x-nt-recent-heading');
    expect(heading.textContent).toBe('Recent visits');
    expect(heading.hidden).toBe(false);

    act(() => page.recent.headerStore.setState({
      heading: 'Recent visits',
      modeSwitch: {
        title: 'Display mode',
        value: 'latest',
        options: [{ value: 'latest', label: 'Recent visits' }, { value: 'most', label: 'Most visited' }],
        onChange: vi.fn()
      }
    }));
    expect(heading.hidden).toBe(true);
    expect(getTag(page.recent.header, '.x-nt-recent-mode-switch', 'div').getAttribute('role')).toBe('radiogroup');
  });
});
