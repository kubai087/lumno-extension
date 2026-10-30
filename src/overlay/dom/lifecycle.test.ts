import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAntiTranslateGuard,
  createChromeEventListenerRegistry,
  createMountConnectionGuard,
  createSessionCleanupRegistry,
  createViewportSizeSync,
  onSessionDestroyRequest,
  requestSessionDestroy
} from './lifecycle';

// MutationObserver callbacks run as microtasks; a few passes deliver them
// and what they schedule at once.
async function flushObservers(): Promise<void> {
  for (let pass = 0; pass < 4; pass += 1) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Chrome event listener registry', () => {
  it('adds each listener once and removes what it added', () => {
    const active = new Set<() => void>();
    const registry = createChromeEventListenerRegistry<() => void>({
      addListener: (listener) => active.add(listener),
      removeListener: (listener) => active.delete(listener)
    });
    const first = () => {};
    const second = () => {};

    expect(registry.add(first)).toBe(first);
    expect(registry.add(first)).toBe(first);
    expect(registry.add(second)).toBe(second);
    expect(registry.size).toBe(2);
    expect(active.size).toBe(2);
    expect(registry.remove(first)).toBe(true);
    expect(registry.remove(first)).toBe(false);
    expect(registry.size).toBe(1);
    expect(active.has(first)).toBe(false);

    registry.clear();
    expect(registry.size).toBe(0);
    expect(active.size).toBe(0);
  });

  it('ignores what is not a listener', () => {
    const registry = createChromeEventListenerRegistry<() => void>({ addListener() {}, removeListener() {} });
    expect(registry.add(Reflect.get({}, 'missing'))).toBeNull();
    expect(registry.size).toBe(0);
  });

  it('adds nothing without an event to listen to', () => {
    const registry = createChromeEventListenerRegistry<() => void>(null);
    expect(registry.add(() => {})).toBeNull();
    expect(registry.size).toBe(0);
  });
});

describe('Session cleanup registry', () => {
  it('runs its steps newest first and once, past a step that fails', () => {
    const registry = createSessionCleanupRegistry();
    const order: string[] = [];
    registry.add(() => order.push('first'));
    registry.add(() => {
      order.push('failing');
      throw new Error('teardown failed');
    });
    registry.add(() => order.push('last'));
    expect(registry.add(Reflect.get({}, 'missing'))).toBeUndefined();
    expect(registry.size).toBe(3);

    registry.run();
    expect(order).toEqual(['last', 'failing', 'first']);
    expect(registry.size).toBe(0);
    registry.run();
    expect(order).toEqual(['last', 'failing', 'first']);
  });
});

describe('Session destroy requests', () => {
  it('reach an earlier session through its host, which answers once', () => {
    const host = document.createElement('div');
    document.documentElement.appendChild(host);
    const calls: unknown[] = [];
    onSessionDestroyRequest(host, (options) => {
      calls.push(options);
      host.remove();
    });

    expect(requestSessionDestroy(host, { preserveLoadingIntent: true })).toBe(true);
    expect(calls).toEqual([{ preserveLoadingIntent: true, animateExit: false }]);

    document.documentElement.appendChild(host);
    expect(requestSessionDestroy(host)).toBe(false);
    expect(calls).toHaveLength(1);
    host.remove();
  });

  it('keep a session listening while it animates out, until a plain request ends it', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const requests: unknown[] = [];
    onSessionDestroyRequest(host, (options) => requests.push(options));

    expect(requestSessionDestroy(host, { animateExit: true })).toBe(false);
    expect(requests).toEqual([{ preserveLoadingIntent: false, animateExit: true }]);
    requestSessionDestroy(host, { preserveLoadingIntent: true });
    expect(requests[1]).toEqual({ preserveLoadingIntent: true, animateExit: false });
    requestSessionDestroy(host);
    expect(requests).toHaveLength(2);
  });

  it('go unanswered once the session unbinds, so the caller falls back', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const destroy = vi.fn();
    const unbind = onSessionDestroyRequest(host, destroy);
    unbind();

    expect(requestSessionDestroy(host, { preserveLoadingIntent: false })).toBe(false);
    expect(destroy).not.toHaveBeenCalled();
  });

  it('carry their options as a plain string, which crosses isolated worlds', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const details: unknown[] = [];
    host.addEventListener('_x_extension_overlay_session_destroy_2026_unique_', (event) => {
      details.push(Reflect.get(event, 'detail'));
    });
    requestSessionDestroy(host, { preserveLoadingIntent: true });
    requestSessionDestroy(host, { animateExit: true });
    requestSessionDestroy(host);
    expect(details).toEqual(['preserve-loading-intent', 'animate-exit', '']);
  });

  it('do nothing without a host', () => {
    expect(requestSessionDestroy(null)).toBe(false);
    expect(typeof onSessionDestroyRequest(null, () => {})).toBe('function');
  });
});

