import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OverlayTypeAhead, TYPE_AHEAD_HOLD_MS, TYPE_AHEAD_MAX_AGE_MS } from './overlay-type-ahead';
import { dispatchTrusted, trustedKey } from '../../tests/fakes/trusted-events';

// A page editor that takes the keys it hears, like a Google Sheets cell.
function createPageEditor() {
  const editor = document.body.appendChild(document.createElement('div'));
  editor.setAttribute('contenteditable', 'true');
  const heard: string[] = [];
  window.addEventListener('keydown', (event) => {
    heard.push(event.key);
  }, true);
  return { editor, heard };
}

function typeKeys(target: EventTarget, keys: string[], init: KeyboardEventInit = {}): KeyboardEvent[] {
  return keys.map((key) => trustedKey(target, 'keydown', { key, ...init }));
}

describe('OverlayTypeAhead', () => {
  let overlayOpen: boolean;
  let typeAhead: OverlayTypeAhead;

  beforeEach(() => {
    vi.useFakeTimers();
    overlayOpen = false;
    // Started before the page's own listeners, as at document start.
    typeAhead = new OverlayTypeAhead(window, { isOverlayOpen: () => overlayOpen });
    typeAhead.start();
  });

  afterEach(() => {
    typeAhead.cancel();
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('leaves keys to the page until the overlay starts opening', () => {
    const { editor, heard } = createPageEditor();
    const [event] = typeKeys(editor, ['a']);
    expect(heard).toEqual(['a']);
    expect(event?.defaultPrevented).toBe(false);
    expect(typeAhead.take()).toBe('');
  });

  it('holds the printable keys typed while the overlay opens and hands them over once', () => {
    const { editor, heard } = createPageEditor();
    typeAhead.arm();
    const events = typeKeys(editor, ['a', 'b', ' ', 'é', 'x', 'Backspace']);
    expect(heard).toEqual([]);
    expect(events.every((event) => event.defaultPrevented)).toBe(true);
    expect(typeAhead.take()).toBe('ab é');
    expect(typeAhead.take()).toBe('');
    typeKeys(editor, ['c']);
    expect(heard).toEqual(['c']);
  });

  it('leaves the page its shortcuts, Escape, arrows, untrusted keys and IME composition', () => {
    const { editor, heard } = createPageEditor();
    typeAhead.arm();
    typeKeys(editor, ['c'], { metaKey: true });
    typeKeys(editor, ['v'], { ctrlKey: true });
    typeKeys(editor, ['å'], { altKey: true });
    typeKeys(editor, ['Escape', 'ArrowDown']);
    typeKeys(editor, ['n'], { isComposing: true });
    typeKeys(editor, ['Enter'], { isComposing: true });
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }));
    expect(heard).toEqual(['c', 'v', 'å', 'Escape', 'ArrowDown', 'n', 'Enter', 'z']);
    expect(typeAhead.take()).toBe('');
  });

  it('keeps Enter, Tab and the deleting keys from the page without adding them to the text', () => {
    const { editor, heard } = createPageEditor();
    typeAhead.arm();
    const beforeText = typeKeys(editor, ['Backspace', 'Delete', 'Enter', 'Tab']);
    typeKeys(editor, ['a']);
    const afterText = typeKeys(editor, ['Enter'], { shiftKey: true });
    expect(heard).toEqual([]);
    expect([...beforeText, ...afterText].every((event) => event.defaultPrevented)).toBe(true);
    expect(typeAhead.take()).toBe('a');
  });

  it('does not arm while the overlay is open, since the shortcut then closes it', () => {
    const { editor, heard } = createPageEditor();
    overlayOpen = true;
    typeAhead.arm();
    typeKeys(editor, ['a']);
    expect(heard).toEqual(['a']);
    expect(typeAhead.isHolding()).toBe(false);
  });

  it('keeps what was typed when armed again, and stops holding after a while', () => {
    const { editor, heard } = createPageEditor();
    typeAhead.arm();
    typeKeys(editor, ['a']);
    vi.advanceTimersByTime(TYPE_AHEAD_HOLD_MS - 100);
    typeAhead.arm();
    typeKeys(editor, ['b']);
    vi.advanceTimersByTime(TYPE_AHEAD_HOLD_MS);
    typeKeys(editor, ['c']);
    expect(heard).toEqual(['c']);
    expect(typeAhead.take()).toBe('ab');
  });

  it('drops what it held when the overlay does not open or the text is stale', () => {
    const { editor } = createPageEditor();
    typeAhead.arm();
    typeKeys(editor, ['a']);
    typeAhead.cancel();
    expect(typeAhead.take()).toBe('');

    typeAhead.arm();
    typeKeys(editor, ['b']);
    vi.advanceTimersByTime(TYPE_AHEAD_MAX_AGE_MS + 1);
    expect(typeAhead.take()).toBe('');
  });

  it('stops holding on a click or when the window loses focus, keeping what it held', () => {
    const { editor, heard } = createPageEditor();
    typeAhead.arm();
    typeKeys(editor, ['a']);
    dispatchTrusted(editor, new MouseEvent('pointerdown', { bubbles: true, composed: true }));
    typeKeys(editor, ['b']);
    expect(heard).toEqual(['b']);
    expect(typeAhead.take()).toBe('a');

    typeAhead.arm();
    typeKeys(editor, ['c']);
    window.dispatchEvent(new FocusEvent('blur'));
    typeKeys(editor, ['d']);
    expect(heard).toEqual(['b', 'd']);
    expect(typeAhead.take()).toBe('c');
  });
});
