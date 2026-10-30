import { describe, expect, it, vi } from 'vitest';
import { createDirectNavigationSettleController } from './direct-navigation-settle';

interface Context {
  query: string;
  requestSeq: number;
}

function setUp() {
  let nextTimerId = 1;
  const timers = new Map<number, { callback: () => void; delayMs: number }>();
  const clearTimeout = vi.fn((timerId: number) => {
    timers.delete(timerId);
  });
  const settled: Context[] = [];
  const controller = createDirectNavigationSettleController<Context>({
    delayMs: 120,
    setTimeout(callback, delayMs) {
      const timerId = nextTimerId;
      nextTimerId += 1;
      timers.set(timerId, { callback, delayMs });
      return timerId;
    },
    clearTimeout,
    onSettle(context) {
      settled.push(context);
    }
  });
  return { controller, timers, clearTimeout, settled };
}

describe('direct navigation settle', () => {
  it('waits the configured delay before settling', () => {
    const { controller, timers } = setUp();
    controller.schedule({ query: 'first.example', requestSeq: 1 });

    expect(controller.isPending()).toBe(true);
    expect(timers.get(1)?.delayMs).toBe(120);
  });

  it('settles only the latest request when a newer one replaces the wait', () => {
    const { controller, timers, clearTimeout, settled } = setUp();
    controller.schedule({ query: 'first.example', requestSeq: 1 });
    controller.schedule({ query: 'second.example', requestSeq: 2 });

    expect(clearTimeout.mock.calls.map((call) => call[0])).toEqual([1]);
    expect(timers.has(1)).toBe(false);
    timers.get(2)?.callback();
    expect(controller.isPending()).toBe(false);
    expect(settled).toEqual([{ query: 'second.example', requestSeq: 2 }]);
  });

  it('cancels a pending wait and reports when there was none', () => {
    const { controller, timers, settled } = setUp();
    expect(controller.cancel()).toBe(false);

    controller.schedule({ query: 'cancelled.example', requestSeq: 3 });
    expect(controller.cancel()).toBe(true);
    expect(controller.isPending()).toBe(false);
    expect(timers.size).toBe(0);
    expect(settled).toEqual([]);
  });
});
