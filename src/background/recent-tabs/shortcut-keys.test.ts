import { describe, expect, it } from 'vitest';
import { getShortcutCommitModifierEventKey, getShortcutReleaseEventKeys, getShortcutTriggerEventKey } from './shortcut-keys';

describe('the keys of a tab switcher shortcut', () => {
  it.each([
    ['Command+1', 'Meta'],
    ['Ctrl+Shift+J', 'Control'],
    ['Alt+Q', 'Alt'],
    ['Shift+F2', 'Shift'],
    ['⌘1', 'Meta'],
    ['⌃⇧/', 'Control'],
    ['', '']
  ])('holds %j by its primary modifier %j', (shortcut, key) => {
    expect(getShortcutCommitModifierEventKey(shortcut)).toBe(key);
  });

  it.each([
    ['Command+1', '1'],
    ['Command+Shift+J', 'j'],
    ['Ctrl+Shift+/', '/'],
    ['⌘1', '1'],
    ['⌃⇧/', '/'],
    ['Shift+F2', 'F2'],
    ['Ctrl+Shift+Comma', ','],
    // macOS shows a Ctrl+Tab binding as ⌃⇥.
    ['⌃⇥', 'Tab'],
    ['Ctrl+Tab', 'Tab']
  ])('triggers %j on the key %j', (shortcut, key) => {
    expect(getShortcutTriggerEventKey(shortcut)).toBe(key);
  });

  it.each([
    ['Command+1', ['Meta']],
    ['Command+Shift+J', ['Meta']],
    ['⌘1', ['Meta']],
    ['⌃⇧/', ['Control']],
    ['Ctrl+Shift+/', ['Control']],
    ['Alt+Shift+Q', ['Alt']],
    ['Alt+Q', ['Alt']],
    ['⌃⇥', ['Control']]
  ])('commits %j when %j is released', (shortcut, keys) => {
    expect(getShortcutReleaseEventKeys(shortcut)).toEqual(keys);
  });
});
