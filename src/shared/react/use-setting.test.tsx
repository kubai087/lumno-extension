import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { defineSetting } from '../../domain/settings/define';
import type { Setting } from '../../domain/settings/define';
import { oneOf } from '../../domain/settings/schema';
import { useSetting } from './use-setting';

const theme = defineSetting({ key: 'test_theme', area: 'preferences', sync: 'browser', schema: oneOf(['light', 'dark', 'system'] as const, 'system') });

// A settings store whose first read lands when the test says so, telling
// no subscriber, as the real store's first read does.
function createSource() {
  let stored: unknown;
  let finishRead: () => void = () => {};
  const read = new Promise<void>((resolve) => {
    finishRead = resolve;
  });
  const listeners = new Set<(setting: Setting<unknown>) => void>();
  return {
    source: {
      subscribe: (_settings: unknown, listener: (setting: Setting<unknown>) => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      getStored: () => stored,
      include: () => read
    },
    land(value: unknown) {
      stored = value;
      finishRead();
    },
    change(value: unknown) {
      stored = value;
      listeners.forEach((listener) => listener(theme));
    }
  };
}

function Theme({ source }: { source: ReturnType<typeof createSource>['source'] }) {
  return <span>{useSetting(source, theme)}</span>;
}

afterEach(() => {
  document.body.textContent = '';
});

describe('useSetting', () => {
  it('draws the default, then the first read, then later changes', async () => {
    const { source, land, change } = createSource();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<Theme source={source} />);
    });
    expect(host.textContent).toBe('system');
    await act(async () => {
      land('dark');
    });
    expect(host.textContent).toBe('dark');
    act(() => change('light'));
    expect(host.textContent).toBe('light');
    act(() => root.unmount());
  });
});
