import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { createBrowserFake } from '../../fakes/browser';
import { waitFor } from './boot';
import { dispatch, openSearchPage, pause } from './search-page';

// Clicking the page background hides populated results (restoring what the
// user typed over an autocomplete), focusing the box again brings them back,
// and a late answer for the hidden query stays away. On an empty New Tab the
// click focuses the box.
const ANSWER = { suggestions: [{ type: 'history', title: 'Lumno', url: 'https://lumno.example/' }] };

async function pressBackground(): Promise<MouseEvent> {
  await dispatch(document.body, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 5, clientY: 700 }));
  return dispatch(document.body, new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: 5, clientY: 700 }));
}

describe('New Tab background click', () => {
  it('hides and brings back results, keeps a late answer away and focuses an empty box', async () => {
    let answerLate: (() => void) | null = null;
    const search = await openSearchPage(createBrowserFake({
      respond(message) {
        if (message.action !== 'getSearchSuggestions') {
          return undefined;
        }
        if (message.query === 'lumno docs') {
          return new Promise((resolve) => {
            answerLate = () => resolve(ANSWER);
          });
        }
        return ANSWER;
      }
    }));
    const { input } = search;
    const focusBox = () => dispatch(input, new FocusEvent('focus'));

    await act(async () => {
      input.value = 'lum';
      input.setSelectionRange(3, 3);
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'm' }));
    });
    await waitFor(() => input.value === 'lumno.example', 'the typed query should autocomplete');
    expect(search.rows().length).toBeGreaterThan(0);
    const mousedown = await pressBackground();
    await pause(60);
    expect(search.rows()).toHaveLength(0);
    expect(input.value).toBe('lum');
    expect(mousedown.defaultPrevented).toBe(false);

    await focusBox();
    await search.waitForRows(undefined, 'focusing the box again should bring the results back');

    await search.type('lumno docs');
    await pressBackground();
    await pause(40);
    await act(async () => answerLate?.());
    await pause(120);
    expect(search.rows()).toHaveLength(0);
    await search.type('lumno');
    await search.waitForRows(undefined, 'typing again should show results again');

    await search.type('/');
    await pressBackground();
    await pause(60);
    await focusBox();
    await search.waitForRows(undefined, 'refocusing should bring back slash-command results too');

    await search.type('');
    await act(async () => input.blur());
    const refocus = await pressBackground();
    await pause(60);
    expect(document.activeElement).toBe(input);
    expect(refocus.defaultPrevented).toBe(true);
  });
});
