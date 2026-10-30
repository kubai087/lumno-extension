import { describe, expect, it } from 'vitest';
import { canOpenBrowserPages, getBrowserInternalProfile, getBrowserInternalScheme } from './browser-profile';

describe('browser internal pages', () => {
  it('names the internal scheme of each Chromium browser from its user agent', () => {
    expect(getBrowserInternalScheme('Chrome Edg/123')).toBe('edge://');
    expect(getBrowserInternalScheme('Chrome Brave')).toBe('brave://');
    expect(getBrowserInternalScheme('Vivaldi')).toBe('vivaldi://');
    expect(getBrowserInternalScheme('OPR/99')).toBe('opera://');
    expect(getBrowserInternalScheme('Chrome')).toBe('chrome://');
  });

  it('knows Firefox by its about: pages, which an extension may not open', () => {
    const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:157.0) Gecko/20100101 Firefox/157.0';

    expect(getBrowserInternalProfile({ userAgent })).toEqual({ scheme: 'about:', name: 'Firefox' });
    expect(canOpenBrowserPages('about:')).toBe(false);
    expect(canOpenBrowserPages('chrome://')).toBe(true);
  });

  it('names a Chromium browser by its client hint brand', () => {
    const userAgent = 'Mozilla/5.0 Chrome/149 Safari/537.36';

    expect(getBrowserInternalProfile({
      userAgent,
      userAgentData: {
        brands: [
          { brand: 'Not.A/Brand' },
          { brand: 'Chromium' },
          { brand: 'Dia' }
        ]
      }
    })).toEqual({ scheme: 'chrome://', name: 'Dia' });
    expect(getBrowserInternalProfile({
      userAgent,
      userAgentData: { brands: [{ brand: 'Comet' }, { brand: 'Chromium' }] }
    })).toEqual({ scheme: 'chrome://', name: 'Comet' });
  });

  it('names Edge from its user agent without client hints', () => {
    expect(getBrowserInternalProfile({ userAgent: 'Mozilla/5.0 Chrome Edg/149 Safari/537.36' }))
      .toEqual({ scheme: 'edge://', name: 'Microsoft Edge' });
  });
});
