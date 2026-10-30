import { describe, expect, it } from 'vitest';
import { bootOverlayPage, waitFor } from './boot';

// Typing into the overlay renders the results the worker answers, with the
// enhanced favicon fetch off and on.

const HISTORY_RESULT = {
  type: 'history',
  title: 'Lumno regression history result',
  url: 'https://history.example.test/lumnotest',
  favicon: 'https://history.example.test/favicon.ico'
};

describe('Overlay search results', () => {
  it.each([
    [false, 'autocomplete'],
    [true, 'search']
  ])('render from the worker with enhanced favicons %s and %s first', async (enhanced, priority) => {
    const page = await bootOverlayPage({
      settings: {
        _x_extension_favicon_enhanced_fetch_enabled_2026_unique_: enhanced,
        _x_extension_search_result_priority_2026_unique_: priority
      },
      respond: (message) => (message.action === 'getSearchSuggestions'
        ? { suggestions: message.query === 'lumnotest' ? [HISTORY_RESULT] : [] }
        : undefined)
    });
    const root = await page.open();
    const shows = (text: string) => (root.textContent || '').includes(text);

    await page.type('lumnotest');
    await waitFor(() => shows(HISTORY_RESULT.title), 'the history result did not render');
    expect(page.suggestions().length).toBeGreaterThanOrEqual(2);
    expect(page.messages.some((message) => message.action === 'getSearchSuggestions' && message.query === 'lumnotest')).toBe(true);

    await page.type('emptyregressionquery');
    await waitFor(() => shows('emptyregressionquery') && !shows(HISTORY_RESULT.title), 'the default search action did not render alone');
    expect(page.suggestions().length).toBeGreaterThan(0);

    // With open tabs not shown by default, an empty query shows nothing.
    await page.type('');
    await waitFor(() => page.suggestions().length === 0, 'clearing the query left results');
  });
});
