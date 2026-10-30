// Boots the real New Tab (its markup and the entries it loads, in order)
// against an in-memory browser (tests/fakes/browser.ts), for tests of the
// whole page. Each boot gets fresh module instances.
import { act } from 'react';
import { afterEach, vi } from 'vitest';
import newtabHtml from '../../../newtab.html?raw';
import enMessages from '../../../_locales/en/messages.json';
import { runPageBundle } from '../page-bundles';
import type { BrowserFake } from '../../fakes/browser';

export async function settle(passes = 8): Promise<void> {
  await act(async () => {
    for (let pass = 0; pass < passes; pass += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

export async function waitFor(check: () => boolean, message: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (check()) return;
    await settle(2);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
  throw new Error(message);
}

// What the page's fetch answers with; the English messages for every URL
// unless a test passes its own.
interface NewtabBootOptions {
  fetch?: (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
  // Whether prefers-color-scheme: dark matches; light by default.
  darkSystem?: boolean;
}

// The document and the window outlive a test, so the listeners a page adds to
// them are removed when its test ends: a page booted later in the same file
// is then the only one that answers keys and pointers.
const pageListeners: Array<() => void> = [];

const followed = new Set<Document | Window>();

// Once per test: a second boot in the same test must not wrap the wrapper.
function followListeners(target: Document | Window): void {
  if (followed.has(target)) {
    return;
  }
  followed.add(target);
  const add = target.addEventListener;
  vi.spyOn(target, 'addEventListener').mockImplementation((type: string, listener: unknown, options?: unknown) => {
    Reflect.apply(add, target, [type, listener, options]);
    pageListeners.push(() => Reflect.apply(target.removeEventListener, target, [type, listener, options]));
  });
}

export async function bootNewtab(browser: BrowserFake, options: NewtabBootOptions = {}): Promise<void> {
  followListeners(document);
  followListeners(window);
  const parsed = new DOMParser().parseFromString(newtabHtml, 'text/html');
  if (!headBeforeBoot) {
    headBeforeBoot = new Set(Array.from(document.head.childNodes));
  }
  clearAttributes(document.documentElement);
  Array.from(parsed.documentElement.attributes)
    .forEach((attribute) => document.documentElement.setAttribute(attribute.name, attribute.value));
  Array.from(parsed.body.attributes).forEach((attribute) => document.body.setAttribute(attribute.name, attribute.value));
  Array.from(parsed.body.children)
    .filter((node) => node.tagName !== 'SCRIPT')
    .forEach((node) => document.body.appendChild(document.importNode(node, true)));
  vi.stubGlobal('chrome', browser);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: Boolean(options.darkSystem) && /prefers-color-scheme:\s*dark/.test(query),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {}
  }));
  vi.stubGlobal('fetch', vi.fn(options.fetch || (async () => ({ ok: true, json: async () => enMessages }))));
  vi.resetModules();
  await runPageBundle('newtab-preload');
  await runPageBundle('wallpaper-effect-preload');
  await act(async () => {
    await runPageBundle('newtab');
  });
  await settle();
}

// What the test document's head held before the first boot; the page's own
// links, styles and favicon come out again after each test.
let headBeforeBoot: Set<ChildNode> | null = null;

function clearAttributes(element: Element): void {
  Array.from(element.attributes).forEach((attribute) => element.removeAttribute(attribute.name));
}

afterEach(() => {
  pageListeners.splice(0).forEach((remove) => remove());
  followed.clear();
  document.body.replaceChildren();
  clearAttributes(document.body);
  clearAttributes(document.documentElement);
  const kept = headBeforeBoot;
  if (kept) {
    Array.from(document.head.childNodes).filter((node) => !kept.has(node)).forEach((node) => node.remove());
  }
  // The page caches settings and layout here; each boot is a fresh profile.
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

export async function bootReadyNewtab(browser: BrowserFake, options: NewtabBootOptions = {}): Promise<void> {
  await bootNewtab(browser, options);
  await waitFor(() => document.body.getAttribute('data-nt-ready') === '1', 'New Tab did not mark itself ready');
}
