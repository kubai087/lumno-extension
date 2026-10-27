// A setting's value in a React view, kept current by the context's settings
// store (platform/settings-store.ts). The view asks the store to read the
// setting, and draws the default until the first read lands.
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { Setting } from '../../domain/settings/define';
import type { SettingsStore } from '../../platform/settings-store';

type SettingSource = Pick<SettingsStore, 'subscribe' | 'getStored' | 'include'>;

export function useSetting<T>(store: SettingSource, setting: Setting<T>): T {
  const subscribe = useCallback((onChange: () => void) => {
    let subscribed = true;
    const unsubscribe = store.subscribe(setting, onChange);
    // A first read tells no subscriber, so the view checks once it lands.
    void store.include(setting).then(() => {
      if (subscribed) onChange();
    });
    return () => {
      subscribed = false;
      unsubscribe();
    };
  }, [store, setting]);
  // The stored value keeps its identity until storage changes, so it is a
  // stable snapshot; the schema reads it once per change.
  const stored = useSyncExternalStore(subscribe, () => store.getStored(setting));
  return useMemo(() => setting.parse(stored), [setting, stored]);
}
