import { describe, expect, it } from 'vitest';
import { createIndexLoader } from './help-center-index';

describe('help center index loader', () => {
  it('retries a failed load, reuses a loaded index for its lifetime and keeps one per language', async () => {
    let now = 0;
    let failNext = true;
    const requests: string[] = [];
    const loader = createIndexLoader({
      now: () => now,
      ttlMs: 1000,
      fetchImpl: (url) => {
        requests.push(url);
        if (failNext) {
          failNext = false;
          return Promise.reject(new Error('offline'));
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ title: 'A', href: '/help/a/', text: '' }]) });
      }
    });
    await expect(loader.load('https://index.test/a.json')).rejects.toThrow(/offline/);
    expect(await loader.load('https://index.test/a.json')).toHaveLength(1);
    await loader.load('https://index.test/a.json');
    expect(requests).toHaveLength(2);
    now = 1500;
    await loader.load('https://index.test/a.json');
    expect(requests).toHaveLength(3);
    await loader.load('https://index.test/b.json');
    expect(requests).toHaveLength(4);
  });
});
