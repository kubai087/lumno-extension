import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSearchInput,
  destroySearchInput,
  type SearchInputParts
} from './search-input';
import { getElement, getTags, required } from '../../../tests/react/dom';
import { getTestPortals } from '../../../tests/react/portals';

let inputs: SearchInputParts[] = [];

function create(config: Omit<Parameters<typeof createSearchInput>[0], 'portals'> = {}) {
  const holder: { value: SearchInputParts | null } = { value: null };
  act(() => {
    holder.value = createSearchInput({ ...config, portals: getTestPortals() });
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
  document.body.replaceChildren();
});

describe('Shared search input React island', () => {
  it('preserves the stable element and class contract', () => {
    const parts = create({
      containerId: 'container',
      iconId: 'icon',
      inputId: 'input',
      placeholder: 'Search',
      rightIconAlt: 'Settings'
    });

    expect(parts.container.dataset.reactIsland).toBe('shared-search-input');
    expect(parts.container.id).toBe('container');
    expect(parts.container.classList.contains('x-lumno-search-input')).toBe(
      true
    );
    expect(parts.input.id).toBe('input');
    expect(parts.input.placeholder).toBe('Search');
    expect(parts.icon.id).toBe('icon');
    expect(parts.rightIcon.getAttribute('aria-label')).toBe('Settings');
    expect(parts.divider.dataset.visible).toBe('false');
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

  it('mounts into the element the surface drew for it', () => {
    const container = document.createElement('div');
    const parts = create({ container, containerId: 'given' });

    expect(parts.container).toBe(container);
    expect(container.id).toBe('given');
    expect(container.dataset.reactIsland).toBe('shared-search-input');
    expect(parts.input.parentElement).toBe(container);
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
    expect(parts.divider.dataset.visible).toBe('true');
  });

  it('shows the underline and the right icon\'s hover look through attributes', () => {
    const styleRoot = document.createElement('div').attachShadow({
      mode: 'open'
    });
    const parts = create({
      showUnderlineWhenEmpty: true,
      styleRoot
    });

    expect(parts.divider.dataset.visible).toBe('true');
    expect(parts.rightIcon.dataset.hoverActive).toBe('false');
    // React follows the pointer with mouseover and mouseout.
    act(() => {
      parts.rightIcon.dispatchEvent(
        new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body })
      );
    });
    expect(parts.rightIcon.dataset.hoverActive).toBe('true');
    expect(parts.rightIcon.getAttribute('style')).toBeNull();
    act(() => {
      parts.rightIcon.dispatchEvent(
        new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })
      );
    });
    expect(parts.rightIcon.dataset.hoverActive).toBe('false');
  });

  it('hides the underline under a surface border of its own', () => {
    const parts = create({ inputStyleOverrides: { 'border-bottom': '1px solid red' } });

    act(() => {
      parts.input.value = 'lumno';
      parts.input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    });

    expect(parts.divider.dataset.visible).toBe('false');
  });

  it('shows the clear button while the field has text and clears it in place', () => {
    const onInput = vi.fn();
    const parts = create({
      clearAction: { ariaLabel: 'Clear', id: 'clear', styleOverrides: { '--x-ext-input-clear-right': '79px' } },
      onInput
    });
    const clear = required(parts.clearAction, 'parts.clearAction');
    expect(clear.hidden).toBe(true);
    expect(clear.style.getPropertyValue('--x-ext-input-clear-right')).toBe('79px');

    act(() => {
      parts.input.focus();
      parts.input.value = 'lumno';
      parts.input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    });
    expect(clear.hidden).toBe(false);

    const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    act(() => {
      clear.dispatchEvent(press);
      clear.click();
    });
    expect(press.defaultPrevented).toBe(true);
    expect(parts.input.value).toBe('');
    expect(onInput).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(parts.input);
    expect(clear.hidden).toBe(true);
  });

  it('keeps the buttons\' icons in place while the user types', () => {
    const parts = create({ clearAction: { id: 'clear' } });
    const rightIconGlyph = parts.rightIcon.firstElementChild;
    const clearGlyph = required(parts.clearAction, 'parts.clearAction').firstElementChild;

    act(() => {
      parts.input.value = 'l';
      parts.input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      parts.input.value = 'lu';
      parts.input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    });

    expect(parts.rightIcon.firstElementChild).toBe(rightIconGlyph);
    expect(parts.clearAction?.firstElementChild).toBe(clearGlyph);
  });

  it('makes the search icon a scope button while the surface asks', () => {
    const parts = create();
    const onActivate = vi.fn();
    expect(parts.icon.getAttribute('role')).toBeNull();

    act(() => parts.chrome.setState({ scopeAction: { enabled: true, label: 'Open scopes', onActivate } }));
    expect(parts.icon.getAttribute('role')).toBe('button');
    expect(parts.icon.tabIndex).toBe(0);
    expect(parts.icon.getAttribute('aria-label')).toBe('Open scopes');
    expect(parts.icon.dataset.tooltip).toBe('Open scopes');

    const enter = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' });
    act(() => {
      parts.icon.focus();
      parts.icon.dispatchEvent(enter);
    });
    expect(enter.defaultPrevented).toBe(true);
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(document.activeElement).not.toBe(parts.icon);

    act(() => parts.icon.click());
    expect(onActivate).toHaveBeenCalledTimes(2);

    act(() => parts.icon.focus());
    expect(document.activeElement).toBe(parts.icon);
    act(() => parts.chrome.setState({ scopeAction: { enabled: false, label: 'Open scopes', onActivate } }));
    expect(parts.icon.getAttribute('aria-disabled')).toBe('true');
    expect(parts.icon.tabIndex).toBe(-1);
    expect(parts.icon.dataset.tooltip).toBeUndefined();
    expect(document.activeElement).not.toBe(parts.icon);
    act(() => parts.icon.click());
    expect(onActivate).toHaveBeenCalledTimes(2);
  });

  it('takes the buttons\' labels and the underline from the surface', () => {
    const parts = create({
      clearAction: { ariaLabel: 'Clear', id: 'clear' },
      secondaryAction: { ariaLabel: 'Close other tabs', icon: { name: 'ri-brush-2-line' }, id: 'close-tabs' }
    });

    act(() => parts.chrome.setState({ rightIconLabel: '设置', clearLabel: '清空', secondaryLabel: '关闭其他标签页', underline: true }));

    expect(parts.rightIcon.getAttribute('aria-label')).toBe('设置');
    expect(parts.clearAction?.getAttribute('aria-label')).toBe('清空');
    expect(parts.secondaryAction?.getAttribute('aria-label')).toBe('关闭其他标签页');
    expect(parts.secondaryAction?.dataset.tooltip).toBe('关闭其他标签页');
    expect(parts.divider.dataset.visible).toBe('true');
    act(() => parts.chrome.setState({ underline: false }));
    act(() => {
      parts.input.value = 'lumno';
      parts.input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    });
    expect(parts.divider.dataset.visible).toBe('false');
  });

  it('shows the secondary action\'s hover look while the pointer is over it', () => {
    const parts = create({ secondaryAction: { ariaLabel: 'Close other tabs', icon: { name: 'ri-brush-2-line' }, id: 'close-tabs' } });
    const button = required(parts.secondaryAction, 'parts.secondaryAction');

    act(() => {
      button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
    });
    expect(button.dataset.hoverActive).toBe('true');
    act(() => {
      button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    });
    expect(button.dataset.hoverActive).toBeUndefined();
  });

  it('binds the surface\'s tooltip to its buttons with their current labels', () => {
    const parts = create({
      clearAction: { ariaLabel: 'Clear', id: 'clear' },
      secondaryAction: { ariaLabel: 'Close other tabs', icon: { name: 'ri-brush-2-line' }, id: 'close-tabs' }
    });
    const texts = new Map<HTMLElement, () => string>();
    const tooltip = {
      bind: vi.fn((button: HTMLElement, getText: () => string) => {
        texts.set(button, getText);
      }),
      hide: vi.fn()
    };
    const onActivate = vi.fn();

    act(() => parts.chrome.setState({ tooltip, scopeAction: { enabled: true, label: 'Open scopes', onActivate } }));
    const secondary = required(parts.secondaryAction, 'parts.secondaryAction');
    expect(texts.get(parts.icon)?.()).toBe('Open scopes');
    expect(texts.get(parts.rightIcon)?.()).toBe('Settings');
    expect(texts.get(secondary)?.()).toBe('Close other tabs');

    act(() => parts.chrome.setState({ rightIconLabel: '设置', scopeAction: { enabled: false, label: 'Open scopes', onActivate } }));
    expect(texts.get(parts.rightIcon)?.()).toBe('设置');
    expect(texts.get(parts.icon)?.()).toBe('');

    act(() => parts.rightIcon.click());
    act(() => secondary.click());
    expect(tooltip.hide).toHaveBeenCalledTimes(2);
  });

  it('shows the mode badge the surface asks for and keeps its text while hiding', () => {
    const parts = create({ modeBadge: { id: 'badge', surface: 'newtab', visible: false } });
    const badge = required(parts.modeBadge, 'parts.modeBadge');
    expect(badge.dataset.visible).toBe('false');

    act(() => parts.chrome.setState({ badgeVisible: true, badgeText: '模式：深色' }));
    expect(badge.dataset.visible).toBe('true');
    expect(badge.textContent).toBe('模式：深色');

    act(() => parts.chrome.setState({ badgeVisible: false }));
    expect(badge.dataset.visible).toBe('false');
    expect(badge.textContent).toBe('模式：深色');
  });

  it('follows text the surface sets itself once asked', () => {
    const parts = create({ clearAction: { id: 'clear' } });
    const clear = required(parts.clearAction, 'parts.clearAction');

    parts.input.value = 'set by the surface';
    expect(clear.hidden).toBe(true);
    let visible = false;
    act(() => {
      visible = parts.syncClearAction();
    });

    expect(visible).toBe(true);
    expect(clear.hidden).toBe(false);
    expect(parts.divider.dataset.visible).toBe('true');
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
        icon: { name: 'ri-brush-2-line', size: 16 },
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

  it('asks in a popconfirm before running a confirmed secondary action', () => {
    const onConfirm = vi.fn();
    const getCopy = vi.fn(() => ({
      confirmLabel: 'Close',
      confirmLabelKey: 'close_confirm_button',
      message: 'Close other tabs?',
      messageKey: 'close_confirm'
    }));
    const parts = create({
      secondaryAction: {
        ariaLabel: 'Close other tabs',
        confirm: { getCopy, onConfirm },
        icon: { name: 'ri-brush-2-line' },
        id: 'close-tabs'
      }
    });
    const trigger = required(parts.secondaryAction, 'parts.secondaryAction');
    const popconfirm = getElement(parts.container, '.x-lumno-search-input__popconfirm');

    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-controls')).toBe(popconfirm.id);
    expect(popconfirm.dataset.open).toBe('false');

    act(() => trigger.click());
    expect(getCopy).toHaveBeenCalledTimes(1);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(popconfirm.dataset.open).toBe('true');
    expect(popconfirm.getAttribute('aria-label')).toBe('Close other tabs?');
    expect(onConfirm).not.toHaveBeenCalled();

    // No Cancel button: the action button itself closes the bubble again.
    const buttons = getTags(popconfirm, 'button', 'button');
    expect(buttons).toHaveLength(1);
    const [confirm] = Array.from(buttons);
    expect(confirm.dataset.i18n).toBe('close_confirm_button');
    act(() => trigger.click());
    expect(popconfirm.dataset.open).toBe('false');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(onConfirm).not.toHaveBeenCalled();

    act(() => trigger.click());
    act(() => confirm.click());
    expect(popconfirm.dataset.open).toBe('false');
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toBeInstanceOf(MouseEvent);
  });

  it('closes the popconfirm on Escape and outside pointerdown without bubbling Escape', () => {
    const onDocumentKeyDown = vi.fn();
    const parts = create({
      secondaryAction: {
        icon: { name: 'ri-brush-2-line' },
        confirm: {
          getCopy: () => ({
                  confirmLabel: 'Close',
            message: 'Close other tabs?',
            messageKey: 'close_confirm'
          }),
          onConfirm: vi.fn()
        },
        id: 'close-tabs'
      }
    });
    const trigger = required(parts.secondaryAction, 'parts.secondaryAction');
    const popconfirm = getElement(parts.container, '.x-lumno-search-input__popconfirm');
    document.addEventListener('keydown', onDocumentKeyDown);

    act(() => trigger.click());
    act(() => {
      trigger.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })
      );
    });
    expect(popconfirm.dataset.open).toBe('false');
    expect(onDocumentKeyDown).not.toHaveBeenCalled();

    act(() => trigger.click());
    act(() => {
      parts.input.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    expect(popconfirm.dataset.open).toBe('false');
    document.removeEventListener('keydown', onDocumentKeyDown);
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
