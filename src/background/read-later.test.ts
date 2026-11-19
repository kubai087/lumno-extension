import { describe, expect, it, vi } from 'vitest';
import { createSettingsStore } from '../platform/settings-store';
import { readLaterPages } from '../domain/settings/recent-sites';
import { createWorkerFake } from '../../tests/fakes/worker';
import { createReadLaterController } from './read-later';

const page = { url: 'https://example.com/article', title: 'Read me' };
describe('saving pages with the ordinary pin controller', () => {
  it('uses ordinary pinning and preserves additions without an extra deduplication pass', async () => {
    const fake = createWorkerFake();
    const settings = createSettingsStore({ chromeApi: fake.chrome, settings: [] });
    const pin = vi.fn(async () => ({ status: 'pinned' as const }));
    const controller = createReadLaterController(settings, { pin });
    expect(await Promise.all([controller.add(page), controller.add(page)]))
      .toEqual([{ status: 'added' }, { status: 'added' }]);
    expect(pin).toHaveBeenCalledTimes(2);
    expect(settings.get(readLaterPages)).toHaveLength(2);
    expect(fake.storage.sync.values[readLaterPages.key]).toBeUndefined();
    settings.destroy();
  });
  it('uses the original pin limit and refuses invalid pages', async () => {
    const fake = createWorkerFake();
    const settings = createSettingsStore({ chromeApi: fake.chrome, settings: [] });
    const pin = vi.fn(async () => ({ status: 'limit' as const }));
    const controller = createReadLaterController(settings, { pin });
    expect(await controller.add(page)).toEqual({ status: 'limit' });
    expect(settings.get(readLaterPages)).toEqual([]);
    expect(await controller.add({ url: 'chrome://settings/', title: '' })).toEqual({ status: 'failed' });
    expect(pin).toHaveBeenCalledTimes(1);
    settings.destroy();
  });
});
