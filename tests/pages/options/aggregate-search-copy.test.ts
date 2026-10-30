import { describe, expect, it } from 'vitest';
import { readRepoFile } from '../../fakes/css';
import { aggregateSearchAutoGroupEnabled } from '../../../src/domain/settings/search';

// The aggregate search copy each core locale ships, and the key of the
// setting that groups an aggregate search's tabs.

function message(locale: string, key: string): string {
  const parsed: unknown = JSON.parse(readRepoFile(`_locales/${locale}/messages.json`));
  const entry: unknown = typeof parsed === 'object' && parsed !== null ? Reflect.get(parsed, key) : undefined;
  const text: unknown = typeof entry === 'object' && entry !== null ? Reflect.get(entry, 'message') : undefined;
  return typeof text === 'string' ? text : '';
}

describe('Aggregate search copy', () => {
  it('stores the auto-group choice under its key', () => {
    expect(aggregateSearchAutoGroupEnabled.key).toBe('_x_extension_aggregate_search_auto_group_enabled_2026_unique_');
  });

  it.each([
    ['en', 'Aggregate search', 'Automatically group aggregate search tabs', 'Automatically create tab groups'],
    ['ja', '一括検索', '一括検索のタブグループを自動作成', 'タブグループを自動作成'],
    ['zh_CN', '聚合搜索', '聚合搜索自动创建标签页组', '自动创建标签页组'],
    ['zh_TW', '彙整搜尋', '彙整搜尋自動建立分頁群組', '自動建立分頁群組']
  ])('names the auto-group switch in %s, with and without the section name', (locale, defaultName, title, shortTitle) => {
    expect(message(locale, 'aggregate_search_default_name')).toBe(defaultName);
    expect(message(locale, 'settings_aggregate_search_auto_group_title')).toBe(title);
    expect(message(locale, 'settings_aggregate_search_auto_group_short_title')).toBe(shortTitle);
    expect(message(locale, 'settings_aggregate_search_auto_group_desc').trim()).not.toBe('');
    expect(message(locale, 'aggregate_search_source_summary')).toContain('{count}');
  });
});
