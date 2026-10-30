import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createController } from './cursor-tooltip';
import { HOST_CLASS, TAG_CLASS, TAG_KEY_CLASS, TAG_LABEL_CLASS, WINDOWS_LOGO_CLASS } from './cursor-tooltip-model';
import type { CursorTooltipController, CursorTooltipWindow } from './cursor-tooltip-model';
import { getTestPortals } from '../../../tests/fakes/portals';
import { getElement, required } from '../../../tests/fakes/dom';
import { parseStylesheet, readStylesheet } from '../../../tests/fakes/css';

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

let controllers: CursorTooltipController[] = [];

// A window whose frames run at once; its timers run at once too, unless the
// test holds them to run later.
function createWindow(options: { platform?: string; heldTimers?: Array<() => void> } = {}) {
  const keys = new EventTarget();
  const navigator = { platform: options.platform || 'MacIntel', userAgent: options.platform === 'Win32' ? 'Windows' : 'Macintosh' };
  const held = options.heldTimers;
  const windowObj: CursorTooltipWindow = {
    innerWidth: 320,
    innerHeight: 240,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    },
    setTimeout: (callback: () => void) => {
      if (!held) {
        callback();
        return 1;
      }
      held.push(callback);
      return held.length;
    },
    clearTimeout: () => {},
    navigator,
    addEventListener: keys.addEventListener.bind(keys),
    removeEventListener: keys.removeEventListener.bind(keys)
  };
  return { windowObj, keys, navigator };
}

function createTooltip(windowObj: CursorTooltipWindow, id = '_x_extension_test_cursor_tooltip_2026_unique_'): CursorTooltipController {
  const controller = createController({ portals: getTestPortals(), windowObj, id });
  controllers.push(controller);
  return controller;
}

function setBox(element: HTMLElement, box: Box): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ x: box.left, y: box.top, width: box.width, height: box.height }));
}

function createTarget(tag = 'button', parent: HTMLElement = document.body, box: Box = { left: 120, top: 80, width: 32, height: 32 }): HTMLElement {
  const target = document.createElement(tag);
  setBox(target, box);
  parent.appendChild(target);
  return target;
}

function pointer(target: EventTarget, type: string, init: MouseEventInit = {}): void {
  act(() => {
    target.dispatchEvent(new MouseEvent(type, { bubbles: type === 'pointermove', ...init }));
  });
}

function key(keys: EventTarget, type: 'keydown' | 'keyup', metaKey: boolean): void {
  act(() => {
    keys.dispatchEvent(new KeyboardEvent(type, { key: 'Meta', metaKey }));
  });
}

function getTag(): HTMLElement {
  return getElement(document.body, `.${TAG_CLASS}`);
}

// What a show returned, read after act() ran it.
function showIn(run: () => HTMLElement | null): HTMLElement | null {
  const shown: { element: HTMLElement | null } = { element: null };
  act(() => {
    shown.element = run();
  });
  return shown.element;
}

function topOf(element: HTMLElement): number {
  return Number.parseInt(element.style.getPropertyValue('top'), 10);
}

afterEach(() => {
  act(() => controllers.forEach((controller) => controller.destroy()));
  controllers = [];
});

