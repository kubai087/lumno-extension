import { describe, expect, it } from 'vitest';
import { bindTextTooltip } from './highlight';

type TextTooltipOptions = Parameters<typeof bindTextTooltip>[0];
type BindCursorTooltip = NonNullable<TextTooltipOptions['bindCursorTooltip']>;
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

function recordBindings(): {
  options: TextTooltipOptions;
  calls: Array<{
    target: HTMLElement;
    getText: () => string;
    tooltip: CursorTooltipOptions;
  }>;
} {
  const calls: Array<{
    target: HTMLElement;
    getText: () => string;
    tooltip: CursorTooltipOptions;
  }> = [];
  const bindCursorTooltip: BindCursorTooltip = (target, getText, tooltip) => {
    calls.push({ target, getText, tooltip });
  };
  return {
    options: {
      sanitizeDisplayText: (value: unknown) => String(value ?? ''),
      bindCursorTooltip
    },
    calls
  };
}

describe('bindTextTooltip', () => {
  it('hangs the tooltip off the hover target and measures the text line', () => {
    const row = document.createElement('div');
    const title = document.createElement('span');
    row.appendChild(title);
    // The row fits its content, while the title's own line box is clipped.
    setWidths(row, 320, 320);
    setWidths(title, 48, 96);
    const { options, calls } = recordBindings();

    bindTextTooltip(options, row, 'A title that was clipped', title);

    expect(calls).toHaveLength(1);
    const [binding] = calls;
    expect(binding.target).toBe(row);
    expect(binding.getText()).toBe('A title that was clipped');
    expect(binding.tooltip.shouldShow(row)).toBe(true);
  });

  it('measures the hover target itself when no separate element is given', () => {
    const title = document.createElement('span');
    setWidths(title, 96, 96);
    const { options, calls } = recordBindings();

    bindTextTooltip(options, title, 'A title that fits');

    expect(calls).toHaveLength(1);
    const [binding] = calls;
    expect(binding.target).toBe(title);
    expect(binding.tooltip.shouldShow(title)).toBe(false);
  });
});
