import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { bootOverlayPage, settle, waitFor } from './boot';
import { createLayout } from '../../fakes/layout';
import { getElement, required } from '../../fakes/dom';
import { parseCss, readStylesheet } from '../../fakes/css';

// Scrolling over the overlay must not scroll the page behind it, while a
// result list that can scroll keeps scrolling.

function wheel(target: Element): WheelEvent {
  const event = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true, composed: true });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

describe('Overlay wheel isolation', () => {
  it('keeps the wheel from the page, letting a result list scroll until its end', async () => {
    const page = await bootOverlayPage({
      respond: (message) => (message.action === 'getSearchSuggestions'
        ? { suggestions: Array.from({ length: 8 }, (_value, index) => ({ type: 'history', title: `Result ${index}`, url: `https://r${index}.test/` })) }
        : undefined)
    });
    const root = await page.open();
    const pageWheels: string[] = [];
    document.addEventListener('wheel', () => pageWheels.push('document'));

    expect(wheel(required(page.input(), 'the overlay input')).defaultPrevented).toBe(true);
    expect(pageWheels).toEqual([]);

    await page.type('result');
    await waitFor(() => page.suggestions().length > 3, 'the results did not render');
    const list = getElement(root, '.x-ov-suggestions-container');
    // JSDOM neither loads the overlay's stylesheet nor lays out: give the list
    // the overflow and sizes a real one has once its rows overflow.
    list.style.overflowY = 'auto';
    createLayout().measure(list, { scrollHeight: 900, clientHeight: 300 });
    list.scrollTop = 100;
    expect(wheel(page.suggestions()[2]).defaultPrevented).toBe(false);
    expect(pageWheels).toEqual([]);

    list.scrollTop = 600;
    expect(wheel(page.suggestions()[2]).defaultPrevented).toBe(true);

    page.press('Escape');
    await settle(30);
    expect(wheel(document.body).defaultPrevented).toBe(false);
  });

  it('contains scroll chaining in the result list', () => {
    const css = parseCss(readStylesheet('src/overlay/suggestions-view.css'));
    expect(css.entries.some((entry) => entry.selectors.some((selector) => selector.endsWith('.x-ov-suggestions-container')) &&
      entry.style.getPropertyValue('overscroll-behavior') === 'contain')).toBe(true);
  });
});
