// A store's state in a React view (shared/state/store.ts), kept current by
// its subscription.
import { useSyncExternalStore } from 'react';
import type { Store } from '../state/store';

export function useStore<State>(store: Store<State>): State {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
