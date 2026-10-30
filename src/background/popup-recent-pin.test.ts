import { describe, expect, it } from 'vitest';
import * as store from '../domain/recent-sites-store';
import { pinnedRecentSites } from '../domain/settings/recent-sites';
import { createSettingsStore } from '../platform/settings-store';
import { createController } from './popup-recent-pin';
import { WORKER_SETTINGS } from './worker-settings';
import { createWorkerFake } from '../../tests/fakes/worker';

const KEY = pinnedRecentSites.key;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
const page = { url: 'https://km.woa.com/articles/1', title: 'Seedance 2.5' };

function createPin(pinned?: unknown, series = false) {
  const fake = createWorkerFake({ sync: pinned === undefined ? {} : { [KEY]: pinned } });
  const pin = createController({
    store,
    settingsStore: createSettingsStore({ chromeApi: fake.chrome, settings: WORKER_SETTINGS }),
    storeOptions: { maxPinned: 3 },
    probeSeries: () => Promise.resolve(series),
    createProgressId: () => 'p1'
  });
  const stored = (): Record<string, unknown>[] => {
    const value = fake.storage.sync.values[KEY];
    return Array.isArray(value) ? value.filter(isRecord) : [];
  };
  return { pin, stored };
}

describe('pinning the popup page among the recent sites', () => {
  it('pins a page in front and reads every page of that site as pinned', async () => {
    const { pin, stored } = createPin([{ url: 'https://example.com/', title: 'Example' }]);

    expect(KEY).toBe('_x_extension_newtab_pinned_recent_sites_2026_unique_');
    expect(await pin.getStatus(page)).toEqual({ available: true, pinned: false, full: false });
    expect(await pin.toggle(page)).toEqual({ status: 'pinned', tracking: false });
    expect(stored().map((item) => item.url)).toEqual([page.url, 'https://example.com/']);
    expect(stored()[0].pinnedAt).toBeGreaterThan(0);

    const otherPage = { url: 'https://km.woa.com/articles/2', title: 'Another' };
    expect((await pin.getStatus(otherPage)).pinned).toBe(true);
    expect(await pin.toggle(otherPage)).toEqual({ status: 'unpinned' });
    expect(stored().map((item) => item.url)).toEqual(['https://example.com/']);
  });

  it('refuses a fourth card', async () => {
    const { pin, stored } = createPin(['a', 'b', 'c'].map((name) => ({ url: `https://${name}.com/`, title: name })));

    expect(await pin.getStatus(page)).toEqual({ available: true, pinned: false, full: true });
    expect(await pin.toggle(page)).toEqual({ status: 'limit' });
    expect(stored()).toHaveLength(3);
  });

  it('starts an episode tracked, as when it is pinned on the New Tab', async () => {
    const { pin, stored } = createPin(undefined, true);

    expect(await pin.toggle(page)).toEqual({ status: 'pinned', tracking: true });
    expect(stored()[0]).toMatchObject({ progressTracking: true, progressId: 'p1' });
  });

  it('cannot pin browser pages or a missing tab', async () => {
    const { pin } = createPin();

    expect(await pin.getStatus({ url: 'chrome://settings/', title: '' })).toEqual({ available: false, pinned: false, full: false });
    expect(await pin.getStatus(null)).toEqual({ available: false, pinned: false, full: false });
    expect(await pin.toggle(null)).toEqual({ status: 'invalid' });
  });

  it('toggles twice on two quick clicks', async () => {
    const { pin, stored } = createPin();
    const results = await Promise.all([pin.toggle(page), pin.toggle(page)]);

    expect(results.map((result) => result.status)).toEqual(['pinned', 'unpinned']);
    expect(stored()).toEqual([]);
  });
});
