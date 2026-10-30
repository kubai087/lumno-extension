import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootOverlayPage, settle } from './boot';

// The overlay reveals itself in the browser top layer, inside the
// fullscreen element when there is one, with its input focused, and tracks
// the visual viewport only while it is open.

class CountingVisualViewport extends EventTarget {
  offsetLeft = 0;
  offsetTop = 0;
  width = 1024;
  height = 640;
  scale = 1;
  readonly listening: Record<string, number> = { resize: 0, scroll: 0 };

  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void {
    this.listening[type] = (this.listening[type] || 0) + 1;
    super.addEventListener(type, listener, options);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void {
    this.listening[type] = (this.listening[type] || 0) - 1;
    super.removeEventListener(type, listener, options);
  }
}

const showPopoverDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'showPopover');

afterEach(() => {
  Reflect.deleteProperty(document, 'fullscreenElement');
  if (showPopoverDescriptor) {
    Object.defineProperty(HTMLElement.prototype, 'showPopover', showPopoverDescriptor);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'showPopover');
  }
});

describe('Overlay reveal', () => {
  it('enters the top layer once inside the fullscreen element and focuses its input', async () => {
    const fullscreen = document.body.appendChild(document.createElement('div'));
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreen });
    const showPopover = vi.fn();
    HTMLElement.prototype.showPopover = showPopover;
    const page = await bootOverlayPage({ stylesheetsLoad: 0 });

    const root = await page.open();
    await settle(200);

    expect(page.host()?.parentNode).toBe(fullscreen);
    expect(showPopover).toHaveBeenCalledTimes(1);
    expect(root.activeElement?.tagName).toBe('INPUT');
  });

  it('tracks visual viewport resizes and scrolls while open, and stops on close', async () => {
    const viewport = new CountingVisualViewport();
    vi.stubGlobal('visualViewport', viewport);
    const page = await bootOverlayPage();

    await page.open();
    await settle(100);
    expect(viewport.listening.resize).toBeGreaterThan(0);
    expect(viewport.listening.scroll).toBeGreaterThan(0);

    page.press('Escape');
    await settle(400);
    expect(viewport.listening).toEqual({ resize: 0, scroll: 0 });
  });
});
