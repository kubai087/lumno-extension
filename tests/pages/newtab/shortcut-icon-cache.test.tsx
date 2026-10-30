import { act } from 'react';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { newtabShortcutFaviconCache } from '../../../src/domain/settings/newtab-shortcuts';
import { createShortcutStoragePlan } from '../../../src/domain/shortcuts/storage-plan';
import { createBrowserFake } from '../../fakes/browser';
import { bootNewtab } from './boot';
import { closeNewtab, decodeDataImages, waitFor } from './shortcut-icon-page';

// New Tab writes its icon cache under a cross-tab Web Lock, merging what it
// fetched into what other tabs saved meanwhile, and drops icons of removed
// shortcuts in the same serialized path.

const KEY = newtabShortcutFaviconCache.key;

function entry(url: string, data: string) {
  return { dataUrl: `data:image/png;base64,${data}`, sourceUrl: `${url}icon.png`, updatedAt: Date.now() };
}

function readCache(values: Record<string, unknown>): Record<string, { dataUrl?: unknown }> {
  const cache = values[KEY];
  return typeof cache === 'object' && cache !== null ? Object.fromEntries(Object.entries(cache)) : {};
}

describe('the New Tab shortcut icon cache', () => {
  it('merges its fetched icons into what other tabs saved, under a shared lock, and prunes removed shortcuts', async () => {
    const shortcuts = (items: Array<{ id: string; title: string; url: string }>) => createShortcutStoragePlan({ items }).payload;
    const browser = createBrowserFake({
      sync: shortcuts([{ id: 's1', title: 'One', url: 'https://one.example/' }, { id: 's2', title: 'Two', url: 'https://two.example/' }]),
      local: { [KEY]: { 'https://two.example/': entry('https://two.example/', 'b2xk') } }
    });
    browser.runtime.sendMessage = vi.fn((message: unknown, callback?: (response: unknown) => void) => {
      const pageUrl = typeof message === 'object' && message !== null && 'pageUrl' in message ? String(message.pageUrl) : '';
      // Another New Tab saves a newer icon for Two while this one fetches One.
      browser.storage.local.values[KEY] = { ...readCache(browser.storage.local.values), 'https://two.example/': entry('https://two.example/', 'bmV3') };
      const reply = { data: 'data:image/png;base64,b25l', sourceUrl: `${pageUrl}icon.png`, width: 64, height: 64, vector: false };
      if (callback) {
        queueMicrotask(() => callback(reply));
        return undefined;
      }
      return Promise.resolve(reply);
    });
    const locks: string[] = [];
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request: (name: string, task: () => unknown) => { locks.push(name); return Promise.resolve().then(task); } }
    });
    onTestFinished(() => { Reflect.deleteProperty(navigator, 'locks'); });
    closeNewtab();
    decodeDataImages();
    await bootNewtab(browser);

    const cache = () => readCache(browser.storage.local.values);
    await waitFor(() => Boolean(cache()['https://one.example/']), 'New Tab saved no icon for One');
    expect(locks).toContain(`lumno-shortcut-favicon-store:${KEY}`);
    expect(cache()['https://one.example/'].dataUrl).toBe('data:image/png;base64,b25l');
    expect(cache()['https://two.example/'].dataUrl).toBe('data:image/png;base64,bmV3');

    for (const [key, value] of Object.entries(shortcuts([{ id: 's1', title: 'One', url: 'https://one.example/' }]))) {
      await act(async () => browser.storage.sync.externalSet({ [key]: value }));
    }
    await waitFor(() => Object.keys(cache()).length === 1, 'New Tab kept the icon of the removed shortcut');
    expect(Object.keys(cache())).toEqual(['https://one.example/']);
  });
});
