import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFolderColorPicker } from './folder-color-picker';
import { parseFolderColor, folderColorToRgb } from './folder-color';
import { getElement, getTag, getTags, required } from '../../../tests/fakes/dom';

let picker: ReturnType<typeof createFolderColorPicker> | undefined;
afterEach(() => { act(() => picker?.destroy()); picker = undefined; document.body.replaceChildren(); });

function setup(overrides: Parameters<typeof createFolderColorPicker>[0] = {}) {
  act(() => {
    picker = createFolderColorPicker({ ...overrides });
    picker.open({ folderId: '123', title: 'Design', color: '#5393FF' });
  });
  return required(picker, 'picker');
}
function input(index: number) { return getTags(document, 'input', 'input')[index]; }
function enter(index: number, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input(index), value);
    input(index).dispatchEvent(new Event('input', { bubbles: true }));
  });
}
function chooseFormat(value: 'hex' | 'rgb') {
  act(() => getTag(document, '.x-nt-folder-color-format button', 'button').click());
  act(() => getElement(document, `.x-nt-folder-color-format-menu [data-value="${value}"]`).click());
}
function button(text: string) {
  const result = Array.from(getTags(document, 'button', 'button')).find((item) => item.textContent === text);
  if (!result) throw new Error(`Missing button ${text}`);
  return result;
}
function swatch(group: 'presets' | 'saved', color: string) {
  const selector = group === 'presets' ? `[data-color="${color}"]` : `[aria-label="${color}"]`;
  return getTag(document, `.x-nt-folder-color-${group} .x-nt-folder-color-swatch${selector}`, 'button');
}

describe('folder color values', () => {
  it('normalizes HEX and RGB while rejecting malformed and out-of-range values', () => {
    expect(parseFolderColor(' #a3f ')).toBe('#AA33FF');
    expect(parseFolderColor('aBcDeF')).toBe('#ABCDEF');
    expect(parseFolderColor('rgb(12, 34, 255)')).toBe('#0C22FF');
    expect(parseFolderColor('0, 0, 0')).toBe('#000000');
    expect(folderColorToRgb('#ffffff')).toBe('rgb(255, 255, 255)');
    for (const value of ['', '#abcd', '#ffffffff', 'rgb(256, 0, 0)', 'rgb(-1, 0, 0)', 'rgb(1.5, 0, 0)', 'rgb(1, 2, 3', '1, 2, 3)', 'red', 'rgba(1,2,3,0.5)']) {
      expect(parseFolderColor(value), value).toBeNull();
    }
  });
});

