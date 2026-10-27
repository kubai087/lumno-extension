// A piece of state with one owner. The owner changes it with setState; views
// and other parts read a snapshot and subscribe to changes. Snapshots are
// replaced, never changed in place, so a view can compare them by identity.

type StoreListener = () => void;

interface Store<State> {
  getSnapshot(): State;
  setState(update: Partial<State> | ((state: State) => Partial<State>)): void;
  // Returns the unsubscribe.
  subscribe(listener: StoreListener): () => void;
}

function createStore<State extends object>(initial: State): Store<State> {
  let state = initial;
  const listeners = new Set<StoreListener>();
  return {
    getSnapshot: () => state,
    setState(update) {
      const changes = typeof update === 'function' ? update(state) : update;
      const changed = Object.keys(changes).some((key) => (
        !Object.is(Reflect.get(changes, key), Reflect.get(state, key))
      ));
      if (!changed) {
        return;
      }
      state = { ...state, ...changes };
      // A listener added while notifying waits for the next change.
      Array.from(listeners).forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}

export type { Store, StoreListener };
export { createStore };
