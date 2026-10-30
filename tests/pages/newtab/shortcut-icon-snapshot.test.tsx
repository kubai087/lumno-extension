import { describe, expect, it } from 'vitest';
import { getFaviconPersistCacheKey } from '../../../src/domain/favicon/canonical';
import { normalizePageUrl } from '../../../src/domain/favicon/shortcut-favicon/persisted';
import { dataUrl, png } from '../../fakes/favicon-network';
import { createAcquisition, openFrontend, pause } from './shortcut-icon-page';

// New Tab keeps a stable snapshot of each shortcut's icon, acquired once
// from the worker; only a saved manual refresh replaces it.

const PAGE = 'https://developer.chrome.com/docs/extensions/?view=read#intro';
const NORMALIZED_PAGE = normalizePageUrl(PAGE);
const isBrowserUrl = (url: string) => url.startsWith('chrome-extension://lumno/_favicon/');

describe('a shortcut icon snapshot in strict mode', () => {
  it('keeps Chrome\'s artwork as local bytes, saved once, and replaces it only when a manual refresh is saved', async () => {
    const strict = createAcquisition({ enhanced: false });
    const frontend = await openFrontend(strict, PAGE);
    await frontend.waitForTileIcon();
    await frontend.waitForWrite();
    const snapshot = frontend.tileIcon();
    expect(snapshot.startsWith('data:image/png;base64,')).toBe(true);
    expect(strict.network.state.calls.every((call) => isBrowserUrl(call.url))).toBe(true);
    await pause(200);
    expect(frontend.writes()).toBe(1);

    strict.network.state.browserImage = png(32, 9);
    await frontend.openEditor();
    await frontend.refresh();
    const draft = frontend.editorIcon();
    expect(draft).not.toBe(snapshot);
    expect(frontend.tileIcon()).toBe(snapshot);
    expect(frontend.writes()).toBe(1);
    expect(frontend.messages()[1].refresh).toBe(true);

    await frontend.save(true);
    expect(frontend.tileIcon()).toBe(snapshot);
    expect(await frontend.save(false)).toBe(true);
    expect(frontend.tileIcon()).toBe(draft);
    expect(strict.network.state.calls.every((call) => call.url.startsWith('chrome-extension:'))).toBe(true);
    await pause(200);
    const saved = frontend.snapshots();

    strict.network.state.browserImage = png(32, 12);
    const reopened = await openFrontend(strict, PAGE, { initialSnapshots: saved });
    await reopened.waitForTileIcon();
    expect(reopened.tileIcon()).toBe(draft);
    await pause(200);
    expect(reopened.messages()).toHaveLength(0);
  });

  it('does not let page favicon cache bytes without provenance stand in for the exact-page lookup', async () => {
    const strict = createAcquisition({ enhanced: false });
    const migrated = dataUrl(png(64, 6));
    const unproven = await openFrontend(strict, NORMALIZED_PAGE, {
      persistedEntries: { [getFaviconPersistCacheKey(PAGE)]: { dataUrl: migrated, updatedAt: Date.now() } }
    });
    await unproven.waitForTileIcon();
    expect(unproven.tileIcon()).not.toBe(migrated);
    expect(unproven.messages()).toHaveLength(1);
  });

  it('does not copy the icon of another page on the same host', async () => {
    const strict = createAcquisition({ enhanced: false });
    const migrated = dataUrl(png(64, 6));
    const otherPage = await openFrontend(strict, NORMALIZED_PAGE, {
      persistedEntries: { [getFaviconPersistCacheKey('https://developer.chrome.com/another')]: { dataUrl: migrated, updatedAt: Date.now() } }
    });
    await otherPage.waitForTileIcon();
    expect(otherPage.tileIcon()).not.toBe(migrated);
  });

  it('does not acquire an icon for a shortcut removed while the favicon cache loads', async () => {
    const strict = createAcquisition({ enhanced: false });
    const removed = await openFrontend(strict, NORMALIZED_PAGE, { holdFaviconCache: true });
    await pause(200);
    await removed.removeShortcut();
    await removed.release();
    await pause(200);
    expect(removed.messages()).toHaveLength(0);
  });
});
