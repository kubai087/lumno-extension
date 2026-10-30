import { afterEach, describe, expect, it, vi } from 'vitest';

// The marker measures an unstyled scroll probe: a bar without width means the
// system draws overlay scrollbars.
let systemBarWidth = 0;

async function loadMarker(): Promise<void> {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(() => 100);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => 100 - systemBarWidth);
  vi.resetModules();
  await import('./scrollbar-mode');
}

const mode = () => document.documentElement.getAttribute('data-lumno-scrollbars');

afterEach(() => {
  document.documentElement.removeAttribute('data-lumno-scrollbars');
  systemBarWidth = 0;
});

describe('scrollbar mode marker', () => {
  it('marks overlay bars when the system bar takes no width', async () => {
    await loadMarker();

    expect(mode()).toBe('overlay');
  });

  it('switches to the thin bar on the next focus once a mouse brings classic bars', async () => {
    await loadMarker();
    systemBarWidth = 15;

    window.dispatchEvent(new Event('focus'));

    expect(mode()).toBe('classic');
  });

  it('measures again when the page becomes visible', async () => {
    systemBarWidth = 15;
    await loadMarker();
    systemBarWidth = 0;

    document.dispatchEvent(new Event('visibilitychange'));

    expect(mode()).toBe('overlay');
  });

  it('leaves no probe behind', async () => {
    await loadMarker();

    expect(document.documentElement.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});