describe('Anti-translate guard', () => {
  function startGuard() {
    const root = document.body.appendChild(document.createElement('div'));
    const applyNoTranslateDeep = vi.fn();
    const guard = createAntiTranslateGuard(window, { applyNoTranslateDeep });
    guard.start(root);
    // What the guard marked after the page added `node` under the root.
    const marks = async (node: Element) => {
      applyNoTranslateDeep.mockClear();
      root.appendChild(node);
      await flushObservers();
      vi.advanceTimersByTime(0);
      return applyNoTranslateDeep.mock.calls.some(([marked]) => marked === node);
    };
    return { root, guard, applyNoTranslateDeep, marks };
  }

  it('marks what is added under the panel', async () => {
    const { guard, marks } = startGuard();
    expect(await marks(document.createElement('span'))).toBe(true);
    guard.stop();
  });

  it('pauses briefly for an owned burst of changes, from the latest burst', async () => {
    const { guard, marks } = startGuard();

    guard.pauseForMutationBurst();
    vi.advanceTimersByTime(100);
    guard.pauseForMutationBurst();
    vi.advanceTimersByTime(100);
    expect(await marks(document.createElement('span'))).toBe(false);

    vi.advanceTimersByTime(80);
    expect(await marks(document.createElement('span'))).toBe(true);
    guard.stop();
  });

  it('backs off when the page changes too much, and a burst does not cut the backoff short', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { root, guard, applyNoTranslateDeep, marks } = startGuard();

    Array.from({ length: 121 }, () => root.appendChild(document.createElement('i')));
    await flushObservers();
    expect(warn).toHaveBeenCalledTimes(1);

    guard.pauseForMutationBurst();
    vi.advanceTimersByTime(200);
    expect(await marks(document.createElement('span'))).toBe(false);

    applyNoTranslateDeep.mockClear();
    vi.advanceTimersByTime(700);
    expect(applyNoTranslateDeep).toHaveBeenCalledTimes(1);
    expect(applyNoTranslateDeep).toHaveBeenCalledWith(root);
    expect(await marks(document.createElement('span'))).toBe(true);
    guard.stop();
  });
});

