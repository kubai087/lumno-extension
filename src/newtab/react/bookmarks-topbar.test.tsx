import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRenderStore } from '../../shared/react/render-store';
import type { BookmarkHeaderModel } from './bookmark-header';
import { createBookmarkHeaderModel } from './bookmark-header.fixtures';
import {
  createBookmarksTopbar,
  getSurfaceColorTokens,
  normalizeLayout,
  normalizeSurfaceMode,
  normalizeSurfaceColor,
  type BookmarksTopbarRuntime
} from './bookmarks-topbar';
import { getTag } from '../../../tests/react/dom';

let runtime: BookmarksTopbarRuntime | null = null;

afterEach(() => {
  if (runtime) {
    act(() => runtime?.destroy());
  }
  runtime = null;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('New Tab React bookmarks topbar', () => {
  it('holds the bookmark grid while active and shows the header actions', () => {
    const section = document.createElement('section');
    const header = document.createElement('div');
    const grid = document.createElement('div');
    section.append(header, grid);
    document.body.appendChild(section);
    const onVisibilityChange = vi.fn();
    const headerStore = createRenderStore<BookmarkHeaderModel | null>(null);
    act(() => {
      runtime = createBookmarksTopbar({
        documentObj: document,
        windowObj: window,
        grid,
        headerStore,
        onVisibilityChange
      });
      runtime.mount(document.body);
    });
    if (!runtime) {
      throw new Error('Expected bookmarks topbar runtime');
    }

    expect(runtime.element.dataset.reactIsland).toBe(
      'newtab-bookmarks-topbar'
    );
    expect(runtime.activate()).toBe(true);
    expect(runtime.itemsHost.firstElementChild).toBe(grid);
    expect(runtime.actions.children).toHaveLength(0);
    const showTooltip = vi.fn();
    act(() => headerStore.render(createBookmarkHeaderModel({ actionsInTopbar: true, showTooltip })));
    const manager = getTag(runtime.actions, '.x-nt-bookmarks-pager-btn', 'button');
    expect(manager.dataset.tooltip).toBe('Open bookmark manager');
    expect(runtime.actions.querySelector('#bookmark-mode')).not.toBeNull();
    manager.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    expect(showTooltip).toHaveBeenCalledWith(manager, 'Open bookmark manager', 'bottom');
    expect(runtime.setVisible(true)).toBe(true);
    expect(onVisibilityChange).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ height: 36 })
    );
    act(() => headerStore.render(createBookmarkHeaderModel({ actionsInTopbar: false })));
    expect(runtime.actions.children).toHaveLength(0);
    expect(runtime.deactivate()).toBe(true);
    expect(Array.from(section.children)).toEqual([header, grid]);
  });

  it('keeps surface color and overflow behavior', () => {
    act(() => {
      runtime = createBookmarksTopbar({
        documentObj: document,
        windowObj: window
      });
    });
    if (!runtime) {
      throw new Error('Expected bookmarks topbar runtime');
    }
    expect(normalizeSurfaceColor('#EdF4Fe')).toBe('#edf4fe');
    expect(normalizeSurfaceColor('#abc')).toBe('#aabbcc');
    expect(getSurfaceColorTokens('#111827')?.ink).toBe('#f8fafc');
    expect(normalizeSurfaceMode('clear')).toBe('clear');
    expect(normalizeSurfaceMode('transparent')).toBe('transparent');
    expect(runtime.setSurfaceMode('transparent')).toBe('transparent');
    expect(runtime.element.dataset.surfaceMode).toBe('transparent');
    expect(runtime.element.dataset.layout).toBe('docked');
    expect(normalizeLayout('floating')).toBe('floating');
    expect(normalizeLayout('sideways')).toBe('docked');
    expect(runtime.setLayout('floating')).toBe('floating');
    expect(runtime.element.dataset.layout).toBe('floating');
    expect(runtime.setLayout(undefined)).toBe('docked');
    expect(runtime.setSurfaceColor('#edf4fe')).toBe('#edf4fe');
    expect(
      runtime.element.style.getPropertyValue(
        '--x-nt-bookmarks-topbar-surface'
      )
    ).toBe('#edf4fe');

    Object.defineProperties(runtime.viewport, {
      clientWidth: { configurable: true, value: 100 },
      scrollWidth: { configurable: true, value: 500 }
    });
    runtime.activate();
    runtime.setVisible(true);
    expect(runtime.syncOverflowFade()).toBe(true);
    expect(runtime.edgeFade.dataset.visible).toBe('true');
    // Both ends report overflow, so the viewport can fade whichever side runs past the bar.
    expect(runtime.viewport.dataset.overflowEnd).toBe('true');
    expect(runtime.viewport.dataset.overflowStart).toBe('false');
    runtime.viewport.scrollLeft = 400;
    runtime.syncOverflowFade();
    expect(runtime.viewport.dataset.overflowStart).toBe('true');
    expect(runtime.viewport.dataset.overflowEnd).toBe('false');
  });

  it('keeps horizontal wheel gestures native and batches vertical wheel input', () => {
    const animationFrames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const frameId = nextFrameId;
      nextFrameId += 1;
      animationFrames.set(frameId, callback);
      return frameId;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frameId) => {
      animationFrames.delete(frameId);
    });
    const flushAnimationFrames = () => {
      while (animationFrames.size > 0) {
        const pendingFrames = Array.from(animationFrames.entries());
        animationFrames.clear();
        pendingFrames.forEach(([, callback]) => callback(0));
      }
    };

    act(() => {
      runtime = createBookmarksTopbar({
        documentObj: document,
        windowObj: window
      });
    });
    if (!runtime) {
      throw new Error('Expected bookmarks topbar runtime');
    }
    Object.defineProperties(runtime.viewport, {
      clientWidth: { configurable: true, value: 100 },
      scrollWidth: { configurable: true, value: 500 }
    });
    runtime.activate();
    runtime.setVisible(true);
    flushAnimationFrames();

    const horizontalWheel = new WheelEvent('wheel', {
      cancelable: true,
      deltaX: 48,
      deltaY: 4
    });
    runtime.viewport.dispatchEvent(horizontalWheel);
    expect(horizontalWheel.defaultPrevented).toBe(false);
    expect(runtime.viewport.scrollLeft).toBe(0);
    expect(animationFrames.size).toBe(0);

    runtime.viewport.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 24 })
    );
    runtime.viewport.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 36 })
    );
    expect(runtime.viewport.scrollLeft).toBe(0);
    expect(animationFrames.size).toBe(1);

    flushAnimationFrames();
    expect(runtime.viewport.scrollLeft).toBe(60);
  });
});
