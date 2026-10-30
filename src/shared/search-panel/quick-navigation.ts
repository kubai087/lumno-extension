// The rows that open a page without searching: a typed address, and the
// browser pages and sites the shortcut rules name; and the page Enter opens
// for a query that leads straight to one.
import type { ShortcutRule } from '../../domain/messages';
import * as SearchDirectNavigation from '../../domain/search/utils/direct-navigation';
import { shortcutRuleMatches } from '../../domain/shortcut-rules-reader';
import * as BROWSER_PROFILE from '../../platform/browser-profile';
import type { SearchLocale } from './labels';
import { loadShortcutRules } from './shortcut-rules';

interface QuickNavigationRow {
  type: 'browserPage' | 'directUrl';
  title: string;
  url: string;
  favicon: string;
}

interface QuickNavigationOptions {
  locale: Pick<SearchLocale, 'formatMessage'>;
  // The icon the surface shows for a page.
  getFaviconUrl(pageUrl: string): string;
}

class QuickNavigation {
  private readonly options: QuickNavigationOptions;

  constructor(options: QuickNavigationOptions) {
    this.options = options;
  }

  // The rows of the rules the input is a word of.
  readonly keywordRows = (input: string, rules: readonly ShortcutRule[]): QuickNavigationRow[] => {
    const browserProfile = BROWSER_PROFILE.getBrowserInternalProfile(navigator);
    const scheme = browserProfile.scheme;
    const rows: QuickNavigationRow[] = [];
    rules.forEach((rule) => {
      if (!rule || !shortcutRuleMatches(rule, input)) {
        return;
      }
      if (rule.type === 'browserPage' && rule.path) {
        if (!BROWSER_PROFILE.canOpenBrowserPages(scheme)) {
          return;
        }
        const url = `${scheme}${rule.path}`;
        rows.push(this.row('browserPage', url, browserProfile.name
          ? this.options.locale.formatMessage('open_browser_url', '打开 {browser}：{url}', { browser: browserProfile.name, url })
          : ''));
      } else if (rule.type === 'url' && rule.url) {
        rows.push(this.row('browserPage', rule.url));
      }
    });
    return rows;
  };

  // The row that opens a typed address, or null when it is no address.
  readonly directUrlRow = (input: string): QuickNavigationRow | null => {
    const url = SearchDirectNavigation.getDirectNavigationUrl(input);
    return url ? this.row('directUrl', url) : null;
  };

  // The address a query opens without searching: a typed address or a
  // shortcut rule's page; '' when there is none.
  readonly resolve = (query: string): Promise<string> => {
    const direct = this.directUrlRow(query);
    if (direct) {
      return Promise.resolve(direct.url);
    }
    return loadShortcutRules().then((rules) => {
      const keywordRows = this.keywordRows(query, rules);
      return keywordRows.length ? keywordRows[0].url : '';
    });
  };

  private row(type: QuickNavigationRow['type'], url: string, title = ''): QuickNavigationRow {
    return {
      type,
      title: title || this.options.locale.formatMessage('open_url', '打开 {url}', { url }),
      url,
      favicon: this.options.getFaviconUrl(url)
    };
  }
}

export { QuickNavigation };
export type { QuickNavigationRow };
