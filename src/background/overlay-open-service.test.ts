import { describe, expect, it, vi } from 'vitest';
import type { WorkerFakeOptions, WorkerTab } from '../../tests/fakes/worker';
import { browserTab, installWorkerFake, jsonResponse, settleWorker } from '../../tests/fakes/worker';
import { createTabPages } from '../../tests/fakes/worker-pages';

// The search shortcut on web pages, against pages that keep what was
// injected into them until they navigate: opening, reusing the overlay
// module, and keeping an overlay opened during a page load open in the
// Document that replaces it.

const PAGE_URL = 'https://page.example.test/a';
const NEXT_URL = 'https://page.example.test/b';
const OVERLAY_FILES = ['build/injected/icon-font-preload.js', 'build/injected/overlay.js'];

async function boot(tab: Partial<WorkerTab>, options: WorkerFakeOptions = {}) {
  const fake = installWorkerFake({ tabs: [{ windowId: 1, index: 0, active: true, title: 'Page', ...tab, id: 7 }], ...options });
  const pages = createTabPages(fake);
  await import('./background');
  await settleWorker(30);
  const press = () => fake.chrome.commands.onCommand.fire('show-search');
  // Each toggle the worker sends imports the overlay's modules and runs it.
  const invocations = () => pages.log.filter((entry) => entry.kind === 'import' && entry.files.includes('build/injected/overlay.js'));
  return { fake, pages, press, invocations, page: () => pages.page(7) };
}

function loadingSessionOf(context: Record<string, unknown>): unknown {
  const session = context.loadingSession;
  return session && typeof session === 'object'
    ? { inputValue: Reflect.get(session, 'inputValue'), selectionStart: Reflect.get(session, 'selectionStart'), selectionEnd: Reflect.get(session, 'selectionEnd') }
    : null;
}