describe('cursor tooltip', () => {
  it('shows only when shouldShow allows, offset from the pointer, as the shared tooltip', () => {
    const controller = createTooltip(createWindow().windowObj);
    const target = createTarget();
    expect(showIn(() => controller.show(target, 'A very long bookmark title', { clientX: 100, clientY: 120 }, {
      checkActive: false,
      shouldShow: () => false
    }))).toBeNull();
    const element = required(showIn(() => controller.show(target, 'A very long bookmark title', { clientX: 100, clientY: 120 }, {
      checkActive: false,
      shouldShow: () => true
    })), 'cursor tooltip');
    expect(element.classList.contains('_x_extension_tooltip_2026_unique_')).toBe(true);
    expect(element.getAttribute('data-tooltip-kind')).toBe('cursor');
    expect(element.getAttribute('data-visible')).toBe('true');
    expect(element.style.getPropertyValue('left')).toBe('114px');
    expect(element.style.getPropertyValue('top')).toBe('136px');
    act(() => {
      controller.show(target, '我觉得完整标题', { clientX: 100, clientY: 120 }, { checkActive: false });
    });
    expect(element.textContent).toBe('我觉得完整标题');
  });

  it('draws an action tag as its own bubble above the tooltip, and follows the pointer', () => {
    const controller = createTooltip(createWindow().windowObj);
    const target = createTarget();
    const element = required(showIn(() => controller.show(target, 'A very long bookmark title', { clientX: 100, clientY: 120 }, {
      checkActive: false,
      tagText: '后台打开'
    })), 'cursor tooltip');
    const tag = getTag();
    expect(element.getAttribute('data-cursor-tooltip-tag-visible')).toBe('true');
    expect(tag).not.toBe(element);
    expect(element.querySelector(`.${TAG_CLASS}`)).toBeNull();
    expect(getElement(tag, `.${TAG_KEY_CLASS}`).textContent).toBe('⌘');
    expect(getElement(tag, `.${TAG_LABEL_CLASS}`).textContent).toBe('后台打开');
    expect(tag.getAttribute('data-visible')).toBe('true');
    expect(topOf(tag)).toBeLessThan(topOf(element));

    act(() => {
      controller.move({ clientX: 50, clientY: 60 });
    });
    expect(element.style.getPropertyValue('left')).toBe('64px');
    expect(element.style.getPropertyValue('top')).toBe('76px');
    // A move without tag text hides the tag.
    expect(tag.getAttribute('data-visible')).toBe('false');
    act(() => {
      controller.hide();
    });
    expect(element.getAttribute('data-visible')).toBe('false');
    expect(tag.getAttribute('data-visible')).toBe('false');
  });

  it('draws the Windows logo, not "win", as the tag key on Windows', () => {
    const controller = createTooltip(createWindow({ platform: 'Win32' }).windowObj);
    const target = createTarget();
    act(() => {
      controller.show(target, 'A very long bookmark title', { clientX: 100, clientY: 120 }, { checkActive: false, tagText: '后台打开' });
    });
    const keycap = getElement(getTag(), `.${TAG_KEY_CLASS}`);
    expect(keycap.textContent).toBe('');
    expect(getElement(keycap, `.${WINDOWS_LOGO_CLASS}`).children).toHaveLength(4);
  });

  it('moves a bound target title aside and asks shouldShow before showing', () => {
    const controller = createTooltip(createWindow().windowObj);
    const target = createTarget();
    target.setAttribute('title', 'Native title');
    const shouldShow = vi.fn(() => false);
    controller.bind(target, () => 'Bound title', { checkActive: false, shouldShow });
    expect(target.getAttribute('title')).toBeNull();
    expect(target.classList.contains(HOST_CLASS)).toBe(true);
    pointer(target, 'pointerenter', { clientX: 140, clientY: 90 });
    expect(shouldShow).toHaveBeenCalledOnce();
    expect(required(controller.element, 'cursor tooltip').getAttribute('data-visible')).not.toBe('true');
  });

  it('passes the pointer modifiers to shouldShow and the tag text', () => {
    const controller = createTooltip(createWindow().windowObj);
    const target = createTarget();
    controller.bind(target, () => 'Modifier title', {
      checkActive: false,
      shouldShow: (_target, event) => Boolean(event && event.metaKey),
      getTagText: (event) => (event && event.metaKey ? '后台打开' : '')
    });
    pointer(target, 'pointerenter', { clientX: 140, clientY: 90, metaKey: true });
    const element = required(controller.element, 'cursor tooltip');
    expect(element.getAttribute('data-visible')).toBe('true');
    expect(element.getAttribute('data-cursor-tooltip-tag-visible')).toBe('true');
    expect(element.querySelector(`.${TAG_CLASS}`)).toBeNull();
  });

  it('adds and removes the action tag as Command is pressed and released', () => {
    const { windowObj, keys } = createWindow();
    const controller = createTooltip(windowObj);
    const target = createTarget();
    controller.bind(target, () => 'Live modifier title', {
      checkActive: false,
      shouldShow: () => true,
      getTagText: (event) => (event && event.metaKey ? '后台打开' : '')
    });
    pointer(target, 'pointerenter', { clientX: 120, clientY: 100 });
    const element = required(controller.element, 'cursor tooltip');
    expect(element.getAttribute('data-cursor-tooltip-tag-visible')).toBe('false');
    key(keys, 'keydown', true);
    const tag = getTag();
    expect(element.getAttribute('data-cursor-tooltip-tag-visible')).toBe('true');
    expect(getElement(tag, `.${TAG_KEY_CLASS}`).textContent).toBe('⌘');
    expect(getElement(tag, `.${TAG_LABEL_CLASS}`).textContent).toBe('后台打开');
    expect(topOf(tag)).toBeLessThan(topOf(element));
    key(keys, 'keyup', false);
    expect(element.getAttribute('data-cursor-tooltip-tag-visible')).toBe('false');
    expect(tag.getAttribute('data-visible')).toBe('false');
  });

  it('shows on an already hovered target once Command satisfies shouldShow, and hides on release', () => {
    const { windowObj, keys } = createWindow();
    const controller = createTooltip(windowObj);
    const target = createTarget();
    controller.bind(target, () => 'Background-only title', {
      checkActive: false,
      shouldShow: (_target, event) => Boolean(event && event.metaKey),
      getTagText: (event) => (event && event.metaKey ? '后台打开' : '')
    });
    pointer(target, 'pointerenter', { clientX: 150, clientY: 110, metaKey: false });
    const element = required(controller.element, 'cursor tooltip');
    expect(element.getAttribute('data-visible')).not.toBe('true');
    key(keys, 'keydown', true);
    expect(element.getAttribute('data-visible')).toBe('true');
    expect(element.getAttribute('data-cursor-tooltip-tag-visible')).toBe('true');
    expect(getTag().getAttribute('data-visible')).toBe('true');
    key(keys, 'keyup', false);
    expect(element.getAttribute('data-visible')).toBe('false');
    expect(getTag().getAttribute('data-visible')).toBe('false');
  });
});

