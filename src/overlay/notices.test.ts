import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNoticeLayer } from './notices';

// The overlay's notice layer: the update, graphics and engagement notices
// sit beside (above) the panel in its shadow root, count one update-notice
// exposure per mount and keep their frame matched to the panel.

function createPanel() {
  const host = document.documentElement.appendChild(document.createElement('div'));
  const styleRoot = host.attachShadow({ mode: 'open' });
  const panel = document.createElement('div');
  panel.style.setProperty('width', '680px');
  panel.style.setProperty('top', '18vh');
  panel.style.setProperty('--x-ov-visible-scale', '0.9');
  panel.setAttribute('data-theme', 'dark');
  styleRoot.appendChild(panel);
  return { host, styleRoot, panel };
}

function createNotice(visible = true) {
  const element = document.createElement('div');
  element.setAttribute('data-visible', visible ? 'true' : 'false');
  return { element, recordExposure: vi.fn() };
}

function preferReducedMotion(reduced: boolean): void {
  vi.stubGlobal('matchMedia', (media: string) => ({ matches: reduced, media }));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.documentElement.querySelectorAll(':scope > div').forEach((element) => element.remove());
});

describe('Overlay notice layer', () => {
  it('mounts the notices before the panel, never in it, entering after their frames', () => {
    preferReducedMotion(false);
    const { styleRoot, panel } = createPanel();
    const update = createNotice();
    const graphics = createNotice(false);
    const engagement = createNotice();
    const decorate = vi.fn();
    const layer = createNoticeLayer(window, {
      getUpdateNotice: () => update,
      getGraphicsNotice: () => graphics,
      getEngagementNotice: () => engagement,
      getSizePreset: () => ({ width: 760 }),
      decorate
    });

    layer.mount(panel, styleRoot);
    expect(Array.from(styleRoot.children)).toEqual([update.element, graphics.element, engagement.element, panel]);
    expect(panel.contains(update.element)).toBe(false);
    expect(update.recordExposure).toHaveBeenCalledTimes(1);
    expect(decorate.mock.calls.map(([element]) => element)).toEqual([update.element, graphics.element, engagement.element]);
    expect(graphics.element.style.getPropertyValue('width')).toBe('680px');
    expect(update.element.getAttribute('data-overlay-mounting')).toBe('true');

    vi.advanceTimersByTime(100);
    expect(update.element.hasAttribute('data-overlay-mounting')).toBe(false);
    expect(update.element.style.getPropertyValue('width')).toBe('680px');
    expect(update.element.style.getPropertyPriority('width')).toBe('important');
    expect(update.element.style.getPropertyValue('top')).toBe('18vh');
    expect(update.element.style.getPropertyValue('--x-ov-visible-scale')).toBe('0.9');
    expect(engagement.element.getAttribute('data-theme')).toBe('dark');

    layer.mount(panel, styleRoot);
    expect(update.recordExposure).toHaveBeenCalledTimes(1);
  });

  // Only the system preference: the layer never sees Lumno's motion setting.
  it('skips the entry state when the system asks for reduced motion', () => {
    preferReducedMotion(true);
    const frame = vi.spyOn(window, 'requestAnimationFrame');
    const { styleRoot, panel } = createPanel();
    const update = createNotice();
    createNoticeLayer(window, { getUpdateNotice: () => update }).mount(panel, styleRoot);
    expect(update.element.hasAttribute('data-overlay-mounting')).toBe(false);
    expect(frame).not.toHaveBeenCalled();
    expect(update.element.style.getPropertyValue('width')).toBe('680px');
  });

  it('mounts nothing, not even the engagement notice, without an update notice', () => {
    preferReducedMotion(true);
    const { styleRoot, panel } = createPanel();
    const engagement = createNotice();
    createNoticeLayer(window, { getUpdateNotice: () => null, getEngagementNotice: () => engagement }).mount(panel, styleRoot);
    expect(engagement.element.parentNode).toBeNull();
  });

  it('mounts a scheduled notice after its delay', () => {
    preferReducedMotion(true);
    const { styleRoot, panel } = createPanel();
    const update = createNotice();
    createNoticeLayer(window, { getUpdateNotice: () => update }).scheduleMount(panel, styleRoot, 5);
    expect(update.element.parentNode).toBeNull();
    vi.advanceTimersByTime(20);
    expect(update.element.parentNode).toBe(styleRoot);
  });

  it('drops a scheduled mount once the panel closed or the layer stopped', () => {
    preferReducedMotion(true);
    const closed = createPanel();
    const closedNotice = createNotice();
    createNoticeLayer(window, { getUpdateNotice: () => closedNotice }).scheduleMount(closed.panel, closed.styleRoot, 0);
    closed.panel.remove();

    const stopped = createPanel();
    const stoppedNotice = createNotice();
    const layer = createNoticeLayer(window, { getUpdateNotice: () => stoppedNotice });
    layer.scheduleMount(stopped.panel, stopped.styleRoot, 0);
    layer.stop();

    vi.advanceTimersByTime(10);
    expect(closedNotice.element.parentNode).toBeNull();
    expect(stoppedNotice.element.parentNode).toBeNull();
  });

  it('follows the panel through viewport resizes until stopped', () => {
    preferReducedMotion(true);
    const { styleRoot, panel } = createPanel();
    const update = createNotice();
    const layer = createNoticeLayer(window, { getUpdateNotice: () => update });
    layer.mount(panel, styleRoot);
    layer.startFrameSync(panel);

    panel.style.setProperty('width', '520px');
    window.dispatchEvent(new Event('resize'));
    expect(update.element.style.getPropertyValue('width')).toBe('520px');

    layer.stop();
    panel.style.setProperty('width', '400px');
    window.dispatchEvent(new Event('resize'));
    expect(update.element.style.getPropertyValue('width')).toBe('520px');
  });
});
