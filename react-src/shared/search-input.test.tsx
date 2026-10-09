import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSearchInput,
  createSearchInputApi,
  destroySearchInput,
  type SearchInputParts
} from './search-input';

let inputs: SearchInputParts[] = [];

function create(config: Parameters<typeof createSearchInput>[0] = {}) {
  const holder: { value: SearchInputParts | null } = { value: null };
  act(() => {
    holder.value = createSearchInput(config);
  });
  if (!holder.value) {
    throw new Error('Expected search input parts');
  }
  inputs.push(holder.value);
  document.body.appendChild(holder.value.container);
  return holder.value;
}

afterEach(() => {
  act(() => inputs.forEach((parts) => destroySearchInput(parts)));
  inputs = [];
  document.head
    .querySelectorAll('link[id^="_x_extension_"]')
    .forEach((link) => link.remove());
  document.body.innerHTML = '';
});

describe('Shared search input React island', () => {
  it('preserves the stable element and class contract', () => {
    const parts = create({
      containerId: 'container',
      iconId: 'icon',
      inputId: 'input',
      placeholder: 'Search',
      rightIconAlt: 'Settings',
      useInlineBaseStyles: false
    });

    expect(createSearchInputApi().implementation).toBe('react');
    expect(parts.container.dataset.reactIsland).toBe('shared-search-input');
    expect(parts.container.id).toBe('container');
    expect(parts.container.classList.contains('x-lumno-search-input')).toBe(
      true
    );
    expect(parts.input.id).toBe('input');
    expect(parts.input.placeholder).toBe('Search');
    expect(parts.icon.id).toBe('icon');
    expect(parts.rightIcon.getAttribute('aria-label')).toBe('Settings');
    expect(parts.divider.style.display).toBe('none');
    expect(parts.modePrefix.parentElement).toBe(parts.container);
    expect(parts.modePrefix.tagName).toBe('BUTTON');
    expect(parts.modePrefixIconFrame.parentElement).toBe(parts.modePrefix);
    expect(parts.modePrefixIcon.parentElement).toBe(parts.modePrefixIconFrame);
    expect(parts.modePrefixGlyph.parentElement).toBe(parts.modePrefix);
    expect(parts.modePrefixText.parentElement).toBe(parts.modePrefix);
    expect(parts.modePrefixChevron.parentElement).toBe(parts.modePrefix);
    expect(parts.modePrefixChevron.classList.contains('ri-arrow-down-s-line')).toBe(
      true
    );
    expect(parts.modeMenu.parentElement).toBe(parts.container);
    expect(parts.modeMenu.hidden).toBe(true);
    expect(parts.modeTabHint.parentElement).toBe(parts.container);
    expect(parts.modeTabHintKey.parentElement).toBe(parts.modeTabHint);
    expect(parts.modeTabHintText.parentElement).toBe(parts.modeTabHint);
  });

  it('bridges native input, focus, blur, and keyboard events', () => {
    const onBlur = vi.fn();
    const onFocus = vi.fn();
    const onInput = vi.fn();
    const onKeyDown = vi.fn();
    const parts = create({ onBlur, onFocus, onInput, onKeyDown });

    act(() => {
      parts.input.dispatchEvent(new FocusEvent('focus'));
      parts.input.value = 'lumno';
      parts.input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      parts.input.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })
      );
      parts.input.dispatchEvent(new FocusEvent('blur'));
    });

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(parts.divider.style.display).toBe('block');
  });

  it('keeps isolated underline and right-icon visual state in attributes', () => {
    const styleRoot = document.createElement('div').attachShadow({
      mode: 'open'
    });
    const parts = create({
      showUnderlineWhenEmpty: true,
      styleRoot,
      useIsolatedStyles: true
    });

    expect(parts.divider.dataset.visible).toBe('true');
    act(() => {
      parts.rightIcon.dispatchEvent(
        new MouseEvent('mouseenter', { bubbles: true })
      );
    });
    expect(parts.rightIcon.dataset.hoverActive).toBe('true');
    act(() => {
      parts.rightIcon.dispatchEvent(
        new MouseEvent('mouseleave', { bubbles: true })
      );
    });
    expect(parts.rightIcon.dataset.hoverActive).toBe('false');
  });

  it('keeps the right-icon hit box still while exposing visual hover state', () => {
    const parts = create();

    act(() => {
      parts.rightIcon.dispatchEvent(
        new MouseEvent('mouseenter', { bubbles: true })
      );
    });

    expect(parts.rightIcon.style.transform).toBe('none');
    expect(parts.rightIcon.dataset.hoverActive).toBe('true');

    act(() => {
      parts.rightIcon.dispatchEvent(
        new MouseEvent('mouseleave', { bubbles: true })
      );
    });

    expect(parts.rightIcon.style.transform).toBe('none');
    expect(parts.rightIcon.dataset.hoverActive).toBe('false');
  });

  it('renders a React-owned secondary action and mode badge', () => {
    const parts = create({
      modeBadge: {
        className: 'mode-badge',
        id: 'mode-badge',
        surface: 'overlay',
        visible: true
      },
      secondaryAction: {
        ariaLabel: 'Close other tabs',
        className: 'close-tabs',
        html: '<span aria-hidden="true">×</span>',
        id: 'close-tabs'
      }
    });

    expect(parts.secondaryAction?.id).toBe('close-tabs');
    expect(parts.secondaryAction?.classList.contains('close-tabs')).toBe(true);
    expect(parts.secondaryAction?.getAttribute('aria-label')).toBe(
      'Close other tabs'
    );
    expect(parts.modeBadge?.id).toBe('mode-badge');
    expect(parts.modeBadge?.dataset.surface).toBe('overlay');
    expect(parts.modeBadge?.hidden).toBe(false);
  });
  it('shows the clear action only while the field has text and clears on click', () => {
    const onInput = vi.fn();
    const parts = create({
      clearAction: { ariaLabel: 'Clear', id: 'clear' },
      onInput
    });
    const clear = parts.clearAction;
    expect(clear?.id).toBe('clear');
    expect(clear?.getAttribute('aria-label')).toBe('Clear');
    expect(clear?.hidden).toBe(true);

    parts.input.value = 'lumno';
    parts.input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(clear?.hidden).toBe(false);

    clear?.click();
    expect(parts.input.value).toBe('');
    expect(clear?.hidden).toBe(true);
    expect(document.activeElement).toBe(parts.input);
    expect(onInput).toHaveBeenCalledTimes(2);

    parts.input.value = 'set programmatically';
    expect(parts.syncClearAction()).toBe(true);
    expect(clear?.hidden).toBe(false);
  });

  it('omits the clear action unless configured', () => {
    const parts = create();
    expect(parts.clearAction).toBeNull();
    expect(parts.syncClearAction()).toBe(false);
  });
});
