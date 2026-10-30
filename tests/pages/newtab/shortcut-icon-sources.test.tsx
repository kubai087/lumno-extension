import { describe, expect, it } from 'vitest';
import { getBundledShortcutIconAssetPath } from '../../../src/domain/favicon/shortcut-favicon/bundled-icons';
import { normalizePageUrl, setCachedIcon } from '../../../src/domain/favicon/shortcut-favicon/persisted';
import { getDefaultSiteSearchProviders } from '../../../src/domain/search/utils/site-search-providers';
import { required } from '../../fakes/dom';
import { dataUrl, png } from '../../fakes/favicon-network';
import { createAcquisition, openFrontend, pause } from './shortcut-icon-page';

// Where a shortcut's icon comes from: its stored source, the source chosen
// in the editor, or the artwork packaged with the extension.

const PAGE = 'https://developer.chrome.com/docs/extensions/?view=read#intro';
const NORMALIZED_PAGE = normalizePageUrl(PAGE);

// The shortcut's stored source drives automatic acquisition, and the editor
// refreshes from the source it shows.
describe('a shortcut icon\'s source', () => {
  it('acquires and refreshes from Favicon.is when chosen, and keeps its snapshot across a restart', async () => {
    const faviconIs = await openFrontend(createAcquisition(), NORMALIZED_PAGE, { iconSource: 'favicon-is' });
    await faviconIs.waitForTileIcon();
    expect(faviconIs.messages()[0].iconSource).toBe('favicon-is');
    await faviconIs.openEditor();
    expect(faviconIs.editorSource()).toBe('favicon-is');
    await faviconIs.refresh();
    expect(faviconIs.editorIcon().startsWith('data:image/png')).toBe(true);
    expect([faviconIs.messages()[1].iconSource, faviconIs.messages()[1].refresh]).toEqual(['favicon-is', true]);
    await faviconIs.waitForWrite();
    const snapshots = faviconIs.snapshots();

    const restart = await openFrontend(createAcquisition(), NORMALIZED_PAGE, { iconSource: 'favicon-is', initialSnapshots: snapshots });
    await restart.waitForTileIcon();
    expect(restart.tileIcon()).toBe(required(snapshots[NORMALIZED_PAGE]).dataUrl);
    await pause(200);
    expect(restart.messages()).toHaveLength(0);
  });

  it('follows the stored source automatically and the editor\'s chosen source on refresh', async () => {
    const cache = await openFrontend(createAcquisition(), NORMALIZED_PAGE, { iconSource: 'cache' });
    await cache.waitForTileIcon();
    expect(cache.messages()[0].iconSource).toBe('cache');
    await cache.openEditor();
    await cache.chooseSource('service');
    await cache.refresh();
    expect(cache.messages()[cache.messages().length - 1].iconSource).toBe('service');
  });
});

// Built-in artwork comes with the extension for exact supported hosts.
describe('a shortcut\'s built-in artwork', () => {
  const githubPage = 'https://github.com/kubai087/lumno-extension';

  it('replaces a stale online snapshot without acquiring anything, for exact supported hosts only', async () => {
    const builtinUrl = `chrome-extension://lumno/${getBundledShortcutIconAssetPath(githubPage, getDefaultSiteSearchProviders())}`;
    const acquisition = createAcquisition();
    const builtin = await openFrontend(acquisition, githubPage, {
      iconSource: 'builtin',
      initialSnapshots: setCachedIcon({}, githubPage, dataUrl(png(64, 7)), 'https://t2.gstatic.cn/faviconV2')
    });
    await pause(200);
    expect(builtin.tileIcon()).toBe('');
    expect([builtin.messages(), acquisition.network.state.calls]).toEqual([[], []]);
    await builtin.openEditor();
    expect([builtin.editorSource(), builtin.editorIcon()]).toEqual(['builtin', builtinUrl]);
    await builtin.setUrl('https://www.github.com/');
    expect(builtin.editorSources()).toContain('builtin');
    for (const unsupported of ['https://github.com.evil.test/', 'https://not-supported.test/', 'chrome://settings/']) {
      await builtin.setUrl(unsupported);
      expect(builtin.editorSources(), unsupported).not.toContain('builtin');
    }
  });

  it('falls back to automatic acquisition when the host has no packaged artwork', async () => {
    const orphaned = await openFrontend(createAcquisition(), 'https://not-supported.test/', { iconSource: 'builtin' });
    await orphaned.waitForWrite();
    expect(orphaned.messages().length).toBeGreaterThan(0);
  });

  it('does not pick host-wide bundled artwork for an automatic path-specific shortcut', async () => {
    const automatic = await openFrontend(createAcquisition(), githubPage);
    await automatic.waitForTileIcon();
    await automatic.openEditor();
    expect(automatic.editorSource()).toBe('cache');
  });
});
