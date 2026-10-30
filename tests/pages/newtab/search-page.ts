// The New Tab booted for search tests (boot.ts), with its search box: type
// into it, press keys on it, click the page and read the result rows.
//
//   const search = await openSearchPage(createBrowserFake({ sync }));
//   await search.type('/mode');
//   await search.waitForRows();
//   await search.press('Enter');
import { act } from 'react';
import type { BrowserFake } from '../../fakes/browser';
import { getElements, getTag } from '../../fakes/dom';
import { bootReadyNewtab, settle, waitFor } from './boot';

const SEARCH_INPUT_ID = '_x_extension_newtab_search_input_2024_unique_';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// The suggestion a result row stands for, as the row keeps it.
export function suggestionOf(row: Element): Record<string, unknown> {
  const suggestion: unknown = Reflect.get(row, '_xSuggestion');
  return isRecord(suggestion) ? suggestion : {};
}

// Real time passing, for debounced work and for answers that should not come.
export async function pause(ms: number): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
  await settle(2);
}

export async function dispatch<E extends Event>(target: EventTarget, event: E): Promise<E> {
  await act(async () => {
    target.dispatchEvent(event);
  });
  return event;
}

export async function openSearchPage(browser: BrowserFake) {
  await bootReadyNewtab(browser);
  const input = getTag(document, `#${SEARCH_INPUT_ID}`, 'input');
  await act(async () => {
    input.focus();
  });
  const rows = () => getElements(document, '.x-nt-suggestion-item');
  return {
    browser,
    input,
    rows,
    // The suggestion type of each row shown.
    types: () => rows().map((row) => suggestionOf(row).type),
    async type(query: string): Promise<void> {
      await act(async () => {
        input.focus();
        input.value = query;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await pause(60);
    },
    // A key press on the focused element, the search box by default.
    async press(key: string, init: KeyboardEventInit = {}, target: EventTarget = document.activeElement || input): Promise<KeyboardEvent> {
      const event = await dispatch(target, new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
      await settle();
      return event;
    },
    async click(element: Element): Promise<MouseEvent> {
      const event = await dispatch(element, new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
      await settle();
      return event;
    },
    async waitForRows(check: (shown: HTMLElement[]) => boolean = (shown) => shown.length > 0, message = 'the search showed no results'): Promise<void> {
      await waitFor(() => check(rows()), message);
    }
  };
}

export type SearchPage = Awaited<ReturnType<typeof openSearchPage>>;