describe('cursor tooltip handoff between targets', () => {
  const SWITCH = { checkActive: false, deferHideVisibility: true, preserveVisibleOnTargetSwitch: true };

  function text(controller: CursorTooltipController): string {
    return required(controller.element, 'cursor tooltip').textContent || '';
  }

  function visibilityWrites(element: HTMLElement) {
    const setAttribute = vi.spyOn(element, 'setAttribute');
    return () => setAttribute.mock.calls.filter(([name]) => name === 'data-visible').map(([, value]) => value);
  }

  it('stays on screen from a title to the URL beside it, and hides on leaving the pair', () => {
    const controller = createTooltip(createWindow({ heldTimers: [] }).windowObj, '_x_extension_test_cursor_switch_tooltip_2026_unique_');
    const row = createTarget('div');
    const title = createTarget('span', row);
    const url = createTarget('span', row);
    const unrelated = createTarget('span');
    controller.bind(title, () => '完整标题', SWITCH);
    controller.bind(url, () => 'https://x.com/example/status/1', SWITCH);
    pointer(title, 'pointerenter', { clientX: 120, clientY: 100 });
    const element = required(controller.element, 'cursor tooltip');
    expect(element.getAttribute('data-visible')).toBe('true');
    pointer(title, 'pointerleave', { relatedTarget: url });
    expect(element.getAttribute('data-visible')).toBe('true');
    const writes = visibilityWrites(element);
    pointer(url, 'pointerenter', { clientX: 180, clientY: 100 });
    expect(element.getAttribute('data-visible')).toBe('true');
    // The bubble's content is replaced directly, without replaying the hidden state.
    expect(writes()).not.toContain('false');
    expect(text(controller)).toBe('https://x.com/example/status/1');
    // A stale move from the previous target is ignored.
    pointer(title, 'pointermove', { clientX: 121, clientY: 100 });
    expect(text(controller)).toBe('https://x.com/example/status/1');
    pointer(url, 'pointerleave', { relatedTarget: unrelated });
    expect(element.getAttribute('data-visible')).toBe('false');
  });

  it('ignores a late leave, stale moves and layout-shift enters of the previous target', () => {
    const held: Array<() => void> = [];
    const controller = createTooltip(createWindow({ heldTimers: held }).windowObj, '_x_extension_test_cursor_reversed_switch_tooltip_2026_unique_');
    const row = createTarget('div');
    const title = createTarget('span', row, { left: 120, top: 80, width: 50, height: 32 });
    const url = createTarget('span', row, { left: 176, top: 80, width: 84, height: 32 });
    controller.bind(title, () => '迟到标题', SWITCH);
    controller.bind(url, () => 'https://x.com/reversed/status/1', SWITCH);
    pointer(title, 'pointerenter', { clientX: 120, clientY: 100 });
    pointer(url, 'pointerenter', { clientX: 180, clientY: 100, relatedTarget: title });
    expect(text(controller)).toBe('https://x.com/reversed/status/1');
    pointer(title, 'pointerleave', { relatedTarget: url });
    expect(text(controller)).toBe('https://x.com/reversed/status/1');
    pointer(title, 'pointermove', { clientX: 121, clientY: 100 });
    expect(text(controller)).toBe('https://x.com/reversed/status/1');
    // An enter while the pointer is still over the URL.
    pointer(title, 'pointerenter', { clientX: 190, clientY: 100, relatedTarget: url });
    expect(text(controller)).toBe('https://x.com/reversed/status/1');
    // The row's layout shifts under a pointer that stays put.
    setBox(title, { left: 120, top: 80, width: 90, height: 32 });
    setBox(url, { left: 220, top: 80, width: 84, height: 32 });
    pointer(url, 'pointerleave', { clientX: 180, clientY: 100, relatedTarget: title });
    expect(text(controller)).toBe('https://x.com/reversed/status/1');
    pointer(title, 'pointerenter', { clientX: 180, clientY: 100, relatedTarget: url });
    expect(text(controller)).toBe('https://x.com/reversed/status/1');
    act(() => held.forEach((callback) => callback()));
    // The late leave scheduled no delayed hide.
    expect(required(controller.element, 'cursor tooltip').getAttribute('data-visible')).toBe('true');
  });

  it('swaps a row tooltip text in place as the pointer moves over its parts', () => {
    const controller = createTooltip(createWindow().windowObj, '_x_extension_test_cursor_row_tooltip_2026_unique_');
    const row = createTarget('div');
    const urlLine = createTarget('span', row);
    controller.bind(row, (_target, event) => (event && event.target === urlLine ? 'https://example.com/a/long/address' : '完整标题'), SWITCH);
    pointer(row, 'pointerenter', { clientX: 130, clientY: 90 });
    expect(text(controller)).toBe('完整标题');
    const writes = visibilityWrites(required(controller.element, 'cursor tooltip'));
    pointer(urlLine, 'pointermove', { clientX: 132, clientY: 100 });
    expect(text(controller)).toBe('https://example.com/a/long/address');
    expect(writes()).not.toContain('false');
    pointer(row, 'pointermove', { clientX: 134, clientY: 90 });
    expect(text(controller)).toBe('完整标题');
  });
});

