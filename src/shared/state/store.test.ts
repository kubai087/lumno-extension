import { describe, expect, it, vi } from 'vitest';
import { createStore } from './store';

describe('store', () => {
  it('replaces the snapshot on a change and tells its listeners', () => {
    const store = createStore({ count: 0, label: 'a' });
    const before = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState((state) => ({ count: state.count + 1 }));
    expect(store.getSnapshot()).toEqual({ count: 1, label: 'a' });
    expect(store.getSnapshot()).not.toBe(before);
    expect(before.count).toBe(0);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps the snapshot and stays quiet when nothing changes', () => {
    const store = createStore({ count: 1 });
    const before = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState({ count: 1 });
    expect(store.getSnapshot()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it('stops telling a listener once it unsubscribes', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.setState({ count: 2 });
    expect(listener).not.toHaveBeenCalled();
  });
});
