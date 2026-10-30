import { describe, expect, it } from 'vitest';
import { mergeRecentSiteSources, mergeRecentSitesWithPinned } from './recent-sites-merge';

const options = {
  normalizeHost: (host: string) => String(host || '').toLowerCase().replace(/^www\./, ''),
  sanitizeDisplayText: (text: unknown) => String(text || '').trim(),
  getSiteDisplayName: (host: string) => host.split('.')[0],
  shouldExcludeUrl: (url: string) => String(url || '').startsWith('chrome-extension://')
};

// A sanitizer that counts what it normalizes.
function countingSanitizer() {
  const counter = { count: 0, sanitizeDisplayText: (value: unknown) => {
    counter.count += 1;
    return String(value || '').trim();
  } };
  return counter;
}

describe('merging recent sites', () => {
  it('puts pinned sites first, then one card per site from history, top sites and tabs, leaving hidden ones out', () => {
    const merged = mergeRecentSiteSources({
      ...options,
      mode: 'latest',
      limit: 4,
      pinned: [{ title: 'Pinned', url: 'https://pinned.example/a', lastVisitTime: 2 }],
      hidden: [{ url: 'https://hidden.example/a', lastVisitTime: 10 }],
      historyItems: [
        { title: 'Hidden', url: 'https://hidden.example/a', lastVisitTime: 5 },
        { title: 'Recent', url: 'https://recent.example/a', lastVisitTime: 8 }
      ],
      topSites: [{ title: 'Top', url: 'https://top.example/' }],
      tabs: [
        { title: 'Tab', url: 'https://tab.example/', lastAccessed: 9 },
        { title: 'Duplicate recent tab', url: 'https://recent.example/other', lastAccessed: 10 }
      ]
    });

    expect(merged.map((item) => item.host)).toEqual(['pinned.example', 'recent.example', 'top.example', 'tab.example']);
    expect(merged[0]).toMatchObject({ _xPinned: true });
  });

  it('keeps browser pages from open tabs past a full history candidate set, but not New Tab', () => {
    const merged = mergeRecentSiteSources({
      ...options,
      mode: 'latest',
      limit: 4,
      candidateLimit: 4,
      pinned: [],
      hidden: [],
      shouldExcludeUrl: (url) => String(url || '') === 'chrome://newtab/',
      shouldPrioritizeTabUrl: (url) => String(url || '').startsWith('chrome://') && String(url || '') !== 'chrome://newtab/',
      historyItems: [
        { title: 'One', url: 'https://one.example/', lastVisitTime: 20 },
        { title: 'Two', url: 'https://two.example/', lastVisitTime: 19 },
        { title: 'Three', url: 'https://three.example/', lastVisitTime: 18 },
        { title: 'Four', url: 'https://four.example/', lastVisitTime: 17 }
      ],
      tabs: [
        { title: '新标签页', url: 'chrome://newtab/', lastAccessed: 30 },
        { title: '扩展程序', url: 'chrome://extensions/', lastAccessed: 31 }
      ]
    });

    expect(merged.some((item) => item.url === 'chrome://extensions/')).toBe(true);
    expect(merged.some((item) => item.url === 'chrome://newtab/')).toBe(false);
  });

  it('fills a short top sites list from history ranked by visits per site', () => {
    const merged = mergeRecentSiteSources({
      ...options,
      mode: 'most',
      limit: 6,
      candidateLimit: 6,
      pinned: [],
      hidden: [],
      topSites: [
        { title: 'Bing', url: 'https://www.bing.com/' },
        { title: 'Bing search', url: 'https://www.bing.com/search?q=a' },
        { title: 'GitHub', url: 'https://github.com/' },
        { title: 'MSN', url: 'https://www.msn.com/' }
      ],
      historyItems: [
        { title: 'Rare', url: 'https://rare.example/', visitCount: 1, lastVisitTime: 50 },
        { title: 'Docs A', url: 'https://docs.example/a', visitCount: 4, lastVisitTime: 40 },
        { title: 'GitHub repo', url: 'https://github.com/lumno', visitCount: 30, lastVisitTime: 35 },
        { title: 'Mail', url: 'https://mail.example/', visitCount: 6, lastVisitTime: 30 },
        { title: 'Docs B', url: 'https://docs.example/b', visitCount: 5, lastVisitTime: 20 }
      ]
    });

    expect(merged.map((item) => item.host)).toEqual(['bing.com', 'github.com', 'msn.com', 'docs.example', 'mail.example', 'rare.example']);
    expect(merged[3].url).toBe('https://docs.example/b');
  });

  it('ranks most visited by summed visits rather than recency without top sites', () => {
    const merged = mergeRecentSiteSources({
      ...options,
      mode: 'most',
      limit: 3,
      candidateLimit: 3,
      pinned: [],
      hidden: [],
      topSites: [],
      historyItems: [
        { title: 'Latest', url: 'https://latest.example/', visitCount: 2, lastVisitTime: 90 },
        { title: 'Busy page 1', url: 'https://busy.example/1', visitCount: 3, lastVisitTime: 80 },
        { title: 'Steady', url: 'https://steady.example/', visitCount: 7, lastVisitTime: 70 },
        { title: 'Busy page 2', url: 'https://busy.example/2', visitCount: 6, lastVisitTime: 60 },
        { title: 'Unvisited', url: 'https://unvisited.example/', lastVisitTime: 50 }
      ]
    });

    expect(merged.map((item) => item.host)).toEqual(['busy.example', 'steady.example', 'latest.example']);
  });

  it('stops normalizing candidates once the visible limit is full', () => {
    const sanitizer = countingSanitizer();
    const merged = mergeRecentSitesWithPinned(
      Array.from({ length: 10_000 }, (_, index) => ({ title: `Candidate ${index}`, url: `https://candidate-${index}.example/` })),
      [],
      [],
      8,
      { sanitizeDisplayText: sanitizer.sanitizeDisplayText }
    );

    expect(merged).toHaveLength(8);
    expect(sanitizer.count).toBe(16);
  });

  it('normalizes each visible source candidate once and stops when the result is full', () => {
    const sanitizer = countingSanitizer();
    const merged = mergeRecentSiteSources({
      mode: 'latest',
      limit: 8,
      candidateLimit: 10_000,
      pinned: [],
      hidden: [],
      historyItems: Array.from({ length: 10_000 }, (_, index) => ({
        title: `History ${index}`,
        url: `https://history-${index}.example/`,
        lastVisitTime: 10_000 - index
      })),
      sanitizeDisplayText: sanitizer.sanitizeDisplayText
    });

    expect(merged).toHaveLength(8);
    expect(sanitizer.count).toBe(16);
  });

  it('counts hidden and pinned duplicates against the source candidate budget', () => {
    const sanitizer = countingSanitizer();
    const merged = mergeRecentSiteSources({
      mode: 'latest',
      limit: 4,
      candidateLimit: 4,
      pinned: [{ title: 'Pinned', url: 'https://candidate-0.example/' }],
      hidden: [
        { url: 'https://candidate-1.example/', lastVisitTime: 100 },
        { url: 'https://candidate-2.example/', lastVisitTime: 100 }
      ],
      historyItems: Array.from({ length: 6 }, (_, index) => ({
        title: `Candidate ${index}`,
        url: `https://candidate-${index}.example/`,
        lastVisitTime: 10 - index
      })),
      sanitizeDisplayText: sanitizer.sanitizeDisplayText
    });

    expect(merged.map((item) => item.host)).toEqual(['candidate-0.example', 'candidate-3.example']);
    // One pinned item and no more than four source candidates.
    expect(sanitizer.count).toBe(10);
  });
});
