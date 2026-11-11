import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import * as pinyinRuntime from '../search/input-mode/menu/pinyin-runtime';
import type { ModeMenuItem } from '../search/input-mode/types';
import { LumnoSearchInputMode, createModeParts, resetModeTest } from '../../../tests/fakes/search-input-mode';

afterEach(() => { resetModeTest(); vi.restoreAllMocks(); vi.useRealTimers(); });

it('opens before optional pinyin data is ready and cancels deferred work on close', () => {
  vi.useFakeTimers();
  const load = vi.spyOn(pinyinRuntime, 'requestPinyinRuntime').mockReturnValue(new Promise(() => {}));
  const parts = createModeParts();
  const controller = LumnoSearchInputMode.createInputModeController(parts, {
    getModeMenuItems: () => [{ id: 'site', label: 'Site' }]
  });
  expect(controller.openModeMenu('none')).toBe(true);
  expect(controller.menuElement.hidden).toBe(false);
  expect(load).not.toHaveBeenCalled();
  controller.closeModeMenu();
  act(() => vi.advanceTimersByTime(500));
  expect(load).not.toHaveBeenCalled();
  expect(controller.openModeMenu('none')).toBe(true);
  act(() => vi.advanceTimersByTime(360));
  expect(load).toHaveBeenCalledTimes(1);
  expect(controller.menuElement.hidden).toBe(false);
  controller.destroy();
});

it('updates filtered results and ordering when menu items change', () => {
  const parts = createModeParts();
  let items: ModeMenuItem[] = [
    { id: 'one', label: 'Original', provider: { key: 'one', aliases: ['xray'] } },
    { id: 'two', label: 'Second' }
  ];
  const controller = LumnoSearchInputMode.createInputModeController(parts, { getModeMenuItems: () => items });
  const labels = () => Array.from(controller.menuElement.querySelectorAll('[role="menuitemradio"]'))
    .filter((button) => !button.hasAttribute('hidden'))
    .map((button) => button.getAttribute('aria-label'));
  expect(controller.openModeMenu('none')).toBe(true);
  controller.menuElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true }));
  expect(labels()).toEqual(['Original']);
  items = [
    { id: 'three', label: 'Xylophone' },
    { id: 'one', label: 'Renamed', provider: { key: 'one', aliases: ['new'] } }
  ];
  expect(controller.refreshModeMenu()).toBe(true);
  expect(labels()).toEqual(['Xylophone']);
  controller.closeModeMenu();
  expect(controller.openModeMenu('none')).toBe(true);
  expect(labels()).toEqual(['Xylophone', 'Renamed']);
  controller.destroy();
});

it('keeps the newest menu update when asynchronous refreshes finish out of order', async () => {
  const parts = createModeParts();
  const pending: Array<(items: ModeMenuItem[]) => void> = [];
  let initial = true;
  const controller = LumnoSearchInputMode.createInputModeController(parts, {
    getModeMenuItems: () => {
      if (initial) {
        initial = false;
        return [{ id: 'initial', label: 'Initial' }];
      }
      return new Promise<ModeMenuItem[]>((resolve) => pending.push(resolve));
    }
  });
  expect(controller.openModeMenu('none')).toBe(true);
  const older = controller.refreshModeMenu();
  const newer = controller.refreshModeMenu();
  await act(async () => {
    pending[1]([{ id: 'new', label: 'New' }]);
    await newer;
    pending[0]([{ id: 'old', label: 'Old' }]);
    await older;
  });
  const labels = Array.from(controller.menuElement.querySelectorAll('[role="menuitemradio"]'))
    .map((button) => button.getAttribute('aria-label'));
  expect(labels).toEqual(['New']);
  controller.destroy();
});
