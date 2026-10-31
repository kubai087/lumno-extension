import { describe, expect, it } from 'vitest';
import * as settings from '../settings';
import { LOCAL_PREFERENCE_KEYS, PREFERENCE_KEYS, selectPreferences, writerKnows } from './state-base';

describe('WebDAV bookmark preferences', () => {
  it('includes the bar layout and material without including the legacy color', () => {
    const values = {
      [settings.bookmarkTopbarLayout.key]: 'floating',
      [settings.bookmarkTopbarSurfaceMode.key]: 'custom',
      [settings.bookmarkTopbarSurfaceColorLight.key]: '#112233',
      [settings.bookmarkTopbarSurfaceColorDark.key]: '#445566',
      [settings.bookmarkTopbarSurfaceColorLegacy.key]: '#778899'
    };
    expect(LOCAL_PREFERENCE_KEYS).not.toContain(settings.bookmarkTopbarLayout.key);
    expect(PREFERENCE_KEYS).toContain(settings.bookmarkTopbarLayout.key);
    expect(selectPreferences(values)).toEqual({
      [settings.bookmarkTopbarLayout.key]: 'floating',
      [settings.bookmarkTopbarSurfaceMode.key]: 'custom',
      [settings.bookmarkTopbarSurfaceColorLight.key]: '#112233',
      [settings.bookmarkTopbarSurfaceColorDark.key]: '#445566'
    });
    expect(writerKnows({ keys: undefined }, settings.bookmarkTopbarLayout.key)).toBe(false);
  });
});
