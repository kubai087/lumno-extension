import { describe, expect, it } from 'vitest';
import { getCachedIconSource, setCachedIcon } from '../../../src/domain/favicon/shortcut-favicon/persisted';
import { required } from '../../fakes/dom';
import { dataUrl, png } from '../../fakes/favicon-network';
import { createAcquisition, openFrontend, pause } from './shortcut-icon-page';

// A saved icon snapshot that does not prove it belongs to its exact page is
// acquired again, once.

describe('a shortcut icon snapshot New Tab cannot trust for its page', () => {
  const pages = ['https://chrome.google.com/', 'https://chrome.google.com/webstore/devconsole?hl=zh-cn',
    'https://chrome.google.com/webstore/devconsole?hl=en', 'https://chrome.google.com/webstore/',
    'https://chrome.google.com/webstore', 'https://chrome.google.com/apps%2Fpreview'];
  const pathSpecific = () => createAcquisition({ pageImages: Object.fromEntries(pages.map((url, index) =>
    [url, { browser: png(32, index + 10), proxy: png(128, index + 20) }])) });
  const webstore = pages[1];
  const oldBytes = dataUrl(png(128, 88));

  it('replaces an old root-page snapshot through an exact-page request, keeping the chosen source', async () => {
    const oldRootSource = `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=${
      encodeURIComponent(pages[3])}&size=128`;
    const oldRoot = await openFrontend(pathSpecific(), webstore, {
      initialSnapshots: setCachedIcon({}, webstore, oldBytes, oldRootSource), iconSource: 'service'
    });
    await oldRoot.waitForWrite();
    await oldRoot.waitForTileIcon();
    expect(oldRoot.tileIcon()).not.toBe(oldBytes);
    expect(oldRoot.messages()).toHaveLength(1);
    await oldRoot.openEditor();
    expect(oldRoot.editorSource()).toBe('service');
  });

  it('acquires a legacy browser snapshot without its source once, and keeps the verified one on reopening', async () => {
    const acquisition = pathSpecific();
    const legacy = await openFrontend(acquisition, webstore, { initialSnapshots: setCachedIcon({}, webstore, oldBytes, ''), iconSource: 'cache' });
    await legacy.waitForWrite();
    await legacy.waitForTileIcon();
    expect(legacy.tileIcon()).not.toBe(oldBytes);
    const verified = required(legacy.snapshots()[webstore]);
    expect(new URL(verified.sourceUrl).searchParams.get('fallbackToHost')).toBe('0');
    expect(getCachedIconSource(verified)).toBe('cache');
    await legacy.openEditor();
    expect(legacy.editorSource()).toBe('cache');
    expect(legacy.editorIcon()).not.toBe('');
    const snapshots = legacy.snapshots();

    const rebound = await openFrontend(pathSpecific(), webstore, { initialSnapshots: snapshots, iconSource: 'cache' });
    await rebound.waitForTileIcon();
    await pause(200);
    expect(rebound.messages()).toHaveLength(0);
  });

  it('acquires an old chrome://favicon2 snapshot again through the extension endpoint', async () => {
    const favicon2 = await openFrontend(pathSpecific(), webstore, {
      initialSnapshots: setCachedIcon({}, webstore, oldBytes, `chrome://favicon2/?pageUrl=${encodeURIComponent(webstore)}&fallbackToHost=0`),
      iconSource: 'cache'
    });
    await favicon2.waitForWrite();
    expect(favicon2.tileIcon()).not.toBe(oldBytes);
    expect(favicon2.messages()).toHaveLength(1);
  });
});
