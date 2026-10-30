import { describe, expect, it } from 'vitest';
import { installWorkerFake, settleWorker } from '../../../tests/fakes/worker';

const DEFAULT_ENGINE_KEY = '_x_extension_default_search_engine_2024_unique_';

async function loadDefaultEngine() {
  const fake = installWorkerFake();
  const defaultEngine = await import('./default-engine');
  await settleWorker();
  return { fake, defaultEngine };
}

describe('the default search engine', () => {
  it('searches on the regional Yandex site this device used', async () => {
    const { fake, defaultEngine } = await loadDefaultEngine();

    expect(defaultEngine.updateDefaultSearchEngineFromUrl('https://yandex.tm/search/?text=test')).toBe(true);

    expect(defaultEngine.buildDefaultSearchUrl('a b')).toBe('https://yandex.tm/search/?text=a%20b');
    await expect.poll(() => fake.storage.sync.values[DEFAULT_ENGINE_KEY]).toMatchObject({
      id: 'yandex',
      host: 'yandex.tm',
      searchTemplate: 'https://yandex.tm/search/?text={query}'
    });
  });

  it('keeps searching on google.com after a regional Google result page', async () => {
    const { defaultEngine } = await loadDefaultEngine();

    expect(defaultEngine.updateDefaultSearchEngineFromUrl('https://www.google.co.jp/search?q=test')).toBe(true);

    expect(defaultEngine.buildDefaultSearchUrl('a b')).toBe('https://www.google.com/search?q=a%20b');
  });

  it('ignores a page that is no result page', async () => {
    const { defaultEngine } = await loadDefaultEngine();

    expect(defaultEngine.updateDefaultSearchEngineFromUrl('https://yandex.tm/maps/?text=test')).toBe(false);
    expect(defaultEngine.buildDefaultSearchUrl('a b')).toBe('https://www.google.com/search?q=a%20b');
  });
});