describe('cursor tooltip stylesheet', () => {
  const css = parseStylesheet('src/shared/ui/cursor-tooltip.css');
  const source = readStylesheet('src/shared/ui/cursor-tooltip.css');

  it('suppresses native pseudo tips on its hosts and styles the cursor and tag bubbles', () => {
    expect(source).toContain('._x_extension_cursor_tooltip_host_2026_unique_[data-cursor-tooltip]');
    expect(source).toContain('[data-tooltip-kind="cursor"]');
    expect(source).toContain('[data-tooltip-kind="cursor-tag"]');
    expect(css.selectors().some((selector) => selector.includes(`.${TAG_CLASS}`))).toBe(true);
  });

  it('keeps the keycap a fixed square, slightly raised, with loose tag spacing', () => {
    const keycap = required(css.rule(`.${TAG_KEY_CLASS}`), 'keycap rule');
    expect(keycap.get('flex')).toMatch(/^0 0 var\(--x-extension-cursor-tooltip-key-size/);
    expect(keycap.get('width')).toMatch(/^var\(--x-extension-cursor-tooltip-key-size/);
    expect(keycap.get('height')).toMatch(/^var\(--x-extension-cursor-tooltip-key-size/);
    expect(source).toMatch(/padding:\s*6px 12px 6px 7px/);
    expect(source).toMatch(/gap:\s*8px/);
    expect(source).toMatch(/transform:\s*translateY\(-1px\)/);
  });

  it('draws the Windows keycap as shaped perspective panes', () => {
    expect(required(css.rule(`.${WINDOWS_LOGO_CLASS}`), 'logo rule').get('position')).toBe('relative');
    const paneSelectors = css.selectors().filter((selector) => selector.includes('_x_extension_cursor_tooltip_windows_logo_pane_2026_unique_'));
    expect(paneSelectors.length).toBeGreaterThan(0);
    expect(source).toContain('position: absolute');
    expect(source).toContain('clip-path: polygon(');
  });
});
