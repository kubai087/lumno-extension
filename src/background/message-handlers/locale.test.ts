import { describe, expect, it } from 'vitest';
import { bootWorker, jsonResponse } from '../../../tests/fakes/worker';

describe('locale messages', () => {
  it('reads a locale file once per worker and answers only the keys a caller names', async () => {
    const fake = await bootWorker({
      fetch: () => jsonResponse({ copy_page_url_success: { message: 'Copied' }, unrelated_key: { message: 'Other' } })
    });
    const localeReads = () => fake.fetch.mock.calls.filter(([url]) => String(url).endsWith('_locales/en/messages.json')).length;
    const readsAtStart = localeReads();

    expect(await fake.sendMessage({ action: 'getLocaleMessages', locale: 'en', keys: ['copy_page_url_success', 'missing_key'] }))
      .toEqual({ messages: { copy_page_url_success: { message: 'Copied' } } });
    const full = await fake.sendMessage({ action: 'getLocaleMessages', locale: 'en' });
    expect(full).toEqual({ messages: { copy_page_url_success: { message: 'Copied' }, unrelated_key: { message: 'Other' } } });
    expect(localeReads()).toBe(Math.max(1, readsAtStart));
  });
});
