import { describe, expect, it } from 'vitest';
import { SearchAutocomplete } from './autocomplete';
import { SearchQuery } from './search-query';
import type { Setting } from '../../domain/settings/define';

// Settings as stored by default: autocomplete over search.
const DEFAULT_SETTINGS = { get: <T>(setting: Setting<T>): T => setting.parse(undefined) };

function typed(value: string) {
  const input = document.createElement('input');
  input.value = value;
  input.setSelectionRange(value.length, value.length);
  const query = new SearchQuery();
  query.set(value);
  const autocomplete = new SearchAutocomplete({
    settings: DEFAULT_SETTINGS,
    query,
    getInput: () => input,
    preview: { isActive: () => false },
    isModeActive: () => false,
    getUrlDisplay: (url) => String(url || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
  });
  return { input, autocomplete };
}

describe('search autocomplete', () => {
  it('appends the completion to what was typed, keeping the typed case, and selects only the added text', () => {
    const { input, autocomplete } = typed('4A');
    autocomplete.apply([{ type: 'bookmark', title: '4A广告网', url: 'https://www.4anet.com/' }], null, 'default');
    expect(input.value).toBe('4Anet.com');
    expect([input.selectionStart, input.selectionEnd]).toEqual([2, 9]);
    expect(autocomplete.state?.completion).toBe('4Anet.com');
  });
});
