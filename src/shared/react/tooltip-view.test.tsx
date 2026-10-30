import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createTooltipElement,
  destroyTooltipElement,
  renderBrowserAvatarTooltip,
  renderCursorTag,
  renderTooltipText
} from './tooltip-view';
import { expectTag } from '../../../tests/fakes/dom';
import { getTestPortals } from '../../../tests/fakes/portals';

let elements: HTMLElement[] = [];

afterEach(() => {
  act(() => elements.forEach((element) => destroyTooltipElement(element)));
  elements = [];
  document.body.replaceChildren();
});

describe('Tooltip React view', () => {
  it('renders multiline tooltip content and cursor action tags', () => {
    let tooltip: HTMLDivElement | null = null;
    let tag: HTMLDivElement | null = null;
    act(() => {
      tooltip = createTooltipElement({
        portals: getTestPortals(),
        id: 'tooltip',
        kind: 'cursor'
      });
      tag = createTooltipElement({
        portals: getTestPortals(),
        className: '_x_extension_cursor_tooltip_tag_2026_unique_',
        id: 'tooltip-tag',
        kind: 'cursor-tag'
      });
    });
    expect(tooltip).not.toBeNull();
    expect(tag).not.toBeNull();
    const tooltipElement = expectTag(tooltip, 'div');
    const tagElement = expectTag(tag, 'div');
    elements.push(tooltipElement, tagElement);
    document.body.append(tooltipElement, tagElement);

    act(() => {
      renderTooltipText(tooltipElement, 'First\n────────\nSecond');
      renderCursorTag(tagElement, {
        keyText: 'win',
        label: 'Open in background',
        windowsLogo: true
      });
    });

    expect(tooltipElement.dataset.reactIsland).toBe('tooltip');
    expect(tooltipElement.dataset.tooltipKind).toBe('cursor');
    expect(
      tooltipElement.querySelectorAll(
        '._x_extension_tooltip_line_2026_unique_'
      )
    ).toHaveLength(2);
    expect(
      tooltipElement.querySelector(
        '._x_extension_tooltip_divider_2026_unique_'
      )
    ).not.toBeNull();
    expect(
      tagElement.querySelectorAll(
        '._x_extension_cursor_tooltip_windows_logo_pane_2026_unique_'
      )
    ).toHaveLength(4);
    expect(
      tagElement.querySelector(
        '._x_extension_cursor_tooltip_tag_label_2026_unique_'
      )?.textContent
    ).toBe('Open in background');

    act(() => {
      renderBrowserAvatarTooltip(tooltipElement, {
        browsers: [
          { id: 'chrome', name: 'Chrome', src: '/chrome.svg' },
          { id: 'dia', name: 'Dia' }
        ],
        browserAvatarSuffix: 'and more'
      });
    });
    expect(tooltipElement.querySelectorAll('.browser-avatar')).toHaveLength(2);
    expect(tooltipElement.querySelector('[role="img"]')?.getAttribute('aria-label'))
      .toBe('Chrome, Dia and more');
  });
});
