import { describe, expect, it, vi } from 'vitest';
import { runStartup, STARTUP_PHASE_LIMITS } from './startup';

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
      layoutPreferences: { first: first.promise, second: second.promise },
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
      layoutPreferences: { preference: Promise.reject(new Error('preference')) },
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

  it('goes on without a layout preference that never settles, and names it', async () => {
    vi.useFakeTimers();
    try {
      const steps: string[] = [];
      const log = { warn: vi.fn() };
      const done = runStartup({
        layoutPreferences: { settled: Promise.resolve(true), stuck: new Promise(() => {}) },
        loadData: () => {
          steps.push('data');
          return Promise.resolve();
        },
        waitForWallpaperTone: () => Promise.resolve(),
        markReady: () => steps.push('ready')
      }, log);
      await vi.advanceTimersByTimeAsync(STARTUP_PHASE_LIMITS.layoutPreferences - 1);
      expect(steps).toEqual([]);
      await vi.advanceTimersByTimeAsync(1);
      await done;
      expect(steps).toEqual(['data', 'ready']);
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn.mock.calls[0][1]).toEqual(['stuck']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks the page ready when the data pass or the tone never settles', async () => {
    vi.useFakeTimers();
    try {
      const steps: string[] = [];
      const log = { warn: vi.fn() };
      const done = runStartup({
        layoutPreferences: {},
        loadData: () => new Promise(() => {}),
        waitForWallpaperTone: () => new Promise(() => {}),
        markReady: () => steps.push('ready')
      }, log);
      await vi.advanceTimersByTimeAsync(STARTUP_PHASE_LIMITS.loadData + STARTUP_PHASE_LIMITS.wallpaperTone);
      await done;
      expect(steps).toEqual(['ready']);
      expect(log.warn).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
