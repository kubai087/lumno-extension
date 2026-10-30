import { describe, expect, it } from 'vitest';
import { canBeChromeCommandShortcut, describeKeyboardEvent, descriptorMatchesShortcut, eventMatchesShortcut, parseShortcut } from './shortcut-key-matcher';

const macEvent = describeKeyboardEvent({ code: 'KeyK', key: 'K', ctrlKey: false, altKey: false, shiftKey: true, metaKey: true });
const slashEvent = describeKeyboardEvent({ code: 'Slash', key: '?', ctrlKey: true, altKey: true, shiftKey: true, metaKey: false });

describe('shortcut key matching', () => {
  it('describes a key press by its modifiers and lowercase key', () => {
    expect(macEvent).toEqual({ ctrlKey: false, altKey: false, shiftKey: true, metaKey: true, key: 'k' });
  });

  it('matches the browser-bound macOS shortcut and not one with other modifiers', () => {
    expect(descriptorMatchesShortcut(macEvent, 'Command+Shift+K')).toBe(true);
    expect(descriptorMatchesShortcut(macEvent, 'Ctrl+Shift+K')).toBe(false);
  });

  it('matches punctuation by its physical key', () => {
    expect(descriptorMatchesShortcut(slashEvent, 'Ctrl+Alt+Shift+Slash')).toBe(true);
    expect(eventMatchesShortcut({ code: 'Equal', key: '+', ctrlKey: true }, 'Ctrl+Equal')).toBe(true);
  });

  it('asks the worker about a modified key press but not about ordinary typing', () => {
    expect(canBeChromeCommandShortcut(slashEvent)).toBe(true);
    expect(canBeChromeCommandShortcut(describeKeyboardEvent({ code: 'KeyA', key: 'a' }))).toBe(false);
  });

  it('matches nothing with an invalid shortcut', () => {
    expect(descriptorMatchesShortcut(macEvent, 'Command+Unknown+K')).toBe(false);
  });

  it('reads compact macOS symbols and named keys', () => {
    expect(parseShortcut('⌘⇧K')).toEqual({ ctrl: false, alt: false, shift: true, meta: true, key: 'k' });
    expect(parseShortcut('Ctrl+ArrowUp')).toEqual({ ctrl: true, alt: false, shift: false, meta: false, key: 'ArrowUp' });
  });
});
