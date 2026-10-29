import { describe, expect, it } from 'vitest';
import type { NormalizedOptions } from './types';
import { bindRowTooltip } from './highlight';
import { normalizeOptions } from './surface-options';
import { getTestPortals } from '../../../../../tests/react/portals';

type BindCursorTooltip = NonNullable<NormalizedOptions['bindCursorTooltip']>;
type GetText = Parameters<BindCursorTooltip>[1];
type CursorTooltipOptions = Parameters<BindCursorTooltip>[2];

function setWidths(
  element: HTMLElement,
  clientWidth: number,
  scrollWidth: number
): void {
  Object.defineProperty(element, 'clientWidth', {
    configurable: true,
    value: clientWidth
  });
  Object.defineProperty(element, 'scrollWidth', {
    configurable: true,
    value: scrollWidth
  });
}

function clip(element: HTMLElement, clipped: boolean): void {
  setWidths(element, 100, clipped ? 200 : 100);
}

// A result row: icon, title, the address line with a highlighted part, and a
// utility button.
function createRow() {
  const row = document.createElement('div');
  const icon = document.createElement('span');
  const title = document.createElement('span');
  title.textContent = 'A long result title';
  const urlLine = document.createElement('span');
  const mark = document.createElement('mark');
  mark.textContent = 'example.com';
  urlLine.append(mark, '/a/long/path');
  const utilityButton = document.createElement('button');
  utilityButton.className = 'x-nt-suggestion-utility-button';
  row.append(icon, title, urlLine, utilityButton);
  return { row, icon, title, urlLine, mark, utilityButton };
}

function bindRow(parts: ReturnType<typeof createRow>) {
  const calls: Array<{
    target: HTMLElement;
    getText: GetText;
    tooltip: CursorTooltipOptions;
  }> = [];
  const bindCursorTooltip: BindCursorTooltip = (target, getText, tooltip) => {
    calls.push({ target, getText, tooltip });
  };
  const options = normalizeOptions({
    portals: getTestPortals(),
    container: document.createElement('div'),
    bindCursorTooltip
  });
  if (!options) {
    throw new Error('the suggestion options should normalize');
  }
  bindRowTooltip(
    options,
    parts.row,
    { getElement: () => parts.title },
    {
      getElement: () => parts.urlLine,
      getText: () => 'https://example.com/a/long/path'
    }
  );
  expect(calls).toHaveLength(1);
  const [{ target, getText, tooltip }] = calls;
  expect(target).toBe(parts.row);
  // What the row shows with the pointer on this element, '' for nothing.
  return (pointed: Element | null): string => {
    const event = pointed ? { target: pointed } : null;
    if (!tooltip.shouldShow(parts.row, event)) {
      return '';
    }
    return getText(parts.row, event);
  };
}

const URL_TEXT = 'https://example.com/a/long/path';
const TITLE_TEXT = 'A long result title';

describe('bindRowTooltip', () => {
  it('shows a cut title from anywhere on the row', () => {
    const parts = createRow();
    clip(parts.title, true);
    clip(parts.urlLine, false);
    const shown = bindRow(parts);

    expect(shown(parts.row)).toBe(TITLE_TEXT);
    expect(shown(parts.icon)).toBe(TITLE_TEXT);
    expect(shown(parts.mark)).toBe(TITLE_TEXT);
  });

  it('shows a cut address from anywhere on the row when the title fits', () => {
    const parts = createRow();
    clip(parts.title, false);
    clip(parts.urlLine, true);
    const shown = bindRow(parts);

    expect(shown(parts.row)).toBe(URL_TEXT);
    expect(shown(parts.title)).toBe(URL_TEXT);
    expect(shown(parts.mark)).toBe(URL_TEXT);
  });

  it('puts the title first when both are cut, and the address over its own line', () => {
    const parts = createRow();
    clip(parts.title, true);
    clip(parts.urlLine, true);
    const shown = bindRow(parts);

    expect(shown(parts.row)).toBe(TITLE_TEXT);
    expect(shown(parts.title)).toBe(TITLE_TEXT);
    expect(shown(parts.urlLine)).toBe(URL_TEXT);
    expect(shown(parts.mark)).toBe(URL_TEXT);
    expect(shown(parts.icon)).toBe(TITLE_TEXT);
  });

  it('shows nothing when both fit', () => {
    const parts = createRow();
    clip(parts.title, false);
    clip(parts.urlLine, false);
    const shown = bindRow(parts);

    expect(shown(parts.row)).toBe('');
    expect(shown(parts.urlLine)).toBe('');
  });

  it('leaves a utility button to its own tooltip', () => {
    const parts = createRow();
    clip(parts.title, true);
    clip(parts.urlLine, true);
    const shown = bindRow(parts);

    expect(shown(parts.utilityButton)).toBe('');
  });

  it('keeps to the last pointed line for an input without a target', () => {
    const parts = createRow();
    clip(parts.title, true);
    clip(parts.urlLine, true);
    const shown = bindRow(parts);

    expect(shown(parts.mark)).toBe(URL_TEXT);
    // A modifier key refresh while the pointer stays on the address line.
    expect(shown(null)).toBe(URL_TEXT);
  });
});
