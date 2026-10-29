// A store that views read (shared/state/store.ts) whose changes are on the
// page when setState returns, so its owner can measure or animate what the
// views drew from it right away.
import { flushSync } from 'react-dom';
import { createStore } from '../state/store';
import type { Store } from '../state/store';

function createViewStore<State extends object>(initial: State): Store<State> {
  const store = createStore(initial);
  return {
    getSnapshot: store.getSnapshot,
    setState(update) {
      flushSync(() => store.setState(update));
    },
    subscribe: store.subscribe
  };
}

export { createViewStore };
