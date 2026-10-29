import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBottomDockRuntime,
  createDockApi,
  DOCK_IDS,
  type DockRuntime
} from './dock';

const { createLayoutController, updateBottomDockLayout } = vi.hoisted(() => {
  const updateLayout = vi.fn();
  return {
    updateBottomDockLayout: updateLayout,
    createLayoutController: vi.fn((_options?: unknown) => ({ updateBottomDockLayout: updateLayout }))
  };
});
vi.mock('../layout', () => ({ createLayoutController }));

let runtimes: DockRuntime[] = [];

afterEach(() => {
  act(() => runtimes.forEach((runtime) => runtime.destroy()));
  runtimes = [];
  document.body.replaceChildren();
  vi.clearAllMocks();
});

describe('New Tab bottom dock React island', () => {
  it('owns the dock shell while preserving external sections and layout adapters', () => {
    const bookmarkSection = document.createElement('section');
    const recentSection = document.createElement('section');
    const holder: { value: DockRuntime | null } = { value: null };
    act(() => {
      holder.value = createBottomDockRuntime({
        bookmarkSection,
        constants: { mobileFlowBreakpointPx: 900 },
        documentObj: document,
        recentSection,
        windowObj: window
      });
      holder.value.mount(document.body);
    });
    const runtime = holder.value;
    if (!runtime) {
      throw new Error('Expected dock runtime');
    }
    runtimes.push(runtime);

    expect(createDockApi().implementation).toBe('react');
    expect(runtime.element.id).toBe(DOCK_IDS.bottomDock);
    expect(runtime.element.dataset.reactIsland).toBe('newtab-bottom-dock');
    expect(runtime.scroller.id).toBe(DOCK_IDS.scroller);
    expect(Array.from(runtime.scroller.children)).toEqual([
      bookmarkSection,
      runtime.sectionSafeCorridor,
      recentSection
    ]);
    expect(createLayoutController).toHaveBeenCalledWith(
      expect.objectContaining({
        bottomDock: runtime.element,
        sectionSafeCorridor: runtime.sectionSafeCorridor
      })
    );

    runtime.updateLayout({ stabilizeDockDensity: true });
    expect(updateBottomDockLayout).toHaveBeenCalledWith({ stabilizeDockDensity: true });
  });

  it('keeps the scroll subscription contract', () => {
    const listener = vi.fn();
    const holder: { value: DockRuntime | null } = { value: null };
    act(() => {
      holder.value = createBottomDockRuntime({
        bookmarkSection: document.createElement('section'),
        documentObj: document,
        recentSection: document.createElement('section'),
        windowObj: window
      });
    });
    const runtime = holder.value;
    if (!runtime) {
      throw new Error('Expected dock runtime');
    }
    runtimes.push(runtime);
    runtime.onScroll(listener);
    runtime.scroller.dispatchEvent(new Event('scroll'));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
