import { describe, expect, it } from 'vitest';
import { BROWSER_SYNC_KEYS } from './registry';
import { NEWTAB_QUOTE_FONTS, newtabQuotePrefs, quoteCache } from './newtab-quote';
import { bingCatalogCache, bingDailyCache } from './newtab-wallpaper';

// The daily quote's preferences, and the caches that stay on this device.
describe('New Tab quote preferences', () => {
  it('fills what is missing or invalid and stays off unless turned on', () => {
    const defaults = { enabled: false, position: 'search', category: 'literature', fontSize: 15, provider: 'hitokoto', font: 'wenkai' };

    expect(newtabQuotePrefs.parse({ position: 'bogus', category: 'invalid' })).toEqual(defaults);
    expect(newtabQuotePrefs.parse({ position: 'bottom', category: 'poetry', fontSize: 20 }))
      .toEqual({ ...defaults, position: 'bottom', category: 'poetry', fontSize: 20 });
    expect(newtabQuotePrefs.parse({ enabled: true, position: 'bottom', category: 'poetry', fontSize: 20 }))
      .toEqual({ ...defaults, enabled: true, position: 'bottom', category: 'poetry', fontSize: 20 });
    expect(newtabQuotePrefs.parse({ enabled: false, position: 'bottom', category: 'poetry', fontSize: 20 }))
      .toEqual({ ...defaults, position: 'bottom', category: 'poetry', fontSize: 20 });
  });

  it('keeps the font size between 12 and 24, 15 by default', () => {
    expect(newtabQuotePrefs.parse({ fontSize: '' }).fontSize).toBe(15);
    expect(newtabQuotePrefs.parse({ fontSize: null }).fontSize).toBe(15);
    expect(newtabQuotePrefs.parse({ fontSize: 8 }).fontSize).toBe(12);
    expect(newtabQuotePrefs.parse({ fontSize: '30' }).fontSize).toBe(24);
  });

  it('reads a known face, WenKai otherwise', () => {
    expect(newtabQuotePrefs.parse({ font: 'xiaowei' }).font).toBe('xiaowei');
    expect(newtabQuotePrefs.parse({ font: 'sans' }).font).toBe('sans');
    expect(newtabQuotePrefs.parse({ font: 'comic-sans' }).font).toBe('wenkai');
    expect(NEWTAB_QUOTE_FONTS.map((font) => font.id)).toEqual(['wenkai', 'xiaowei', 'sans']);
  });

  it('syncs the preferences and keeps the fetched content on this device', () => {
    expect(BROWSER_SYNC_KEYS).toContain(newtabQuotePrefs.key);
    [quoteCache.key, bingCatalogCache.key, bingDailyCache.key].forEach((key) => expect(BROWSER_SYNC_KEYS).not.toContain(key));
  });
});
