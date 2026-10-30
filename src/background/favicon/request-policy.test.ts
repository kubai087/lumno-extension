import { Blob } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';
import { faviconEnhancedFetchEnabled, faviconRequestBlacklist } from '../../domain/settings';
import { installWorkerFake } from '../../../tests/fakes/worker';

// The worker's favicon and theme-color reads under the favicon exclusion list
// and the enhanced-fetch setting, over a network that records every request.

const EXTENSION_FAVICON = 'chrome-extension://lumno-test/_favicon/';
const PNG_DATA = 'data:image/png;base64,AQIDBA==';
const EXCLUSIONS = [
  { pattern: 'blocked.example.com', matchModes: ['suffix'] },
  { pattern: 'vpn.example.com/private', matchModes: ['prefix'] },
  { pattern: 'exact.example.com/only-this', matchModes: ['exact'] }
];

function extensionFavicon(pageUrl: string, size = false): string {
  return `${EXTENSION_FAVICON}?pageUrl=${encodeURIComponent(pageUrl)}${size ? '&size=128' : ''}&fallbackToHost=0`;
}

function gstaticFavicon(pageUrl: string): string {
  return `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=${encodeURIComponent(pageUrl)}&size=128`;
}

interface FaviconWorkerOptions {
  blacklist?: unknown[];
  enhanced?: boolean;
  // The browser's default globe for an unknown page looks like every icon.
  globeMatchesIcons?: boolean;
}

async function startFavicons(options: FaviconWorkerOptions = {}) {
  installWorkerFake({
    sync: {
      [faviconRequestBlacklist.key]: options.blacklist || [],
      [faviconEnhancedFetchEnabled.key]: options.enhanced !== false
    }
  });
  const calls: { url: string; redirect?: RequestRedirect }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, redirect: init && init.redirect });
    const globe = url.includes('lumno.invalid') && !options.globeMatchesIcons;
    return {
      ok: true,
      url,
      text: async () => '<html><meta name="theme-color" content="#123456"></html>',
      blob: async () => new Blob([Uint8Array.from(globe ? [9, 9, 9, 9] : [1, 2, 3, 4])], { type: 'image/png' })
    };
  }));
  const policy = await import('./request-policy');
  const { resolveFaviconCandidates } = await import('./candidates');
  const { fetchFaviconData } = await import('./favicon-data');
  const { resolveSiteThemeColor } = await import('./site-theme-color');
  await policy.loadFaviconRequestBlacklistItems();
  await policy.loadFaviconEnhancedFetchEnabled();
  calls.length = 0;
  return {
    calls,
    candidates: resolveFaviconCandidates,
    themeColor: resolveSiteThemeColor,
    data: fetchFaviconData,
    pageFetches: () => calls.filter((call) => !call.url.startsWith(EXTENSION_FAVICON) && !call.url.includes('gstatic'))
  };
}

