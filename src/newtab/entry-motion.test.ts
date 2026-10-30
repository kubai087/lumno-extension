import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEntryMotion } from './entry-motion';
import { ViewportActivity } from './viewport-activity';

// The New Tab's visible order: the wallpaper first, then the content entering.
interface EntrySetup {
  wallpaperActive?: boolean;
  // How long ago the wallpaper showed; null when it has not.
  shownAgoMs?: number | null;
  focusResume?: boolean;
}

function setup({ wallpaperActive = true, shownAgoMs = 0, focusResume = false }: EntrySetup = {}) {
  if (focusResume) document.documentElement.setAttribute('data-nt-focus-resume', 'true');
  if (wallpaperActive) document.body.setAttribute('data-wallpaper-active', 'true');
  const shownAt = shownAgoMs === null ? 0 : performance.now() - shownAgoMs;
  const viewport = { width: 1280, height: 800 };
  return createEntryMotion({
    root: document.createElement('div'),
    getWallpaperShownAt: () => shownAt,
    shouldSkipNewtabEntryMotion: () => false,
    updateBookmarkSectionPosition() {},
    finishWordmarkEntryAnimation() {},
    rememberSearchEntryViewport() {},
    getSearchEntryViewportSnapshot: () => viewport,
    hasSearchEntryViewportChanged: () => false,
    viewport: new ViewportActivity(),
    onEntryDone() {}
  });
}

const ready = () => document.body.getAttribute('data-nt-ready');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  vi.advanceTimersByTime(1000);
});

afterEach(() => {
  vi.useRealTimers();
  Array.from(document.body.attributes).forEach((attribute) => document.body.removeAttribute(attribute.name));
  document.documentElement.removeAttribute('data-nt-focus-resume');
});

describe('the New Tab entry', () => {
  it('waits for the wallpaper to lead, so the two never land in one moment', () => {
    const motion = setup();
    motion.markNewtabReady();
    vi.advanceTimersByTime(20);
    expect(ready()).toBeNull();
    // A second request waits for the same lead.
    motion.markNewtabReady();
    vi.advanceTimersByTime(80);
    expect(ready()).toBe('1');
    expect(document.body.getAttribute('data-nt-enter')).toBe('run');
  });

  it.each([
    ['a wallpaper shown long ago', { shownAgoMs: 400 }],
    ['no wallpaper', { wallpaperActive: false }],
    // The search shortcut reload holds the old page until this one is ready.
    ['the search shortcut reload', { focusResume: true }],
    ['a wallpaper not shown yet', { shownAgoMs: null }]
  ])('adds no wait after %s', (_name, options: EntrySetup) => {
    setup(options).markNewtabReady();
    // One frame, well inside the 60 ms lead.
    vi.advanceTimersByTime(20);
    expect(ready()).toBe('1');
  });
});
