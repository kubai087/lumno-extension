import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { className, createController, hostClassName, position } from './tooltip';
import type { TooltipController } from './tooltip';
import { getTestPortals } from '../../../tests/fakes/portals';
import { required } from '../../../tests/fakes/dom';
import { parseStylesheet } from '../../../tests/fakes/css';

const TOOLTIP = '._x_extension_tooltip_2026_unique_';
const LINE = '._x_extension_tooltip_line_2026_unique_';

let controllers: TooltipController[] = [];

function createTarget(): HTMLButtonElement {
  const target = document.createElement('button');
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ x: 120, y: 80, width: 32, height: 32 }));
  document.body.appendChild(target);
  return target;
}

function createTooltip(): TooltipController {
  const controller = createController({ portals: getTestPortals(), id: '_x_extension_test_tooltip_2026_unique_' });
  controllers.push(controller);
  return controller;
}

function nextFrame(): void {
  act(() => {
    vi.advanceTimersToNextFrame();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  act(() => controllers.forEach((controller) => controller.destroy()));
  controllers = [];
  vi.useRealTimers();
});

describe('shared tooltip', () => {
  it('names its tooltip and host classes', () => {
    expect(className).toBe('_x_extension_tooltip_2026_unique_');
    expect(hostClassName).toBe('_x_extension_tooltip_host_2026_unique_');
  });

  it('shows multiline text with a divider beside its focused target, and hides', () => {
    const controller = createTooltip();
    const target = createTarget();
    target.focus();
    act(() => {
      controller.show(target, '第一行\n────────\n第二行');
    });
    nextFrame();
    const element = required(controller.element, 'tooltip');
    expect(element.classList.contains(className)).toBe(true);
    expect(element.getAttribute('data-visible')).toBe('true');
    expect(element.children).toHaveLength(3);
    expect(element.children[1].classList.contains('_x_extension_tooltip_divider_2026_unique_')).toBe(true);
    act(() => {
      controller.hide();
    });
    expect(element.getAttribute('data-visible')).toBe('false');
  });

  it('places itself with the spacing resolved for the current target', () => {
    const controller = createTooltip();
    const target = createTarget();
    const element = required(controller.element, 'tooltip');
    const spacing = vi.fn(() => 4);
    position(element, target, { windowObj: { innerWidth: 320, innerHeight: 240 }, placement: 'bottom', spacing });
    expect(spacing).toHaveBeenCalledWith(target);
    expect(element.style.getPropertyValue('top')).toBe('116px');
  });

  it('shows a bound tooltip on focus by default', () => {
    const controller = createTooltip();
    const target = createTarget();
    controller.bind(target, () => 'Focus tooltip');
    act(() => {
      target.focus();
    });
    nextFrame();
    const element = required(controller.element, 'tooltip');
    expect(element.textContent).toBe('Focus tooltip');
    expect(element.getAttribute('data-visible')).toBe('true');
  });

  it('shows a hover-only tooltip on hover but not on focus', () => {
    const controller = createTooltip();
    const target = createTarget();
    controller.bind(target, () => 'Hover only tooltip', { showOnFocus: false, checkActive: false });
    act(() => {
      target.focus();
    });
    nextFrame();
    expect(required(controller.element, 'tooltip').getAttribute('data-visible')).not.toBe('true');
    act(() => {
      target.dispatchEvent(new MouseEvent('mouseenter'));
    });
    nextFrame();
    const element = required(controller.element, 'tooltip');
    expect(element.textContent).toBe('Hover only tooltip');
    expect(element.getAttribute('data-visible')).toBe('true');
  });
});

describe('shared tooltip stylesheet', () => {
  it('draws a light gradient surface with feature-hint text, and a dark override', () => {
    const css = parseStylesheet('src/shared/ui/tooltip.css');
    const tooltip = required(css.rule(TOOLTIP), 'tooltip rule');
    expect(tooltip.get('--x-extension-tooltip-bg-top')).toBe('#ffffff');
    expect(tooltip.get('--x-extension-tooltip-bg-bottom')).toBe('#f7f9fc');
    expect(tooltip.get('background')).toMatch(/^linear-gradient\(/);
    expect(tooltip.get('color')).toBe('var(--x-extension-tooltip-text, #556070)');
    const dark = required(css.rule(`[data-theme="dark"] ${TOOLTIP}`), 'dark tooltip rule');
    expect(dark.get('--x-extension-tooltip-bg-top')).toBe('#111827');
  });

  it('styles the divider and spaces multiline paragraphs apart', () => {
    const css = parseStylesheet('src/shared/ui/tooltip.css');
    expect(css.rule('._x_extension_tooltip_divider_2026_unique_')).not.toBeNull();
    expect(required(css.rule(`${LINE} + ${LINE}`), 'line spacing rule').get('margin-top')).toBe('6px');
  });
});
