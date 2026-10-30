import { describe, expect, it, vi } from 'vitest';
import { createBackgroundFocusHandler, shouldFocusSearchFromPointer, type BackgroundPointerEvent } from './background-search-focus';

const body = document.createElement('body');
const root = document.createElement('div');
const searchLayer = document.createElement('div');
const backgroundTargets = [body, root, searchLayer];

function pointerEvent(target: EventTarget, defaultPrevented = false): BackgroundPointerEvent {
  return { type: 'pointerdown', target, defaultPrevented, preventDefault() {} };
}

function mouseDownEvent(target: EventTarget) {
  const event = { type: 'mousedown', target, defaultPrevented: false, preventDefault: () => { event.defaultPrevented = true; } };
  return event;
}

describe('background search focus', () => {
  it('focuses the search from the page background, the exposed search shell and its layer', () => {
    backgroundTargets.forEach((target) => expect(shouldFocusSearchFromPointer(pointerEvent(target), backgroundTargets)).toBe(true));
  });

  it.each(['bookmark card', 'bookmark breadcrumb', 'bookmark pager', 'bookmark cascade menu', 'recent site card',
    'shortcut tile', 'mode menu', 'wallpaper control', 'feedback control', 'dialog'])('leaves focus alone on a %s', (name) => {
    const component = document.createElement('div');
    component.title = name;
    expect(shouldFocusSearchFromPointer(pointerEvent(component), backgroundTargets)).toBe(false);
  });

  it('ignores a handled press and a missing one', () => {
    expect(shouldFocusSearchFromPointer(pointerEvent(body, true), backgroundTargets)).toBe(false);
    expect(shouldFocusSearchFromPointer(null, backgroundTargets)).toBe(false);
  });

  it('focuses an empty search and dismisses the results of one with input, whitespace included', () => {
    let searchValue = '';
    const focusSearch = vi.fn();
    const dismissSearchResults = vi.fn();
    const handle = createBackgroundFocusHandler({
      getBackgroundTargets: () => backgroundTargets,
      getSearchValue: () => searchValue,
      dismissSearchResults,
      focusSearch
    });

    expect(handle(pointerEvent(body))).toBe(true);
    expect([focusSearch.mock.calls.length, dismissSearchResults.mock.calls.length]).toEqual([1, 0]);
    searchValue = 'lumno';
    expect(handle(pointerEvent(searchLayer))).toBe(true);
    expect([focusSearch.mock.calls.length, dismissSearchResults.mock.calls.length]).toEqual([1, 1]);
    searchValue = ' ';
    expect(handle(pointerEvent(root))).toBe(true);
    expect([focusSearch.mock.calls.length, dismissSearchResults.mock.calls.length]).toEqual([1, 2]);
    expect(handle(pointerEvent(document.createElement('div')))).toBe(false);
    expect([focusSearch.mock.calls.length, dismissSearchResults.mock.calls.length]).toEqual([1, 2]);
  });

  it('cancels only the mousedown right after a focusing press, so it does not blur the search again', () => {
    let searchValue = '';
    const handle = createBackgroundFocusHandler({
      getBackgroundTargets: () => backgroundTargets,
      getSearchValue: () => searchValue,
      dismissSearchResults() {},
      focusSearch() {}
    });

    handle(pointerEvent(body));
    const following = mouseDownEvent(body);
    expect(handle(following)).toBe(true);
    expect(following.defaultPrevented).toBe(true);
    const later = mouseDownEvent(body);
    expect(handle(later)).toBe(false);
    expect(later.defaultPrevented).toBe(false);

    searchValue = 'lumno';
    handle(pointerEvent(body));
    const dismissing = mouseDownEvent(body);
    expect(handle(dismissing)).toBe(false);
    expect(dismissing.defaultPrevented).toBe(false);
  });
});
