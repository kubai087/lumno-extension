import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { newtabShortcutColumns } from '../../../src/domain/settings/newtab-shortcuts';
import { createBrowserFake } from '../../fakes/browser';
import { parsePageCss } from '../../fakes/css';
import { expectTag, getElement, getElementById, getTag } from '../../fakes/dom';
import { bootOptionsPage, settle } from './boot';

// Settings' sliders for how many shortcuts a New Tab row holds, and their
// size and spacing.

const COLUMNS = newtabShortcutColumns.key;
const row = (name: string) => getElementById(`_x_extension_newtab_shortcut_${name}_setting_row_2026_unique_`);
const follows = (first: Element, second: Element) => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

function setValue(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('the shortcut grid settings in Settings', () => {
  it('offer 4 to 16 per row, followed by size and spacing', async () => {
    await bootOptionsPage(createBrowserFake({ sync: { [COLUMNS]: 8 } }));

    getElement(row('columns'), '#_x_extension_newtab_shortcut_columns_control_2026_unique_');
    expect(follows(row('columns'), row('size')) && follows(row('size'), row('gap'))).toBe(true);
    const slider = getTag(document, '#_x_extension_newtab_shortcut_columns_slider_2026_unique_', 'input');
    expect([slider.min, slider.max, slider.step, slider.value]).toEqual(['4', '16', '1', '8']);
  });

  it('save a typed and a slid column count, the typed one in the shared input', async () => {
    const browser = createBrowserFake({ sync: { [COLUMNS]: 8 } });
    const set = vi.spyOn(browser.storage.sync, 'set');
    await bootOptionsPage(browser);
    const valueInput = expectTag(getElementById('_x_extension_newtab_shortcut_columns_control_2026_unique_')
      .querySelector('input:not([type="range"])'), 'input', 'the typed column count');
    expect(valueInput.classList.contains('_x_extension_shortcut_input_2024_unique_')).toBe(true);

    await act(async () => {
      setValue(valueInput, '13');
      valueInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      valueInput.dispatchEvent(new FocusEvent('blur'));
    });
    await settle();
    await act(async () => {
      setValue(getTag(document, '#_x_extension_newtab_shortcut_columns_slider_2026_unique_', 'input'), '12');
    });
    await settle();
    const saved = set.mock.calls.flatMap(([values]) => (Object.hasOwn(values, COLUMNS) ? [values[COLUMNS]] : []));
    expect(saved).toEqual(expect.arrayContaining([13, 12]));
  });
});

describe('the slider value input in Settings', () => {
  it('has no second appearance of its own', () => {
    const options = parsePageCss('src/options/options.html');
    expect(options.selectors().filter((selector) => /_x_extension_range_slider_value_input_2026_unique_:(hover|focus|focus-visible|disabled)/.test(selector)))
      .toEqual([]);
  });
});
