import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShortcutFavicons } from './shortcut-favicons';
import { shortcutIconEvents } from './shortcut-icon-events';
import { ShortcutList } from './shortcut-list';
import { createSettingsStore } from '../../platform/settings-store';
import { getGstaticFaviconUrl } from '../../domain/favicon/candidate-urls';
import { normalizeCacheMap } from '../../domain/favicon/shortcut-favicon/persisted';
import { createBrowserFake } from '../../../tests/fakes/browser';

// A tile tints itself when it mounts. When its icon snapshot arrives only
// afterwards (first load after picking an icon service), the tiles are told,
// so the one showing that page works out its tint again from the snapshot.

const pageUrl = 'https://example.com/docs/';
const otherUrl = 'https://other.example.com/';

// A PNG header for a square image `width` pixels wide.
function png(width: number, marker: number): Buffer {
  const buffer = Buffer.alloc(25);
  buffer.set([137, 80, 78, 71, 13, 10, 26, 10]);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(width, 20);
  buffer[24] = marker;
  return buffer;
}

const snapshot = `data:image/png;base64,${png(64, 7).toString('base64')}`;

afterEach(() => {
  vi.unstubAllGlobals();
});

function createFavicons() {
  // The background answers each icon request with the snapshot.
  const browser = createBrowserFake({
    respond: (message) => (message.action === 'getShortcutFaviconData'
      ? { data: snapshot, sourceUrl: getGstaticFaviconUrl(pageUrl) }
      : undefined)
  });
  vi.stubGlobal('chrome', browser);
  const shortcutList = new ShortcutList();
  shortcutList.replaceItems([
    { id: 'a', url: pageUrl, title: 'Docs', host: 'example.com', iconSource: 'service' },
    { id: 'b', url: otherUrl, title: 'Other', host: 'other.example.com' }
  ]);
  const favicons = createShortcutFavicons({
    settings: createSettingsStore({ chromeApi: browser, settings: [] }),
    shortcutList,
    bookmarksRuntime: { getNode: () => null, getSnapshot: vi.fn() },
    folderItemIconStore: { get: () => null, update: async () => ({}) },
    shortcutFaviconStore: {
      readAll: async () => ({}),
      mergeAll: async (entries) => normalizeCacheMap(entries),
      retainAll: async () => ({})
    },
    faviconCacheRuntime: { ensureCachesReady: async () => {} },
    getPersistedFaviconDataEntry: () => null,
    getPageFaviconUrlResolver: () => ({
      getShortcutFaviconCandidateUrl: () => '',
      getShortcutFaviconFetchCandidates: () => [{ kind: 'proxy', url: getGstaticFaviconUrl(pageUrl), placeholderUrl: '' }]
    })
  });
  return { favicons, browser };
}

describe('shortcut icon snapshots', () => {
  it('saves a fetched site-wide snapshot for the page and tells the tiles once', async () => {
    const { favicons, browser } = createFavicons();
    const saved: string[] = [];
    const stop = shortcutIconEvents.on('snapshotSaved', (event) => saved.push(event.pageUrl));

    expect(favicons.getShortcutFaviconDataUrl(pageUrl)).toBe('');
    expect(await favicons.resolveShortcutFaviconDataUrl(pageUrl)).toBe(snapshot);
    // A site-wide service snapshot counts for a page on that site.
    expect(favicons.getShortcutFaviconDataUrl(pageUrl)).toBe(snapshot);
    expect(saved).toEqual([pageUrl]);

    // An existing snapshot leaves the tint alone and asks for nothing.
    const requests = browser.runtime.sendMessage.mock.calls.length;
    expect(await favicons.resolveShortcutFaviconDataUrl(pageUrl)).toBe(snapshot);
    expect(saved).toEqual([pageUrl]);
    expect(browser.runtime.sendMessage.mock.calls).toHaveLength(requests);
    stop();
  });
});
