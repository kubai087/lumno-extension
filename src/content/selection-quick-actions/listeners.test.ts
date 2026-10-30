import { describe, expect, it, vi } from 'vitest';
import { expectElement, getElementById, required } from '../../../tests/fakes/dom';
import { ENABLED_KEY, HOST_ID, LANGUAGE_KEY, bootSelectionToolbar, flush } from '../../../tests/fakes/selection-toolbar-page';
import type { SelectionToolbarPage } from '../../../tests/fakes/selection-toolbar-page';

const PAGE_LISTENERS = [
  'document:copy:capture',
  'document:keydown:capture',
  'document:pointercancel:capture',
  'document:pointerdown:capture',
  'document:pointerup:capture',
  'document:scroll:capture',
  'document:selectionchange:capture',
  'document:selectstart:capture',
  'visualViewport:resize:bubble',
  'visualViewport:scroll:bubble',
  'window:blur:capture',
  'window:orientationchange:capture',
  'window:resize:capture'
];

type ListenerOptions = boolean | AddEventListenerOptions | EventListenerOptions | undefined;

// Counts the listeners added to and removed from each target, by type and phase.
function trackListeners(targets: Record<string, EventTarget>): { keys(): string[]; counts(): number[] } {
  const registry = new Map<string, number>();
  const keyOf = (label: string, type: string, options: ListenerOptions) => {
    const capture = typeof options === 'boolean' ? options : Boolean(options && options.capture);
    return `${label}:${type}:${capture ? 'capture' : 'bubble'}`;
  };
  Object.entries(targets).forEach(([label, target]) => {
    const add = target.addEventListener.bind(target);
    const remove = target.removeEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation((type: string, listener: EventListenerOrEventListenerObject | null, options?: ListenerOptions) => {
      const key = keyOf(label, type, options);
      registry.set(key, (registry.get(key) || 0) + 1);
      add(type, listener, options);
    });
    vi.spyOn(target, 'removeEventListener').mockImplementation((type: string, listener: EventListenerOrEventListenerObject | null, options?: ListenerOptions) => {
      const key = keyOf(label, type, options);
      const count = (registry.get(key) || 0) - 1;
      if (count > 0) registry.set(key, count);
      else registry.delete(key);
      remove(type, listener, options);
    });
  });
  return { keys: () => Array.from(registry.keys()).sort(), counts: () => Array.from(registry.values()) };
}

function countObservers(): () => number {
  let active = 0;
  const Native = MutationObserver;
  vi.stubGlobal('MutationObserver', class extends Native {
    counted = false;
    observe(target: Node, options?: MutationObserverInit) {
      if (!this.counted) {
        this.counted = true;
        active += 1;
      }
      super.observe(target, options);
    }
    disconnect() {
      if (this.counted) {
        this.counted = false;
        active -= 1;
      }
      super.disconnect();
    }
  });
  return () => active;
}

async function bootDisabled() {
  const observers = countObservers();
  const listeners = trackListeners({ document, window });
  const page = await bootSelectionToolbar({ sync: { [ENABLED_KEY]: false }, visualViewport: true });
  const viewport = required(page.visualViewport, 'visual viewport');
  const viewportListeners = trackListeners({ visualViewport: viewport });
  const keys = () => listeners.keys().concat(viewportListeners.keys()).sort();
  const counts = () => listeners.counts().concat(viewportListeners.counts());
  return { page, observers, keys, counts, viewport };
}

async function selectTerm(page: SelectionToolbarPage): Promise<HTMLElement | null> {
  await page.selectText(getElementById('copy'));
  const host = document.getElementById(HOST_ID);
  return host instanceof HTMLElement ? host : null;
}

describe('selection toolbar page listeners', () => {
  it('does not listen to or observe the page while the feature is off', async () => {
    const { page, observers, keys } = await bootDisabled();
    expect(keys()).toEqual([]);
    expect(observers()).toBe(0);
    expect(await selectTerm(page)).toBeNull();
  });

  it('turns on only for an explicit true', async () => {
    const { page, keys } = await bootDisabled();
    page.storageChange({ [ENABLED_KEY]: 'true' });
    expect(keys()).toEqual([]);
  });

  it('attaches each page listener once and starts watching for other hosts when turned on', async () => {
    const { page, observers, keys, counts } = await bootDisabled();
    page.storageChange({ [ENABLED_KEY]: true });
    expect(keys()).toEqual(PAGE_LISTENERS);
    expect(counts().every((count) => count === 1)).toBe(true);
    expect(observers()).toBe(1);

    page.storageChange({ [LANGUAGE_KEY]: 'en' });
    await flush(10);
    expect(counts().every((count) => count === 1)).toBe(true);
    expect(observers()).toBe(1);
  });

  it('dismisses the entry on scroll and on Escape', async () => {
    const { page } = await bootDisabled();
    page.storageChange({ [ENABLED_KEY]: true });
    const host = expectElement(await selectTerm(page), 'toolbar host');
    expect(host.hidden).toBe(false);
    document.dispatchEvent(new Event('scroll'));
    expect(host.hidden).toBe(true);

    await selectTerm(page);
    expect(host.hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(host.hidden).toBe(true);
  });

  it('re-clamps the toolbar when the visual viewport resizes', async () => {
    const { page, viewport } = await bootDisabled();
    page.storageChange({ [ENABLED_KEY]: true });
    await selectTerm(page);
    viewport.width = 300;
    viewport.dispatchEvent(new Event('resize'));
    await flush(30);
    expect(expectElement(page.query('.lumno-selection-surface'), 'surface').style.maxWidth).toBe('276px');
  });

  it('detaches everything when turned off and comes back when turned on again', async () => {
    const { page, observers, keys } = await bootDisabled();
    page.storageChange({ [ENABLED_KEY]: true });
    await selectTerm(page);
    page.storageChange({ [ENABLED_KEY]: false });
    expect(keys()).toEqual([]);
    expect(observers()).toBe(0);
    expect(document.getElementById(HOST_ID)).toBeNull();
    expect(await selectTerm(page)).toBeNull();

    page.storageChange({ [ENABLED_KEY]: true });
    expect(keys()).toEqual(PAGE_LISTENERS);
    const host = await selectTerm(page);
    expect(host?.hidden).toBe(false);
  });
});
