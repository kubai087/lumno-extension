import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MODES, create, getNextMode, normalizeMode } from './web-appearance';

interface FirefoxSettingOptions {
  userValue?: string;
  levelOfControl?: string;
}

// Firefox's overrideContentColorScheme: the user's own choice, which an
// extension's value overrides until the extension clears it.
function createFirefoxSetting(options: FirefoxSettingOptions = {}) {
  const state: { userValue: string; extensionValue: string | null; levelOfControl: string } = {
    userValue: options.userValue || 'auto',
    extensionValue: null,
    levelOfControl: options.levelOfControl || 'controllable_by_this_extension'
  };
  const setValues: string[] = [];
  const setting = {
    get: () => Promise.resolve({
      value: state.extensionValue !== null ? state.extensionValue : state.userValue,
      levelOfControl: state.extensionValue !== null ? 'controlled_by_this_extension' : state.levelOfControl
    }),
    set: (details: { value: string }) => {
      setValues.push(details.value);
      if (state.levelOfControl === 'controlled_by_other_extensions') return Promise.resolve(false);
      if (!['auto', 'light', 'dark'].includes(details.value)) {
        return Promise.reject(new Error(`${details.value} is not a valid value for overrideContentColorScheme.`));
      }
      state.extensionValue = details.value;
      return Promise.resolve(true);
    },
    clear: () => {
      const cleared = state.extensionValue !== null;
      state.extensionValue = null;
      return Promise.resolve(cleared);
    }
  };
  return { state, setValues, browserApi: { browserSettings: { overrideContentColorScheme: setting } } };
}

describe('website appearance', () => {
  it('cycles automatic, light and dark, and knows no other mode', () => {
    expect(Array.from(MODES)).toEqual(['auto', 'light', 'dark']);
    expect(getNextMode('auto')).toBe('light');
    expect(getNextMode('light')).toBe('dark');
    expect(getNextMode('dark')).toBe('auto');
    expect(normalizeMode('system')).toBe('');
    expect(normalizeMode('sepia')).toBe('');
  });

  it('is unsupported without the Firefox setting', async () => {
    const appearance = create({ browserApi: {} });

    expect(await appearance.getState()).toEqual({ supported: false, mode: 'auto', controllable: false });
    expect(await appearance.setMode('dark')).toEqual({ ok: false, reason: 'unsupported' });
  });

  it("sets light and dark as Lumno's value and hands automatic back to an automatic user choice", async () => {
    const firefox = createFirefoxSetting({ userValue: 'auto' });
    const appearance = create({ browserApi: firefox.browserApi });

    expect(await appearance.getState()).toEqual({ supported: true, mode: 'auto', controllable: true });
    expect(await appearance.setMode('dark')).toEqual({ ok: true, mode: 'dark', controllable: true });
    expect(firefox.state.extensionValue).toBe('dark');
    expect(await appearance.setMode('light')).toEqual({ ok: true, mode: 'light', controllable: true });
    expect(await appearance.setMode('auto')).toEqual({ ok: true, mode: 'auto', controllable: true });
    expect(firefox.state.extensionValue).toBeNull();
    expect(firefox.setValues).not.toContain('auto');
    expect(await appearance.setMode('sepia')).toEqual({ ok: false, reason: 'invalid-mode' });
  });

  it("sets automatic over a user's own dark choice", async () => {
    const firefox = createFirefoxSetting({ userValue: 'dark' });
    const appearance = create({ browserApi: firefox.browserApi });
    await appearance.setMode('light');

    expect(await appearance.setMode('auto')).toEqual({ ok: true, mode: 'auto', controllable: true });
    expect(firefox.state.extensionValue).toBe('auto');
  });

  it('reports the value that stayed while another extension holds the setting', async () => {
    const firefox = createFirefoxSetting({ userValue: 'light', levelOfControl: 'controlled_by_other_extensions' });
    const appearance = create({ browserApi: firefox.browserApi });

    expect(await appearance.getState()).toEqual({ supported: true, mode: 'light', controllable: false });
    expect(await appearance.setMode('dark')).toEqual({ ok: false, mode: 'light', controllable: false });
  });

  it('answers its messages asynchronously', async () => {
    const appearance = create({ browserApi: createFirefoxSetting({ userValue: 'light' }).browserApi });
    const handlers = appearance.messageHandlers;
    const ask = (send: (reply: (response: unknown) => void) => unknown) => new Promise((resolveReply) => {
      expect(send(resolveReply)).toBe(true);
    });

    expect(await ask((reply) => handlers.getWebAppearance({ action: 'getWebAppearance' }, {}, reply)))
      .toEqual({ supported: true, mode: 'light', controllable: true });
    expect(await ask((reply) => handlers.setWebAppearance({ action: 'setWebAppearance', mode: 'dark' }, {}, reply)))
      .toEqual({ ok: true, mode: 'dark', controllable: true });
  });

  it('does not ask for browserSettings in the Chromium package', () => {
    const manifest: unknown = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../manifest.json'), 'utf8'));
    const permissions: unknown = manifest && typeof manifest === 'object' ? Reflect.get(manifest, 'permissions') : undefined;

    expect(permissions).toEqual(expect.any(Array));
    expect(permissions).not.toContain('browserSettings');
  });
});
