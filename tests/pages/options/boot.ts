// Boots the real Options page (its markup, its preload entry and its page
// entry, in order) against an in-memory browser (tests/fakes/browser.ts), for
// tests of the whole page. Each boot gets fresh module instances; the page's
// window and document listeners go when the test ends.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { afterEach, vi } from 'vitest';
import optionsHtml from '../../../src/options/options.html?raw';
import { REPO_ROOT, readRepoFile } from '../../fakes/css';
import { runPageBundle } from '../page-bundles';

type ListenerRecord = [EventTarget, string, EventListenerOrEventListenerObject, AddEventListenerOptions | boolean | undefined];

const addedListeners: ListenerRecord[] = [];

function trackListeners(target: EventTarget): void {
  // A test that boots the page twice finds the spy in place, and spying again
  // would hand back that spy as the method to forward to.
  if (vi.isMockFunction(target.addEventListener)) {
    return;
  }
  const addEventListener = target.addEventListener.bind(target);
  vi.spyOn(target, 'addEventListener').mockImplementation((type, listener, options) => {
    if (listener) {
      addedListeners.push([target, type, listener, options]);
      addEventListener(type, listener, options);
    }
  });
}

// The extension's own files as the page fetches them; nothing else is reachable.
async function fetchExtensionFile(url: string | URL) {
  const parsed = new URL(String(url), 'chrome-extension://lumno/src/options/options.html');
  if (parsed.protocol !== 'chrome-extension:') {
    throw new Error(`network disabled: ${String(url)}`);
  }
  const path = decodeURIComponent(parsed.pathname).replace(/^\//, '');
  if (!existsSync(join(REPO_ROOT, path))) {
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
  }
  const text = readRepoFile(path);
  return { ok: true, status: 200, json: async () => JSON.parse(text), text: async () => text };
}

export async function settle(passes = 6): Promise<void> {
  await act(async () => {
    for (let pass = 0; pass < passes; pass += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

interface BootOptions {
  // navigator.platform, which picks the shortcut glyphs; JSDOM reports ''.
  platform?: string;
}

// `browser` is what the page sees as `chrome`: tests/fakes/browser.ts, with
// whatever the test adds to it.
export async function bootOptionsPage(browser: object, options: BootOptions = {}): Promise<void> {
  const parsed = new DOMParser().parseFromString(optionsHtml, 'text/html');
  Array.from(parsed.body.children)
    .filter((node) => node.tagName !== 'SCRIPT')
    .forEach((node) => document.body.appendChild(document.importNode(node, true)));
  vi.stubGlobal('chrome', browser);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {}
  }));
  vi.stubGlobal('fetch', vi.fn(fetchExtensionFile));
  if (options.platform !== undefined) {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue(options.platform);
  }
  vi.resetModules();
  await runPageBundle('options-preload');
  trackListeners(document);
  trackListeners(window);
  await act(async () => {
    await runPageBundle('options');
  });
  await settle();
}

// Takes the page down between two boots in one test.
export function unmountOptionsPage(): void {
  addedListeners.splice(0).forEach(([target, type, listener, listenerOptions]) => {
    target.removeEventListener(type, listener, listenerOptions);
  });
  vi.unstubAllGlobals();
  document.body.replaceChildren();
}

afterEach(unmountOptionsPage);
