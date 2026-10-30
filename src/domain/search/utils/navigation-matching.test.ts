import { describe, expect, it } from 'vitest';
import { buildTabMatchUrl, findSearchOpenTabMatchIndex, isDirectNavigationMatch, promoteStrongNavigationMatch } from './navigation-matching';

describe('navigation matching', () => {
  it("promotes the representative page of a strong navigation match", () => {
    const navList = [
      { type: 'history', title: 'Example Blog Detail', url: 'https://example.com/blog/detail' },
      { type: 'history', title: 'Example Home', url: 'https://example.com/' }
    ];
    const promoted = promoteStrongNavigationMatch(navList, 'example');
    expect(promoted?.title, 'strong navigation promotion should choose representative pages').toBe('Example Home');
    expect(navList[0].title, 'strong navigation promotion should mutate the list consistently').toBe('Example Home');
  });

  it("keeps the port of a numeric address when matching open tabs", () => {
    expect(buildTabMatchUrl('http://127.0.0.1:8765/'), 'open-tab matching should preserve an explicit numeric-IP port').toBe('127.0.0.1:8765/');
    expect(buildTabMatchUrl('http://127.0.0.1:8765/'), 'numeric-IP URLs on different ports should not match the same open tab').not.toBe(buildTabMatchUrl('https://127.0.0.1:5173/'));
    expect(buildTabMatchUrl('http://127.0.0.1:8765/path?mode=one', { includeSearch: false }), 'current-page matching may ignore the query while still preserving the port').toBe('127.0.0.1:8765/path');
  });

  it("matches a complex typed URL to its own row, not to an unrelated open tab, and survives a failing resolver", () => {

    function testDirectNavigationUrl(input: unknown): string {
      const raw = String(input || '').trim();
      if (!raw || /\s/.test(raw) || !raw.includes('.')) {
        return '';
      }
      return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    }

    const complexUrlInput = 'apps.apple.com/cn/app/%E6%97%A5%E8%BF%99%E9%94%81%E5%B1%8F';
    const unrelatedOpenTabSuggestion = {
      type: 'history',
      title: '(1) App Store / X',
      url: 'https://x.com/i/bookmarks/2057032873014652963',
      _xMatchedTabId: 42
    };
    const directComplexUrlSuggestion = {
      type: 'directUrl',
      title: `打开 https://${complexUrlInput}`,
      url: `https://${complexUrlInput}`
    };
    expect(isDirectNavigationMatch(unrelatedOpenTabSuggestion, complexUrlInput, {
        getDirectNavigationUrl: testDirectNavigationUrl
      }), 'unrelated open tabs should not be treated as matches for a complex URL input').toBe(false);
    expect(isDirectNavigationMatch(directComplexUrlSuggestion, complexUrlInput, {
        getDirectNavigationUrl: testDirectNavigationUrl
      }), 'the direct open-url suggestion should be treated as the URL navigation match').toBe(true);
    const complexNavigationList = [unrelatedOpenTabSuggestion, directComplexUrlSuggestion];
    const complexPromoted = promoteStrongNavigationMatch(complexNavigationList, complexUrlInput, {
      getDirectNavigationUrl: testDirectNavigationUrl
    });
    expect(complexPromoted?.url, 'complex URL navigation promotion should choose the direct open-url suggestion over unrelated open tabs').toBe(directComplexUrlSuggestion.url);
    expect(findSearchOpenTabMatchIndex([
        directComplexUrlSuggestion,
        unrelatedOpenTabSuggestion
      ], {
        rawQuery: complexUrlInput,
        primaryHighlightIndex: 0,
        openTabQuickSwitchEnabled: true,
        getDirectNavigationUrl: testDirectNavigationUrl
      }), 'open-tab promotion should not override a direct URL primary with an unrelated open tab').toEqual({ index: -1, reason: '' });
    expect(findSearchOpenTabMatchIndex([
        { ...directComplexUrlSuggestion, _xMatchedTabId: 99 },
        unrelatedOpenTabSuggestion
      ], {
        rawQuery: complexUrlInput,
        primaryHighlightIndex: 0,
        openTabQuickSwitchEnabled: true,
        getDirectNavigationUrl: testDirectNavigationUrl
      }), 'open-tab promotion should still recognize an already-open exact URL navigation match').toEqual({ index: 0, reason: 'openTab' });
    expect(findSearchOpenTabMatchIndex([
        { type: 'newtab', title: 'Search', url: 'https://example.com/?q=github' },
        unrelatedOpenTabSuggestion
      ], {
        rawQuery: 'github',
        primaryHighlightIndex: -1,
        openTabQuickSwitchEnabled: true,
        getDirectNavigationUrl: testDirectNavigationUrl
      }), 'open-tab promotion should continue to work for non-URL queries').toEqual({ index: 1, reason: 'openTab' });
    expect(
      () => findSearchOpenTabMatchIndex([
        directComplexUrlSuggestion,
        unrelatedOpenTabSuggestion
      ], {
        rawQuery: complexUrlInput,
        primaryHighlightIndex: 0,
        openTabQuickSwitchEnabled: true,
        getDirectNavigationUrl: () => {
          throw new Error('resolver unavailable');
        }
      }), 'open-tab promotion should not break overlay rendering when direct URL resolution fails').not.toThrow();


  });

});
