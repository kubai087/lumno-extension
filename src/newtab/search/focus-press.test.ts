import { afterEach, describe, expect, it } from 'vitest';
import { createSearchFocusPress, FOCUS_PRESS_ATTRIBUTE } from './focus-press';

function setup() {
  const root = document.createElement('div');
  const input = document.createElement('input');
  root.appendChild(input);
  document.body.appendChild(root);
  const press = createSearchFocusPress({ root, getInput: () => input });
  return { root, input, press };
}

function pointerDown(target: HTMLElement, button = 0): void {
  const event = new MouseEvent('pointerdown', { bubbles: true, button });
  target.dispatchEvent(event);
}

afterEach(() => {
  document.body.replaceChildren();
  document.body.removeAttribute('data-nt-enter');
  document.body.removeAttribute('data-nt-suggestions-open');
});

describe('search focus press', () => {
  it('shrinks the empty search box and clears once the animation ends', () => {
    const { root, press } = setup();
    press.play();
    expect(root.getAttribute(FOCUS_PRESS_ATTRIBUTE)).toBe('run');
    root.dispatchEvent(new Event('animationend'));
    expect(root.hasAttribute(FOCUS_PRESS_ATTRIBUTE)).toBe(false);
  });

  it('keeps the box still while it has text, results are open or the page is entering', () => {
    const { root, input, press } = setup();
    input.value = 'lumno';
    press.play();
    expect(root.hasAttribute(FOCUS_PRESS_ATTRIBUTE)).toBe(false);

    input.value = '';
    document.body.setAttribute('data-nt-suggestions-open', 'true');
    press.play();
    expect(root.hasAttribute(FOCUS_PRESS_ATTRIBUTE)).toBe(false);

    document.body.removeAttribute('data-nt-suggestions-open');
    document.body.setAttribute('data-nt-enter', 'run');
    press.play();
    expect(root.hasAttribute(FOCUS_PRESS_ATTRIBUTE)).toBe(false);
  });

  it('plays for a primary press on the field only while it is unfocused', () => {
    const { root, input, press } = setup();
    input.addEventListener('pointerdown', press.handleInputPointerDown);

    pointerDown(input, 2);
    expect(root.hasAttribute(FOCUS_PRESS_ATTRIBUTE)).toBe(false);

    input.focus();
    pointerDown(input);
    expect(root.hasAttribute(FOCUS_PRESS_ATTRIBUTE)).toBe(false);

    input.blur();
    pointerDown(input);
    expect(root.getAttribute(FOCUS_PRESS_ATTRIBUTE)).toBe('run');
  });
});