describe('opening the overlay on a web page', () => {
  it('opens at once in one injection and keeps reusing the one overlay the page loaded', async () => {
    const session = await boot({ url: PAGE_URL, status: 'complete' });
    session.fake.chrome.tabs.query.mockClear();
    session.press();
    await vi.waitFor(() => expect(session.page().overlayOpen).toBe(true));

    expect(session.fake.chrome.tabs.query).toHaveBeenCalledTimes(1);
    expect(session.pages.log.map((entry) => entry.files)).toEqual([OVERLAY_FILES]);
    expect(session.pages.log.every((entry) => entry.injectImmediately)).toBe(true);
    expect(session.invocations()[0].command).toMatchObject({ type: 'toggle' });

    await settleWorker(300);
    session.press();
    await vi.waitFor(() => expect(session.page().overlayOpen).toBe(false));
    await settleWorker(300);
    session.press();
    await vi.waitFor(() => expect(session.page().overlayOpen).toBe(true));
    expect(session.page().loadedModules).toEqual(OVERLAY_FILES);
  });

  it('toggles once for a second press while the first is still opening', async () => {
    const session = await boot({ url: PAGE_URL, status: 'loading' });
    session.press();
    await settleWorker(5);
    session.press();
    await settleWorker(400);

    expect(session.invocations()).toHaveLength(1);
  });

  it('opens an overlay opened during a load again, with its draft, in the Document that replaces the page', async () => {
    const session = await boot({ url: PAGE_URL, status: 'loading' });
    session.press();
    await vi.waitFor(() => expect(session.page().invocations).toHaveLength(1));
    expect(session.page().invocations[0].context.loadingSessionTracked).toBe(true);

    expect(await session.fake.sendMessage({
      action: 'updateOverlayLoadingSession',
      session: { inputValue: 'draft', selectionStart: 1, selectionEnd: 3, selectionDirection: 'forward', focused: true, revision: 1 }
    }, { tab: browserTab({ id: 7, windowId: 1, url: PAGE_URL }), url: PAGE_URL, frameId: 0, documentId: '1' }))
      .toEqual({ ok: true, tracked: true });

    session.pages.navigate(7, NEXT_URL);
    await vi.waitFor(() => expect(session.page().overlayOpen).toBe(true));
    const [restored] = session.page().invocations;
    expect(restored.context.ensureOpen).toBe(true);
    expect(loadingSessionOf(restored.context)).toEqual({ inputValue: 'draft', selectionStart: 1, selectionEnd: 3 });

    session.pages.complete(7);
    await settleWorker(300);
    expect(session.page().invocations).toHaveLength(1);
    await settleWorker(1700);
    session.pages.navigate(7, 'https://page.example.test/c');
    await settleWorker(400);
    expect(session.page().overlayOpen).toBe(false);
  });

  it('retries an injection that failed while the next Document was still committing', async () => {
    const session = await boot({ url: PAGE_URL, status: 'loading' });
    session.press();
    await vi.waitFor(() => expect(session.page().overlayOpen).toBe(true));
    session.pages.navigate(7, NEXT_URL);
    session.page().unavailable = true;
    await settleWorker(60);
    session.page().unavailable = false;

    await vi.waitFor(() => expect(session.page().overlayOpen).toBe(true), { timeout: 2000 });
  });

  it('keeps an overlay the user closed closed when the load completes', async () => {
    const session = await boot({ url: PAGE_URL, status: 'loading' });
    session.press();
    await vi.waitFor(() => expect(session.page().overlayOpen).toBe(true));
    await settleWorker(300);
    session.press();
    await vi.waitFor(() => expect(session.page().overlayOpen).toBe(false));
    session.pages.complete(7);
    await settleWorker(400);

    expect(session.page().overlayOpen).toBe(false);
  });

  it('waits for the page a shortcut was pressed for to commit', async () => {
    const session = await boot({ url: 'chrome://newtab/', pendingUrl: 'https://page.example.test/typed', status: 'loading' });
    session.fake.chrome.tabs.create.mockClear();
    session.press();
    await settleWorker(300);

    expect(session.invocations()).toEqual([]);
    expect(session.fake.chrome.tabs.create).not.toHaveBeenCalled();
    session.fake.tabs[0].pendingUrl = '';
    session.pages.navigate(7, 'https://page.example.test/typed');
    await vi.waitFor(() => expect(session.page().overlayOpen).toBe(true));
  });

  it('trusts a navigation event over a stale tab snapshot, until the load completes', async () => {
    const navigating = await boot({ url: PAGE_URL, status: 'complete' });
    // Chrome reports the navigation, but tabs.query still answers from the old Document.
    navigating.fake.chrome.tabs.onUpdated.fire(7, { status: 'loading', url: NEXT_URL },
      browserTab({ id: 7, windowId: 1, url: PAGE_URL, status: 'complete' }));
    navigating.press();
    await vi.waitFor(() => expect(navigating.page().invocations).toHaveLength(1));
    expect(navigating.page().invocations[0].context.loadingSessionTracked).toBe(true);

    const settled = await boot({ url: PAGE_URL, status: 'complete' });
    settled.fake.chrome.tabs.onUpdated.fire(7, { status: 'loading', url: NEXT_URL },
      browserTab({ id: 7, windowId: 1, url: PAGE_URL, status: 'loading' }));
    settled.fake.tabs[0].url = NEXT_URL;
    settled.fake.chrome.tabs.onUpdated.fire(7, { status: 'complete' }, browserTab({ id: 7, windowId: 1, url: NEXT_URL, status: 'complete' }));
    settled.press();
    await vi.waitFor(() => expect(settled.page().invocations).toHaveLength(1));
    expect(settled.page().invocations[0].context.loadingSessionTracked).toBe(false);
  });

  it('opens a cold worker without waiting for the provider list, and carries it once loaded', async () => {
    let releaseProviders: () => void = () => {};
    const providersHeld = new Promise<void>((resolve) => {
      releaseProviders = resolve;
    });
    const session = await boot({ url: PAGE_URL, status: 'complete' }, {
      fetch: async (url) => {
        if (!url.endsWith('/assets/data/site-search.json')) throw new Error('offline');
        await providersHeld;
        return jsonResponse({ items: [{ key: 'yt', name: 'YouTube', template: 'https://youtube.test/?q={query}' }] });
      }
    });
    session.press();
    await vi.waitFor(() => expect(session.page().overlayOpen).toBe(true));
    expect(session.page().invocations[0].context.siteSearchProviders).toEqual([]);

    releaseProviders();
    await settleWorker(50);
    await settleWorker(300);
    session.press();
    await vi.waitFor(() => expect(session.page().overlayOpen).toBe(false));
    await settleWorker(300);
    session.press();
    await vi.waitFor(() => expect(session.page().overlayOpen).toBe(true));
    const last = session.page().invocations[session.page().invocations.length - 1];
    const providers = last.context.siteSearchProviders;
    expect(providers).toEqual([expect.objectContaining({ key: 'yt' })]);
  });

  it("offers the page only its window's ordinary tabs, without the browser's own fields", async () => {
    const fake = installWorkerFake({
      tabs: [
        { id: 7, windowId: 1, index: 0, active: true, url: PAGE_URL, title: 'Page', favIconUrl: 'https://page.example.test/icon.png',
          audible: true, mutedInfo: { muted: false }, sessionId: 'x' },
        { id: 8, windowId: 1, index: 1, active: false, url: 'https://private.example.test/', title: 'Private', incognito: true }
      ]
    });
    await import('./background');
    const response = await fake.sendMessage({ action: 'getTabsForOverlay' }, { tab: browserTab({ id: 7, windowId: 1, url: PAGE_URL }), url: PAGE_URL });
    const tabs: unknown = response && typeof response === 'object' ? Reflect.get(response, 'tabs') : undefined;

    expect(tabs).toEqual([expect.objectContaining({ id: 7, title: 'Page', url: PAGE_URL, favIconUrl: 'https://page.example.test/icon.png' })]);
    ['audible', 'mutedInfo', 'sessionId', 'windowId', 'index'].forEach((field) => {
      expect(Array.isArray(tabs) ? tabs[0] : null).not.toHaveProperty(field);
    });
  });
});
