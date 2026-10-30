import { afterEach, describe, expect, it, vi } from 'vitest';
import { listInstalledFonts } from './options-installed-fonts';

const FONTS = [{ fontId: 'Inter', displayName: 'Inter' }, { fontId: 'PingFangSC', displayName: '苹方-简' }];

function stubFontSettings(fontSettings: object | null): void {
  vi.stubGlobal('chrome', {
    runtime: { lastError: null },
    ...(fontSettings ? { fontSettings } : {})
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Options installed fonts', () => {
  it('lists nothing in a browser without the font list, such as Firefox', async () => {
    stubFontSettings(null);
    await expect(listInstalledFonts()).resolves.toEqual([]);
  });

  it('reads the list Chrome answers with a promise, leaving out entries of another shape', async () => {
    stubFontSettings({ getFontList: () => Promise.resolve([...FONTS, { fontId: 'Broken' }, 'Arial']) });
    await expect(listInstalledFonts()).resolves.toEqual(FONTS);
  });

  it('reads the list older builds pass to a callback', async () => {
    stubFontSettings({
      getFontList: (callback?: (fonts: unknown) => void) => {
        if (callback) callback(FONTS);
      }
    });
    await expect(listInstalledFonts()).resolves.toEqual(FONTS);
  });

  it('lists nothing when reading the fonts fails', async () => {
    stubFontSettings({ getFontList: () => Promise.reject(new Error('denied')) });
    await expect(listInstalledFonts()).resolves.toEqual([]);
    stubFontSettings({
      getFontList: () => {
        throw new Error('denied');
      }
    });
    await expect(listInstalledFonts()).resolves.toEqual([]);
  });
});
