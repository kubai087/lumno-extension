import { describe, expect, it } from 'vitest';
import { createSystemTheme, resolveThemeMode } from './system-theme';

type Api = 'event-target' | 'legacy' | 'none';

// A MediaQueryList offering only the listener API an engine has.
function createQueryList(matches: boolean, api: Api) {
  const listeners = new Set<unknown>();
  const types: string[] = [];
  const queryList: MediaQueryList = {
    matches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    dispatchEvent: () => true,
    addEventListener(type: string, listener: unknown) {
      types.push(type);
      listeners.add(listener);
    },
    removeEventListener(type: string, listener: unknown) {
      types.push(type);
      listeners.delete(listener);
    },
    addListener: (listener: unknown) => listeners.add(listener),
    removeListener: (listener: unknown) => listeners.delete(listener)
  };
  const missing = api === 'event-target' ? ['addListener', 'removeListener']
    : api === 'legacy' ? ['addEventListener', 'removeEventListener']
      : ['addListener', 'removeListener', 'addEventListener', 'removeEventListener'];
  missing.forEach((name) => Object.defineProperty(queryList, name, { value: undefined }));
  return { queryList, listeners, types };
}

describe('system theme', () => {
  it('resolves a fixed mode to itself and system to the preference', () => {
    expect(resolveThemeMode('dark', false)).toBe('dark');
    expect(resolveThemeMode('light', true)).toBe('light');
    expect(resolveThemeMode('system', true)).toBe('dark');
    expect(resolveThemeMode('system', false)).toBe('light');
  });

  it('follows the dark color scheme query unless the caller passes the match', () => {
    const queries: string[] = [];
    const theme = createSystemTheme({
      matchMedia(query: string) {
        queries.push(query);
        return createQueryList(true, 'event-target').queryList;
      }
    });

    expect(queries).toEqual(['(prefers-color-scheme: dark)']);
    expect(theme.resolveTheme('system')).toBe('dark');
    expect(theme.resolveTheme('system', false)).toBe('light');
    expect(theme.resolveTheme('light', true)).toBe('light');
  });

  it.each<Api>(['event-target', 'legacy'])('adds and removes a change listener on a list with the %s API', (api) => {
    const { queryList, listeners, types } = createQueryList(false, api);
    const theme = createSystemTheme({ matchMedia: () => queryList });
    const listener = () => {};

    expect(theme.addMediaQueryChangeListener(queryList, listener)).toBe(true);
    expect(listeners.has(listener)).toBe(true);
    theme.removeMediaQueryChangeListener(queryList, listener);
    expect(listeners.size).toBe(0);
    types.forEach((type) => expect(type).toBe('change'));
  });

  it('reports a list with neither listener API', () => {
    const { queryList } = createQueryList(false, 'none');
    const theme = createSystemTheme({ matchMedia: () => queryList });
    const listener = () => {};

    expect(theme.addMediaQueryChangeListener(queryList, listener)).toBe(false);
    expect(() => theme.removeMediaQueryChangeListener(queryList, listener)).not.toThrow();
  });
});
