import { describe, expect, it } from 'vitest';
import { applyContentWidth, className, close, contentWidthAttribute, open } from './menu-surface';
import { parseStylesheet } from '../../../tests/fakes/css';
import { required } from '../../../tests/fakes/dom';

const SURFACE = '._x_extension_menu_surface_2024_unique_';

describe('menu surface', () => {
  it('names its class and content width attribute', () => {
    expect(className).toBe('_x_extension_menu_surface_2024_unique_');
    expect(contentWidthAttribute).toBe('data-menu-surface-width');
  });

  it('sizes a menu to its content between pixel widths', () => {
    const element = document.createElement('div');
    applyContentWidth(element, { minWidth: 210, maxWidth: 260 });
    expect(element.classList.contains(className)).toBe(true);
    expect(element.getAttribute(contentWidthAttribute)).toBe('content');
    expect(element.style.getPropertyValue('--x-extension-menu-surface-min-width')).toBe('210px');
    expect(element.style.getPropertyValue('--x-extension-menu-surface-max-width')).toBe('260px');
  });

  it('opens a frame after drawing the menu closed, so its motion plays', () => {
    const element = document.createElement('div');
    const states: Array<string | null> = [];
    open(element, {
      requestAnimationFrame: (callback) => {
        states.push(element.getAttribute('data-open'));
        callback();
      }
    });
    expect(states).toEqual(['false']);
    expect(element.getAttribute('data-open')).toBe('true');
    close(element);
    expect(element.getAttribute('data-open')).toBe('false');
  });

  it('styles the surface, its content width and its select-style opening motion', () => {
    const css = parseStylesheet('src/shared/ui/menu-surface.css');
    const surface = required(css.rule(SURFACE), 'surface rule');
    expect(surface.get('transition')).toBe('opacity 170ms ease, transform 360ms cubic-bezier(0.2, 1.45, 0.35, 1)');
    const content = required(css.rule(`${SURFACE}[data-menu-surface-width="content"]`), 'content width rule');
    expect(content.get('width')).toBe('max-content');
  });
});
