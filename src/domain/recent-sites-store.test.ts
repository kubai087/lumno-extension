import { describe, expect, it } from 'vitest';
import { normalizeHiddenRecentSites, normalizePinnedRecentSites, normalizeRecentCount } from './recent-sites-store';

const options = {
  normalizeHost: (host: string) => String(host || '').toLowerCase().replace(/^www\./, ''),
  sanitizeDisplayText: (text: unknown) => String(text || '').trim(),
  getSiteDisplayName: (host: string) => host.split('.')[0]
};

describe('recent sites store', () => {
  it('reads the card count in rows of four, four by default', () => {
    expect(normalizeRecentCount(8)).toBe(8);
    expect(normalizeRecentCount('0')).toBe(0);
    expect(normalizeRecentCount(12)).toBe(4);
  });

  it('keeps up to three pinned sites, one per site', () => {
    const pinned = normalizePinnedRecentSites([
      { title: 'A', url: 'https://a.example/' },
      { title: 'A duplicate', url: 'https://a.example/' },
      { title: 'B', url: 'https://b.example/' },
      { title: 'C', url: 'https://c.example/' },
      { title: 'D', url: 'https://d.example/' }
    ], options);

    expect(pinned.map((item) => item.host)).toEqual(['a.example', 'b.example', 'c.example']);
  });

  it('keeps one hidden entry per page, with the visit it was hidden at', () => {
    const hidden = normalizeHiddenRecentSites(['https://hidden.example/a', { url: 'https://hidden.example/a', lastVisitTime: 12 }], options);

    expect(hidden).toHaveLength(1);
    expect(hidden[0].lastVisitTime).toBe(12);
  });

  it('keeps the tracking fields only on a tracked pinned card, and drops an invalid one', () => {
    const [tracked, plain] = normalizePinnedRecentSites([
      { url: 'https://vidhub3.top/vodplay/55357-1-2.html', title: '某剧 第2集', progressTracking: true, progressId: 'p1' },
      { url: 'https://github.com/', title: 'GitHub', progressId: 'p2' }
    ]);

    expect([tracked.progressTracking, tracked.progressId]).toEqual([true, 'p1']);
    expect(plain).not.toHaveProperty('progressTracking');
    expect(plain).not.toHaveProperty('progressId');
    expect(normalizePinnedRecentSites([{ url: '', progressTracking: true }])).toEqual([]);
  });

  it('lets tracked works of a site sit beside one ordinary card for it', () => {
    const pinned = normalizePinnedRecentSites([
      { url: 'https://www.bilibili.com/video/BV11LEA6eEuj?p=2', title: '合集 P2', progressTracking: true, progressId: 'pa' },
      { url: 'https://www.bilibili.com/video/BV1xx411c7mD', title: '另一个合集 第1集', progressTracking: true, progressId: 'pb' },
      { url: 'https://www.bilibili.com/', title: '哔哩哔哩' },
      { url: 'https://www.bilibili.com/anime/', title: '番剧' }
    ], { maxPinned: 5 });

    expect(pinned.map((item) => item.url)).toEqual([
      'https://www.bilibili.com/video/BV11LEA6eEuj?p=2',
      'https://www.bilibili.com/video/BV1xx411c7mD',
      'https://www.bilibili.com/'
    ]);
  });
});
