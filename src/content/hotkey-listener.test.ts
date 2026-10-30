import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContentChrome } from '../../tests/fakes/content-chrome';
import type { ContentChrome, ContentChromeOptions } from '../../tests/fakes/content-chrome';
import { parseCss } from '../../tests/fakes/css';

// The copy-page-URL listener the first copy command injects into a page, and
// what it costs the page and the worker.

const LANGUAGE_KEY = '_x_extension_language_2024_unique_';

async function loadListener(options: ContentChromeOptions = {}): Promise<ContentChrome> {
  const fake = createContentChrome({
    ...options,
    replies: { getLocaleMessages: () => ({ messages: { copy_page_url_success: { message: 'URLをコピーしました' } } }) }
  });
  vi.stubGlobal('chrome', fake.chrome);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(() => Promise.resolve()) } });
  vi.resetModules();
  await import('./hotkey-listener');
  await vi.advanceTimersByTimeAsync(10);
  return fake;
}

async function sendCopyCommand(fake: ContentChrome): Promise<unknown> {
  const response = fake.dispatch({ action: 'copyCurrentPageUrlFromCommand' });
  await vi.advanceTimersByTimeAsync(10);
  return response;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard');
  document.head.replaceChildren();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('copy page URL listener', () => {
  it('sends the worker nothing when it loads', async () => {
    const fake = await loadListener();
    expect(fake.takeActions()).toEqual([]);
  });

  it('shows the toast in the browser language without messaging the worker', async () => {
    const fake = await loadListener();
    await expect(sendCopyCommand(fake)).resolves.toEqual({ ok: true });
    expect(fake.takeActions()).toEqual([]);
    expect(document.querySelector('link[href*="remixicon"]')).toBeNull();
    const pageRules = Array.from(document.querySelectorAll('style'), (style) => style.textContent).join('\n');
    // No class rule reaches the host page; only the scoped icon face does.
    expect(pageRules).not.toMatch(/\[class/);
    expect(pageRules).toMatch(/font-family: "lumno-remixicon"/);
    const host = document.getElementById('_x_extension_page_toast_2026_unique_');
    expect(host).not.toBeNull();
    // The toast's content lives in its shadow root.
    expect(host?.children).toHaveLength(0);
  });

  it('fetches only its strings, once per page, for a chosen language', async () => {
    const fake = await loadListener({ sync: { [LANGUAGE_KEY]: 'ja' } });
    await sendCopyCommand(fake);
    expect(fake.messages).toEqual([{
      action: 'getLocaleMessages',
      locale: 'ja',
      keys: ['copy_page_url_failed_retry', 'copy_page_url_success', 'copy_page_url_failed_permission']
    }]);
    await sendCopyCommand(fake);
    expect(fake.messages).toHaveLength(1);
  });

  it('places the toast clear of the host page’s top safe area', async () => {
    const shadows: ShadowRoot[] = [];
    const attachShadow = Element.prototype.attachShadow;
    vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (this: Element, init: ShadowRootInit) {
      const shadow = attachShadow.call(this, init);
      shadows.push(shadow);
      return shadow;
    });
    const fake = await loadListener();
    await sendCopyCommand(fake);

    const styles = shadows.flatMap((shadow) => Array.from(shadow.querySelectorAll('style'), (style) => style.textContent || '')).join('\n');
    const toast = parseCss(styles).rule('.toast');
    expect(toast ? [toast.get('position'), toast.get('top')] : null).toEqual(['fixed', 'max(24px, calc(env(safe-area-inset-top) + 12px))']);
  });
});