describe('favicon request exclusions', () => {
  it('match by their mode, without fetching anything', async () => {
    const worker = await startFavicons({ blacklist: EXCLUSIONS });
    const excluded = async (pageUrl: string) => {
      const candidates = await worker.candidates(pageUrl, '', '');
      return candidates.length === 1 && candidates[0] === extensionFavicon(pageUrl, true);
    };

    expect(await excluded('https://foo.blocked.example.com/path')).toBe(true);
    expect(await excluded('https://vpn.example.com/private/doc')).toBe(true);
    expect(await excluded('https://exact.example.com/only-this')).toBe(true);
    expect(await excluded('https://exact.example.com/only-this/child')).toBe(false);
    expect(await excluded('https://public.example.com/path')).toBe(false);
    expect(worker.calls).toEqual([]);
  });

  it("leave an excluded page only the browser's own favicon cache", async () => {
    const worker = await startFavicons({ blacklist: EXCLUSIONS });

    expect(await worker.themeColor('https://foo.blocked.example.com/page', '', 'dark')).toBeNull();
    expect(await worker.data('https://foo.blocked.example.com/favicon.ico')).toBeNull();
    expect(await worker.data(`https://t2.gstatic.cn/faviconV2?url=${encodeURIComponent('https://foo.blocked.example.com/page')}`)).toBeNull();
    expect(worker.calls).toEqual([]);

    expect(await worker.data(`${EXTENSION_FAVICON}?pageUrl=${encodeURIComponent('https://foo.blocked.example.com/page')}`)).toBe(PNG_DATA);
    expect(worker.calls.map((call) => call.url)).toEqual([
      extensionFavicon('https://foo.blocked.example.com/page'),
      extensionFavicon('https://lumno.invalid/__favicon_placeholder_probe__')
    ]);
  });

  it("count the browser's default globe as no icon, so surfaces show their fallback", async () => {
    const worker = await startFavicons({ globeMatchesIcons: true });

    expect(await worker.data(`${EXTENSION_FAVICON}?pageUrl=${encodeURIComponent('https://never-visited.example/')}`)).toBeNull();
  });

  it.each([true, false])('never fetch a public or local site directly (enhanced fetching %s)', async (enhanced) => {
    const worker = await startFavicons({ blacklist: EXCLUSIONS, enhanced });

    expect(await worker.candidates('https://public.example.com/page', '', 'https://public.example.com/favicon.ico'))
      .toEqual([extensionFavicon('https://public.example.com/page', true), gstaticFavicon('https://public.example.com/')]);
    expect(await worker.candidates('http://192.168.1.8/dashboard', '', 'http://192.168.1.8/favicon.ico'))
      .toEqual([extensionFavicon('http://192.168.1.8/dashboard', true), gstaticFavicon('http://192.168.1.8/')]);
    expect(await worker.themeColor('https://public.example.com/page', '', 'light')).toBeNull();
    expect(await worker.themeColor('http://192.168.1.8/dashboard', '', 'dark')).toBeNull();
    expect(await worker.data('https://public.example.com/favicon.ico')).toBeNull();
    expect(worker.pageFetches()).toEqual([]);

    expect(await worker.data('https://t2.gstatic.cn/faviconV2?url=https%3A%2F%2Fpublic.example.com%2Fpage', 'https://public.example.com/page'))
      .toBe(PNG_DATA);
    expect(worker.calls[worker.calls.length - 1].redirect).toBe('error');
  });

  it('on one path leave the rest of the site its favicon service, but never its own icon file', async () => {
    const privatePage = 'https://foo.example.com/private';
    const publicPage = 'https://foo.example.com/public';
    const rootIcon = 'https://foo.example.com/favicon.ico';
    const worker = await startFavicons({ blacklist: [{ pattern: 'foo.example.com/private', matchModes: ['prefix'] }] });

    expect(await worker.themeColor(privatePage, '', 'dark')).toBeNull();
    expect(await worker.candidates(privatePage, '', rootIcon)).toEqual([extensionFavicon(privatePage, true)]);
    expect(await worker.data(rootIcon, privatePage)).toBeNull();
    expect(worker.calls).toEqual([]);

    const publicCandidates = await worker.candidates(publicPage, '', rootIcon);
    expect(publicCandidates).not.toContain(rootIcon);
    expect(publicCandidates).toContainEqual(expect.stringContaining('gstatic.cn/faviconV2'));
    expect(await worker.data(rootIcon, publicPage)).toBeNull();
    expect(worker.pageFetches()).toEqual([]);
  });
});

describe('cached favicon bytes', () => {
  it('stay with their page, and old host-fallback or chrome://favicon2 sources are read for the exact page', async () => {
    const worker = await startFavicons();
    const dashboardPage = 'https://chrome.google.com/webstore/devconsole?hl=zh-CN';
    const rootSource = `${EXTENSION_FAVICON}?pageUrl=${encodeURIComponent('https://chrome.google.com/')}`;
    const lastIconRequest = () => new URL(worker.calls.filter((call) => !call.url.includes('lumno.invalid')).slice(-1)[0].url);

    expect(await worker.data(rootSource)).toBe(PNG_DATA);
    const callsBefore = worker.calls.length;
    expect(await worker.data(rootSource, dashboardPage)).toBeNull();
    expect(worker.calls).toHaveLength(callsBefore);

    expect(await worker.data(`${EXTENSION_FAVICON}?pageUrl=${encodeURIComponent(dashboardPage)}&fallbackToHost=1`, dashboardPage)).toBe(PNG_DATA);
    expect(lastIconRequest().searchParams.get('fallbackToHost')).toBe('0');
    expect(await worker.data(`chrome://favicon2/?pageUrl=${encodeURIComponent(dashboardPage)}&fallbackToHost=0`, dashboardPage)).toBe(PNG_DATA);
    expect(lastIconRequest().protocol).toBe('chrome-extension:');
    expect(lastIconRequest().searchParams.get('pageUrl')).toBe(dashboardPage);
  });
});
