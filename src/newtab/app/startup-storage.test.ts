import { afterEach, describe, expect, it, vi } from 'vitest';
import { localPrimary } from '../../domain/settings/sync-state';
import { createBrowserFake } from '../../../tests/fakes/browser';
import { createStartupStorage } from './startup-storage';

// The New Tab's settings area: which storage changes are its own, and moving
// preferences an older version kept locally into browser sync.
const SYNCED_KEY = '_x_extension_theme_mode_2024_unique_';
const OTHER_KEY = '_x_extension_language_2024_unique_';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function setUp(local: Record<string, unknown>, sync: Record<string, unknown>) {
  const browser = createBrowserFake({ local, sync });
  vi.stubGlobal('chrome', browser);
  const storage = createStartupStorage();
  await storage.providerStorageRuntime.ready;
  return { storage, browser };
}

describe('New Tab startup storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps settings in browser sync and moves only what sync lacks there', async () => {
    const { storage, browser } = await setUp({ [SYNCED_KEY]: 'dark', [OTHER_KEY]: 'ja' }, { [OTHER_KEY]: 'en' });

    expect(storage.isPrimaryStorageAreaName('sync')).toBe(true);
    expect(storage.isPrimaryStorageAreaName('local')).toBe(false);
    storage.migrateLocalSettingsIfNeeded([SYNCED_KEY, OTHER_KEY]);
    await flush();
    await flush();
    expect(browser.storage.sync.values[SYNCED_KEY]).toBe('dark');
    expect(browser.storage.sync.values[OTHER_KEY]).toBe('en');
  });

  it('moves nothing to sync while settings stay on this device', async () => {
    const { storage, browser } = await setUp({ [localPrimary.key]: true, [SYNCED_KEY]: 'dark' }, {});

    expect(storage.isPrimaryStorageAreaName('local')).toBe(true);
    storage.migrateLocalSettingsIfNeeded([SYNCED_KEY]);
    await flush();
    await flush();
    expect(browser.storage.sync.values).not.toHaveProperty(SYNCED_KEY);
  });
});
