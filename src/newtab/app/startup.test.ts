import { describe, expect, it, vi } from 'vitest';
import { runStartup } from './startup';

// A promise and the functions that settle it.
function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('runStartup', () => {
  it('runs the data pass only after every layout preference, then the tone, then ready', async () => {
    const steps: string[] = [];
    const first = deferred();
    const second = deferred();
    const data = deferred();
    const tone = deferred();
    const done = runStartup({
      layoutPreferences: [first.promise, second.promise],
      loadData: () => {
        steps.push('data');
        return data.promise;
      },
      waitForWallpaperTone: () => {
        steps.push('tone');
        return tone.promise;
      },
      markReady: () => steps.push('ready')
    });
    first.resolve(true);
    await flush();
    expect(steps).toEqual([]);
    second.resolve(true);
    await flush();
    expect(steps).toEqual(['data']);
    data.resolve(true);
    await flush();
    expect(steps).toEqual(['data', 'tone']);
    tone.resolve(true);
    await done;
    expect(steps).toEqual(['data', 'tone', 'ready']);
  });

  it('logs a failed phase and goes on to the next', async () => {
    const steps: string[] = [];
    const log = { warn: vi.fn() };
    await runStartup({
      layoutPreferences: [Promise.reject(new Error('preference'))],
      loadData: () => {
        steps.push('data');
        return Promise.reject(new Error('data'));
      },
      waitForWallpaperTone: () => {
        steps.push('tone');
        return Promise.resolve();
      },
      markReady: () => steps.push('ready')
    }, log);
    expect(steps).toEqual(['data', 'tone', 'ready']);
    expect(log.warn).toHaveBeenCalledTimes(2);
  });
});