describe('folder color picker', () => {
  it('links both formats and previews only valid values', () => {
    const preview = vi.fn();
    setup({ onPreview: preview });
    enter(0, '#ef4444');
    expect(preview).toHaveBeenLastCalledWith('123', '#EF4444');
    expect(document.querySelectorAll('input')).toHaveLength(1);
    chooseFormat('rgb');
    expect(Array.from(getTags(document, 'input', 'input')).map((element) => element.value)).toEqual(['239', '68', '68']);
    enter(0, '12'); enter(1, '34'); enter(2, '56');
    expect(preview).toHaveBeenLastCalledWith('123', '#0C2238');
    enter(1, '999');
    expect(button('Save').disabled).toBe(true);
    expect(input(1).getAttribute('aria-invalid')).toBe('true');
    expect(preview).toHaveBeenLastCalledWith('123', '#0C2238');
    act(() => swatch('presets', '#5393FF').click());
    expect(button('Save').disabled).toBe(false);
    expect(Array.from(getTags(document, 'input', 'input')).map((element) => element.value)).toEqual(['83', '147', '255']);
    enter(0, '12'); enter(1, '34'); enter(2, '56');
    chooseFormat('hex');
    expect(input(0).value).toBe('#0C2238');
    expect(document.querySelectorAll('input')).toHaveLength(1);
  });
  it('keeps invalid channel drafts until corrected and does not convert incomplete colors', () => {
    const preview = vi.fn();
    setup({ onPreview: preview });
    chooseFormat('rgb');
    enter(0, '');
    chooseFormat('hex');
    expect(document.querySelectorAll('input')).toHaveLength(3);
    expect(input(0).value).toBe('');
    expect(button('Save').disabled).toBe(true);
    expect(preview).toHaveBeenLastCalledWith('123', '#5393FF');
    for (const value of ['-1', '256', '1.5', 'abc', ' 32 ']) {
      enter(0, value);
      expect(input(0).getAttribute('aria-invalid')).toBe('true');
      expect(preview).toHaveBeenLastCalledWith('123', '#5393FF');
    }
    enter(0, '0'); enter(1, '0'); enter(2, '0');
    chooseFormat('hex');
    expect(input(0).value).toBe('#000000');
    expect(button('Save').disabled).toBe(false);
  });
  it('closes the format menu before the dialog when Escape is pressed', () => {
    setup();
    const trigger = getTag(document, '.x-nt-folder-color-format button', 'button');
    act(() => trigger.click());
    act(() => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    expect(required(picker, 'picker').isOpen()).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    act(() => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    expect(required(picker, 'picker').isOpen()).toBe(false);
  });
  it('saves normalized colors and resets by removing the customization', async () => {
    const submit = vi.fn(async () => {});
    setup({ onSubmit: submit });
    enter(0, '#f80');
    await act(async () => { getElement(document, 'form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(submit).toHaveBeenLastCalledWith('123', '#FF8800');
    expect(required(picker, 'picker').isOpen()).toBe(false);
    act(() => required(picker, 'picker').open({ folderId: '123', title: 'Design', color: '#FF8800' }));
    act(() => swatch('presets', '#5393FF').click());
    expect(swatch('presets', '#5393FF').getAttribute('aria-label')).toBe('Default color');
    expect(input(0).value).toBe('#5393FF');
    await act(async () => { getElement(document, 'form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(submit).toHaveBeenLastCalledWith('123', null);
  });
  it('takes presets, a default swatch and an image preview from other callers', async () => {
    const submit = vi.fn(async () => {});
    act(() => {
      picker = createFolderColorPicker({ onSubmit: submit });
      picker.open({
        folderId: 'shortcut-icon-plate', title: 'Shopee', color: '#FDEDEA',
        presets: ['#FDEDEA', '#F8C9C0', '#FFFFFF'], previewImageUrl: 'data:image/png;base64,bG9nbw==',
        labels: { dialog: 'Background color', picker: 'Background color', defaultColor: 'From the icon' }
      });
    });
    expect(getElement(document, '[role="dialog"]').getAttribute('aria-label')).toBe('Background color');
    const preview = getElement(document, '.x-nt-folder-color-plate-preview');
    expect(getElement(preview, 'img').getAttribute('src')).toBe('data:image/png;base64,bG9nbw==');
    expect(preview.style.backgroundColor).toBe('rgb(253, 237, 234)');
    expect(Array.from(document.querySelectorAll('.x-nt-folder-color-presets .x-nt-folder-color-swatch[data-color]'))
      .map((element) => element.getAttribute('data-color'))).toEqual(['#FDEDEA', '#F8C9C0', '#FFFFFF']);
    expect(swatch('presets', '#FDEDEA').getAttribute('aria-label')).toBe('From the icon');
    // The short preset row carries the saved colors and "+" on, in one group.
    expect(document.querySelector('.x-nt-folder-color-saved')).toBeNull();
    expect(document.querySelector('.x-nt-folder-color-presets .x-nt-folder-color-add')).not.toBeNull();
    act(() => swatch('presets', '#FFFFFF').click());
    expect(preview.style.backgroundColor).toBe('rgb(255, 255, 255)');
    await act(async () => { getElement(document, 'form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(submit).toHaveBeenLastCalledWith('shortcut-icon-plate', '#FFFFFF');
    act(() => required(picker, 'picker').open({ folderId: 'shortcut-icon-plate', title: 'Shopee', color: '#FFFFFF', presets: ['#FDEDEA', '#FFFFFF'] }));
    act(() => swatch('presets', '#FDEDEA').click());
    await act(async () => { getElement(document, 'form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(submit).toHaveBeenLastCalledWith('shortcut-icon-plate', null);
    // Opened while the plate follows the icon, saving untouched keeps following it.
    act(() => required(picker, 'picker').open({ folderId: 'shortcut-icon-plate', title: 'Shopee', color: '', presets: ['#FDEDEA', '#FFFFFF'] }));
    expect(swatch('presets', '#FDEDEA').getAttribute('aria-pressed')).toBe('true');
    await act(async () => { getElement(document, 'form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(submit).toHaveBeenLastCalledWith('shortcut-icon-plate', null);
  });
  it('animates in on the next frame and fades out before unmounting', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    try {
      setup();
      const backdrop = getElement(document, '.x-nt-folder-color-backdrop');
      expect(backdrop.getAttribute('data-open')).toBe('false');
      act(() => { vi.advanceTimersToNextFrame(); });
      expect(backdrop.getAttribute('data-open')).toBe('true');
      act(() => button('Cancel').click());
      expect(required(picker, 'picker').isOpen()).toBe(false);
      expect(backdrop.getAttribute('data-open')).toBe('false');
      expect(backdrop.isConnected).toBe(true);
      act(() => { vi.advanceTimersByTime(200); });
      expect(backdrop.isConnected).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
  it('cancels without saving and restores focus', () => {
    const submit = vi.fn();
    const onClose = vi.fn();
    const source = document.createElement('button'); document.body.append(source);
    setup({ onSubmit: submit, onClose });
    act(() => required(picker, 'picker').open({ folderId: '123', title: 'Design', sourceElement: source }));
    enter(0, '#22c55e');
    act(() => input(0).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(required(picker, 'picker').isOpen()).toBe(false);
    expect(submit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(document.activeElement).toBe(source);
  });
  it('keeps the picker open and allows retry when storage fails', async () => {
    setup({ onSubmit: async () => { throw new Error('Storage failed'); } });
    await act(async () => { getElement(document, 'form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(required(picker, 'picker').isOpen()).toBe(true);
    expect(getElement(document, '[role="alert"]').textContent).toContain('Could not save');
    expect(button('Save').disabled).toBe(false);
  });
  it('animates the preview on hover while preserving its current color', () => {
    const animate = vi.fn();
    const preview = vi.fn();
    setup({ animateFolderIcon: animate, onPreview: preview });
    enter(0, '#22c55e');
    const icon = getElement(document, '.x-nt-folder-color-preview');
    act(() => icon.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })));
    expect(animate).toHaveBeenLastCalledWith(icon, true);
    act(() => icon.dispatchEvent(new PointerEvent('pointerout', { bubbles: true })));
    expect(animate).toHaveBeenLastCalledWith(icon, false);
    expect(preview).toHaveBeenLastCalledWith('123', '#22C55E');
    expect(input(0).value).toBe('#22c55e');
  });
  it('saves the current HEX and RGB colors for reuse across folders and picker instances', async () => {
    let stored: string[] = [];
    const saveSavedColors = vi.fn(async (colors: string[]) => { stored = [...colors]; });
    const onSubmit = vi.fn();
    const options = { readSavedColors: async () => stored, saveSavedColors, onSubmit };
    await act(async () => { setup(options); });
    enter(0, '#3a2a5f');
    await act(async () => getTag(document, '.x-nt-folder-color-add', 'button').click());
    expect(saveSavedColors).toHaveBeenLastCalledWith(['#3A2A5F']);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(getTag(document, '.x-nt-folder-color-add', 'button').disabled).toBe(true);
    chooseFormat('rgb');
    enter(0, '12'); enter(1, '34'); enter(2, '56');
    await act(async () => getTag(document, '.x-nt-folder-color-add', 'button').click());
    expect(stored).toEqual(['#3A2A5F', '#0C2238']);
    act(() => button('Cancel').click());
    await act(async () => required(picker, 'picker').open({ folderId: '456', title: 'Other folder' }));
    act(() => getTag(document, '.x-nt-folder-color-saved button[aria-label="#3A2A5F"]', 'button').click());
    expect(input(0).value).toBe('#3A2A5F');
    act(() => required(picker, 'picker').destroy());
    await act(async () => { setup(options); });
    expect(Array.from(document.querySelectorAll('.x-nt-folder-color-saved-item .x-nt-folder-color-swatch')).map((element) => element.getAttribute('aria-label'))).toEqual(stored);
  });
  it('only saves colors that are not already presets or saved', async () => {
    const saveSavedColors = vi.fn(async () => {});
    setup({ saveSavedColors });
    const add = () => getTag(document, '.x-nt-folder-color-add', 'button');
    act(() => swatch('presets', '#8B5CF6').click());
    expect(add().disabled).toBe(true);
    enter(0, '#8b5cf6');
    expect(add().disabled).toBe(true);
    act(() => add().click());
    expect(saveSavedColors).not.toHaveBeenCalled();
    enter(0, '#8b5cf7');
    expect(add().disabled).toBe(false);
    await act(async () => add().click());
    expect(saveSavedColors).toHaveBeenLastCalledWith(['#8B5CF7']);
    expect(swatch('saved', '#8B5CF7').getAttribute('aria-pressed')).toBe('true');
  });
  it('accepts HEX values with or without the leading hash', () => {
    const preview = vi.fn();
    setup({ onPreview: preview });
    for (const [value, expected] of [['14b8a6', '#14B8A6'], ['#22c55e', '#22C55E'], ['f80', '#FF8800'], ['#abc', '#AABBCC']]) {
      enter(0, value);
      expect(input(0).getAttribute('aria-invalid'), value).toBe('false');
      expect(preview).toHaveBeenLastCalledWith('123', expected);
    }
    enter(0, '14b8a6');
    act(() => { input(0).focus(); input(0).blur(); });
    expect(input(0).value).toBe('#14B8A6');
    expect(button('Save').disabled).toBe(false);
  });
  it('opens focused on the selected swatch, or the color area for a custom color', () => {
    setup();
    expect(document.activeElement).toBe(swatch('presets', '#5393FF'));
    act(() => required(picker, 'picker').open({ folderId: '123', title: 'Design', color: '#123456' }));
    expect(document.activeElement).toBe(document.querySelector('.react-colorful__saturation .react-colorful__interactive'));
  });
  it('recognizes stored custom colors on reopen without linking manual edits to presets', async () => {
    await act(async () => { setup({ readSavedColors: async () => ['#5393FF'] }); });
    expect(swatch('saved', '#5393FF').getAttribute('aria-pressed')).toBe('true');
    expect(swatch('presets', '#5393FF').getAttribute('aria-pressed')).toBe('false');
    enter(0, '#5393ff');
    expect(document.querySelectorAll('.x-nt-folder-color-swatch[aria-pressed="true"]')).toHaveLength(0);
    act(() => swatch('saved', '#5393FF').click());
    chooseFormat('rgb');
    enter(0, '083');
    expect(document.querySelectorAll('.x-nt-folder-color-swatch[aria-pressed="true"]')).toHaveLength(0);
    act(() => button('Cancel').click());
    await act(async () => required(picker, 'picker').open({ folderId: '123', title: 'Design', color: '#5393FF' }));
    expect(swatch('saved', '#5393FF').getAttribute('aria-pressed')).toBe('true');
    expect(swatch('presets', '#5393FF').getAttribute('aria-pressed')).toBe('false');
  });
  it('switches to the saved swatch only after saving succeeds', async () => {
    const saveSavedColors = vi.fn().mockRejectedValueOnce(new Error('Storage failed')).mockResolvedValue(undefined);
    const onSubmit = vi.fn(async () => {});
    setup({ saveSavedColors, onSubmit });
    enter(0, '#123456');
    await act(async () => getTag(document, '.x-nt-folder-color-add', 'button').click());
    expect(document.querySelectorAll('.x-nt-folder-color-saved-item')).toHaveLength(0);
    await act(async () => getTag(document, '.x-nt-folder-color-add', 'button').click());
    expect(swatch('saved', '#123456').getAttribute('aria-pressed')).toBe('true');
    await act(async () => { getElement(document, 'form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(onSubmit).toHaveBeenLastCalledWith('123', '#123456');
  });
  it('normalizes stored colors, removes duplicates and limits the saved row to eight colors', async () => {
    const saveSavedColors = vi.fn(async () => {});
    await act(async () => {
      setup({ readSavedColors: async () => ['bad value', '#abcd', '#ff0000', 'rgb(255, 0, 0)', null, '#010101', '#020202', '#030303', '#040404', '#050505', '#060606', '#070707', '#080808'], saveSavedColors });
    });
    const colors = Array.from(document.querySelectorAll('.x-nt-folder-color-saved-item .x-nt-folder-color-swatch')).map((element) => element.getAttribute('aria-label'));
    expect(colors).toEqual(['#FF0000', '#010101', '#020202', '#030303', '#040404', '#050505', '#060606', '#070707']);
    expect(document.querySelector('.x-nt-folder-color-add')).toBeNull();
    expect(saveSavedColors).not.toHaveBeenCalled();
  });
  it('does not save until the palette has loaded and the current color is valid', async () => {
    let resolveRead!: (colors: string[]) => void;
    const saveSavedColors = vi.fn(async () => {});
    setup({ readSavedColors: () => new Promise<string[]>((resolve) => { resolveRead = resolve; }), saveSavedColors });
    expect(getTag(document, '.x-nt-folder-color-add', 'button').disabled).toBe(true);
    await act(async () => {});
    enter(0, 'invalid');
    await act(async () => { resolveRead(['#ABCDEF']); });
    expect(getTag(document, '.x-nt-folder-color-add', 'button').disabled).toBe(true);
    act(() => getTag(document, '.x-nt-folder-color-add', 'button').click());
    expect(saveSavedColors).not.toHaveBeenCalled();
    enter(0, '#abc');
    expect(getTag(document, '.x-nt-folder-color-add', 'button').disabled).toBe(false);
  });
  it('keeps failed palette writes out of the row and allows retry', async () => {
    const saveSavedColors = vi.fn().mockRejectedValueOnce(new Error('Storage failed')).mockResolvedValue(undefined);
    setup({ saveSavedColors });
    enter(0, '#123456');
    await act(async () => getTag(document, '.x-nt-folder-color-add', 'button').click());
    expect(getElement(document, '[role="alert"]').textContent).toContain('Could not save this color');
    expect(document.querySelectorAll('.x-nt-folder-color-saved-item')).toHaveLength(0);
    expect(getTag(document, '.x-nt-folder-color-add', 'button').disabled).toBe(false);
    await act(async () => getTag(document, '.x-nt-folder-color-add', 'button').click());
    expect(saveSavedColors).toHaveBeenLastCalledWith(['#123456']);
    expect(document.querySelectorAll('.x-nt-folder-color-saved-item')).toHaveLength(1);
    expect(required(picker, 'picker').isOpen()).toBe(true);
  });
  it('prevents overwriting an unreadable saved palette with an empty row', async () => {
    const saveSavedColors = vi.fn(async () => {});
    await act(async () => { setup({ readSavedColors: async () => { throw new Error('Read failed'); }, saveSavedColors }); });
    expect(getElement(document, '[role="alert"]').textContent).toContain('Could not load saved colors');
    expect(getTag(document, '.x-nt-folder-color-add', 'button').disabled).toBe(true);
    act(() => getTag(document, '.x-nt-folder-color-add', 'button').click());
    expect(saveSavedColors).not.toHaveBeenCalled();
    expect(button('Save').disabled).toBe(false);
  });
  it('deletes saved colors persistently without changing the preview and frees a full row', async () => {
    let stored = ['#123456', '#234567', '#345678', '#456789', '#56789A', '#6789AB', '#789ABC', '#89ABCD'];
    const preview = vi.fn();
    const saveSavedColors = vi.fn(async (colors: string[]) => { stored = [...colors]; });
    const options = { readSavedColors: async () => stored, saveSavedColors, onPreview: preview };
    await act(async () => { setup(options); });
    act(() => getTag(document, '.x-nt-folder-color-saved-item button[aria-label="#123456"]', 'button').click());
    const calls = preview.mock.calls.length;
    await act(async () => getTag(document, '.x-nt-folder-color-saved-item[data-color="#123456"] .x-nt-folder-color-remove', 'button').click());
    expect(stored).toHaveLength(7);
    expect(stored).not.toContain('#123456');
    expect(input(0).value).toBe('#123456');
    expect(preview).toHaveBeenCalledTimes(calls);
    expect(document.querySelector('.x-nt-folder-color-saved-item[data-color="#123456"]')).toBeNull();
    expect(getTag(document, '.x-nt-folder-color-add', 'button').disabled).toBe(false);
    act(() => button('Cancel').click());
    await act(async () => required(picker, 'picker').open({ folderId: '456', title: 'Other folder' }));
    expect(document.querySelector('.x-nt-folder-color-saved-item[data-color="#123456"]')).toBeNull();
    while (stored.length) {
      await act(async () => getTag(document, '.x-nt-folder-color-remove', 'button').click());
    }
    expect(saveSavedColors).toHaveBeenLastCalledWith([]);
    expect(document.querySelectorAll('.x-nt-folder-color-saved-item')).toHaveLength(0);
    // The default color cannot be saved, so focus falls back to its selected swatch.
    expect(getTag(document, '.x-nt-folder-color-add', 'button').disabled).toBe(true);
    expect(document.activeElement).toBe(swatch('presets', '#5393FF'));
    expect(document.querySelectorAll('.x-nt-folder-color-presets .x-nt-folder-color-swatch')).toHaveLength(8);
  });
  it('retains a saved color when deletion fails and allows retry', async () => {
    const saveSavedColors = vi.fn().mockRejectedValueOnce(new Error('Storage failed')).mockResolvedValue(undefined);
    await act(async () => { setup({ readSavedColors: async () => ['#123456'], saveSavedColors }); });
    await act(async () => getTag(document, '.x-nt-folder-color-remove', 'button').click());
    expect(getElement(document, '[role="alert"]').textContent).toContain('Could not delete this color');
    expect(document.querySelector('.x-nt-folder-color-saved-item[data-color="#123456"]')).not.toBeNull();
    await act(async () => getTag(document, '.x-nt-folder-color-remove', 'button').click());
    expect(saveSavedColors).toHaveBeenLastCalledWith([]);
    expect(document.querySelectorAll('.x-nt-folder-color-saved-item')).toHaveLength(0);
    expect(required(picker, 'picker').isOpen()).toBe(true);
  });
});
