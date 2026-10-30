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

export async function bootNewtab(browser: BrowserFake): Promise<void> {
  const parsed = new DOMParser().parseFromString(newtabHtml, 'text/html');
  Array.from(parsed.body.attributes).forEach((attribute) => document.body.setAttribute(attribute.name, attribute.value));
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
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => enMessages })));
  vi.resetModules();
  await runPageBundle('newtab-preload');
  await runPageBundle('wallpaper-effect-preload');
  await act(async () => {
    await runPageBundle('newtab');
  });
  await settle();
}

afterEach(() => {
  document.body.replaceChildren();
  Array.from(document.body.attributes).forEach((attribute) => document.body.removeAttribute(attribute.name));
  vi.unstubAllGlobals();
});

export async function bootReadyNewtab(browser: BrowserFake): Promise<void> {
  await bootNewtab(browser);
  await waitFor(() => document.body.getAttribute('data-nt-ready') === '1', 'New Tab did not mark itself ready');
}
