import { describe, expect, it, vi } from 'vitest';
import { QuickNavigation } from './quick-navigation';

// The search panels' keyword rows ("ext" opens the extensions page) point at
// the browser the page runs in, and only for the word on its own.
function keywordRowsIn(userAgent: string, input: string) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
  const navigation = new QuickNavigation({
    locale: {
      formatMessage: (_key: string, fallback: string, values?: Record<string, string>) =>
        fallback.replace(/\{(\w+)\}/g, (_match, name: string) => (values ? values[name] : ''))
    },
    getFaviconUrl: () => ''
  });
  const rules = [{ type: 'browserPage', keys: ['ext '], path: 'extensions' }];
  return navigation.keywordRows(input, rules).map((row) => ({ url: row.url, title: row.title }));
}

describe('quick navigation keyword rows', () => {
  it('opens the browser page under the running browser and names it', () => {
    expect(keywordRowsIn('Mozilla/5.0 Chrome/149 Safari/537.36 Edg/149', 'ext'))
      .toEqual([{ url: 'edge://extensions', title: '打开 Microsoft Edge：edge://extensions' }]);
    expect(keywordRowsIn('Mozilla/5.0 Chrome/149 Safari/537.36', 'ext').map((row) => row.url))
      .toEqual(['chrome://extensions']);
  });

  it('offers no page for a query that only starts with a rule word', () => {
    expect(keywordRowsIn('Mozilla/5.0 Chrome/149 Safari/537.36', 'ext lumno')).toEqual([]);
  });
});
