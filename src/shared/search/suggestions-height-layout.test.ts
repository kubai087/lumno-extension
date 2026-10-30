import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyNaturalSuggestionsHeightLayout, holdSuggestionsHeight, releaseSuggestionsHeight } from './suggestions-height-layout';

function listOf(height: number): HTMLElement {
  const list = document.createElement('div');
  Object.defineProperty(list, 'offsetHeight', { configurable: true, get: () => height });
  document.body.appendChild(list);
  return list;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.textContent = '';
});

describe('holding the suggestions list height (#120)', () => {
  it('keeps the list at its height until released', () => {
    const list = listOf(356);
    expect(holdSuggestionsHeight(list, window)).toBe(true);
    expect(list.style.minHeight).toBe('356px');
    expect(releaseSuggestionsHeight(list, window)).toBe(true);
    expect(list.style.minHeight).toBe('');
    expect(releaseSuggestionsHeight(list, window)).toBe(false);
  });

  it('lets go on its own after the timeout', () => {
    const list = listOf(356);
    holdSuggestionsHeight(list, window, 1000);
    vi.advanceTimersByTime(999);
    expect(list.style.minHeight).toBe('356px');
    vi.advanceTimersByTime(1);
    expect(list.style.minHeight).toBe('');
  });

  it('takes the height again on a new hold, and holds nothing for an empty list', () => {
    const list = listOf(132);
    holdSuggestionsHeight(list, window);
    Object.defineProperty(list, 'offsetHeight', { configurable: true, get: () => 356 });
    holdSuggestionsHeight(list, window);
    expect(list.style.minHeight).toBe('356px');
    expect(holdSuggestionsHeight(listOf(0), window)).toBe(false);
    expect(holdSuggestionsHeight(null, window)).toBe(false);
  });

  it('leaves a min-height set since by someone else, such as a collapse', () => {
    const list = listOf(356);
    holdSuggestionsHeight(list, window);
    list.style.setProperty('min-height', '0px');
    releaseSuggestionsHeight(list, window);
    expect(list.style.minHeight).toBe('0px');
  });
});

describe('natural suggestions height', () => {
  it('clears the height states and constraints, turns height transitions off and keeps the safety caps', () => {
    const list = document.createElement('div');
    ['data-height-clipped', 'data-input-height-locked', 'data-resizing'].forEach((name) => list.setAttribute(name, 'true'));
    [['flex', '0 0 auto'], ['height', '580px'], ['overflow-y', 'hidden'], ['padding-top', '12px'],
      ['transition', 'height 180ms ease-in-out'], ['will-change', 'height']].forEach(([name, value]) => {
      list.style.setProperty(name, value, 'important');
    });
    list.style.setProperty('max-height', '420px');
    expect(applyNaturalSuggestionsHeightLayout(list)).toBe(true);
    expect(list.getAttributeNames()).toEqual(['style']);
    ['flex', 'height', 'overflow-y', 'padding-top', 'will-change'].forEach((name) => expect([name, list.style.getPropertyValue(name)]).toEqual([name, '']));
    expect([list.style.getPropertyValue('transition'), list.style.getPropertyPriority('transition')]).toEqual(['none', 'important']);
    expect([list.style.getPropertyValue('max-height'), list.style.getPropertyPriority('max-height')]).toEqual(['420px', '']);
  });

  it('does nothing without a list', () => {
    expect(applyNaturalSuggestionsHeightLayout(null)).toBe(false);
  });
});