describe('Mount connection guard', () => {
  it('puts the host back when the page removes it, and leaves it out once stopped', async () => {
    const host = document.documentElement.appendChild(document.createElement('div'));
    const onRestore = vi.fn((restored: HTMLElement, parent: Element) => {
      expect(restored.parentNode).toBe(parent);
    });
    const guard = createMountConnectionGuard(window, { onRestore });
    guard.start(host);

    host.remove();
    await flushObservers();
    vi.advanceTimersByTime(0);
    expect(host.parentNode).toBe(document.documentElement);
    expect(host.isConnected).toBe(true);
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledWith(host, document.documentElement);

    guard.stop();
    host.remove();
    window.dispatchEvent(new Event('fullscreenchange'));
    await flushObservers();
    vi.advanceTimersByTime(100);
    expect(host.isConnected).toBe(false);
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it('moves the same host into a new document root that replaced the old one', async () => {
    const original = document.documentElement;
    const host = original.appendChild(document.createElement('div'));
    const onRestore = vi.fn();
    const guard = createMountConnectionGuard(window, { onRestore });
    guard.start(host);
    const replacement = document.createElement('html');
    try {
      document.replaceChild(replacement, original);
      await flushObservers();
      vi.advanceTimersByTime(0);
      expect(host.parentNode).toBe(replacement);
      expect(host.isConnected).toBe(true);
      expect(onRestore).toHaveBeenCalledWith(host, replacement);
    } finally {
      guard.stop();
      host.remove();
      document.replaceChild(original, replacement);
    }
  });
});

describe('Viewport size sync', () => {
  interface Viewport {
    width: number;
    height: number;
    scale: number;
    offsetLeft: number;
    offsetTop: number;
  }

  // A 1200×800 window whose visual viewport the test sets, as pinch zoom
  // does; JSDOM has no visual viewport of its own.
  function createViewport(visual: Partial<Viewport> = {}) {
    const target = Object.assign(new EventTarget(), { width: 1200, height: 800, scale: 1, offsetLeft: 0, offsetTop: 0 }, visual);
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1200);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: target });
    return target;
  }

  function startSync(tabZoomFactor: number) {
    const overlay = document.body.appendChild(document.createElement('div'));
    const sync = createViewportSizeSync(window, {
      getSizePreset: () => ({ width: 760, maxHeightVh: 75, uiScale: 1 }),
      getRequestedTabZoomFactor: () => tabZoomFactor
    });
    sync.start(overlay);
    return { overlay, sync };
  }

  const place = (overlay: HTMLElement) => ({
    left: overlay.style.getPropertyValue('left'),
    top: overlay.style.getPropertyValue('top'),
    scale: overlay.style.getPropertyValue('--x-ov-visible-scale')
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'visualViewport');
  });

  it.each([0.8, 1.25, 1.5])('keeps the panel centred at its 20vh anchor and undoes a %s tab zoom', (tabZoomFactor) => {
    createViewport();
    const { overlay, sync } = startSync(tabZoomFactor);
    expect(overlay.style.getPropertyValue('left')).toBe('600px');
    expect(overlay.style.getPropertyValue('top')).toBe('160px');
    expect(Number(overlay.style.getPropertyValue('--x-ov-visible-scale'))).toBe(1 / tabZoomFactor);
    sync.stop();
  });

  it('undoes tab zoom and pinch zoom together without moving the anchor in a shifted viewport', () => {
    createViewport({ width: 600, height: 400, scale: 2, offsetLeft: 120, offsetTop: 40 });
    const { overlay, sync } = startSync(1.25);
    expect(place(overlay)).toEqual({ left: '420px', top: '120px', scale: '0.4' });
    sync.stop();
  });

  it('undoes pinch zoom without CSS zoom and keeps the panel as wide as the zoomed-out viewport', () => {
    createViewport({ width: 600, height: 400, scale: 2, offsetLeft: 120, offsetTop: 40 });
    const { overlay, sync } = startSync(1);
    expect(place(overlay)).toEqual({ left: '420px', top: '120px', scale: '0.5' });
    expect(overlay.style.getPropertyValue('zoom')).toBe('');
    expect(overlay.style.getPropertyValue('max-width')).toBe('1176px');
    sync.stop();
  });

  it('follows the visual viewport as it zooms and scrolls after the panel opened', () => {
    const viewport = createViewport();
    const { overlay, sync } = startSync(1);
    expect(overlay.style.getPropertyValue('--x-ov-visible-scale')).toBe('1');

    Object.assign(viewport, { width: 600, height: 400, scale: 2, offsetLeft: 240, offsetTop: 80 });
    viewport.dispatchEvent(new Event('resize'));
    expect(place(overlay)).toEqual({ left: '540px', top: '160px', scale: '0.5' });

    viewport.offsetTop = 100;
    viewport.dispatchEvent(new Event('scroll'));
    expect(overlay.style.getPropertyValue('top')).toBe('180px');
    sync.stop();
  });
});
