import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { InfoButton } from './info-button';
import { getTag } from '../../../tests/fakes/dom';
import { queryHtmlElement } from '../../shared/dom-lookup';

afterEach(() => {
  document.body.textContent = '';
});

describe('Options InfoButton', () => {
  it('owns the shared icon, tooltip, focus, and accessibility contract', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    act(() => root.render(
      <InfoButton
        className="custom-info"
        tooltip="关闭后的行为说明"
        tooltipKey="settings_example_tooltip"
      />
    ));

    const button = queryHtmlElement(host, '._x_extension_info_button_2026_unique_');
    expect(button?.classList.contains('custom-info')).toBe(true);
    expect(button?.getAttribute('data-tooltip')).toBe('关闭后的行为说明');
    expect(button?.getAttribute('data-i18n-tooltip')).toBe('settings_example_tooltip');
    expect(button?.getAttribute('aria-label')).toBe('关闭后的行为说明');
    expect(button?.tagName).toBe('BUTTON');
    expect(button?.getAttribute('type')).toBe('button');
    expect(button?.hasAttribute('role')).toBe(false);
    expect(button?.tabIndex).toBe(0);
    expect(button?.hasAttribute('aria-describedby')).toBe(false);
    expect(button?.querySelector('.ri-information-line')).not.toBeNull();
    expect(button?.querySelector('.ri-question-line')).toBeNull();

    act(() => root.unmount());
  });

  it('names the button with its label and describes it with the tooltip text', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    act(() => root.render(<InfoButton label="Template help" tooltip="Use %s for the query" />));

    const button = getTag(host, 'button', 'button');
    expect(button.getAttribute('aria-label')).toBe('Template help');
    const description = document.getElementById(button.getAttribute('aria-describedby') || '');
    expect(description?.textContent).toBe('Use %s for the query');
    expect(button.contains(description)).toBe(true);
    expect(description?.hidden).toBe(true);
    expect(button.getAttribute('data-tooltip')).toBe('Use %s for the query');

    button.focus();
    expect(document.activeElement).toBe(button);

    act(() => root.unmount());
  });
});
