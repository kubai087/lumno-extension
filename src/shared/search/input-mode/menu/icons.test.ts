import { describe, expect, it, vi } from 'vitest';
import { ModeMenuIcons } from './icons';
import { readControllerOptions } from '../mode-options';
import type { ModeMenuItem } from '../types';

describe('mode menu themes', () => {
  it('batches resolved themes and reuses them until the provider changes', async () => {
    const resolve = vi.fn().mockResolvedValue({ accent: '#123456' });
    const redraw = vi.fn();
    const icons = new ModeMenuIcons(readControllerOptions({ getThemeForProvider: resolve }, document.createElement('input')), redraw);
    const items: ModeMenuItem[] = Array.from({ length: 12 }, (_, i) => ({
      id: `site-${i}`, label: `Site ${i}`, provider: { key: `site-${i}` }
    }));
    icons.request(items);
    await Promise.resolve();
    await Promise.resolve();
    expect(resolve).toHaveBeenCalledTimes(12);
    expect(redraw).toHaveBeenCalledTimes(1);
    icons.request(items.map((item, i) => ({ ...item, provider: { key: `site-${i}` } })));
    expect(resolve).toHaveBeenCalledTimes(12);
    icons.request([{ ...items[0], provider: { key: 'changed' } }]);
    expect(resolve).toHaveBeenCalledTimes(13);
    icons.dispose();
  });

  it('refreshes changed icons and ignores older theme responses after removal or invalidation', async () => {
    const pending: Array<(theme: { accent: string }) => void> = [];
    const resolve = vi.fn(() => new Promise<{ accent: string }>((done) => pending.push(done)));
    const redraw = vi.fn();
    const icons = new ModeMenuIcons(readControllerOptions({ getThemeForProvider: resolve }, document.createElement('input')), redraw);
    const item: ModeMenuItem = { id: 'site', label: 'Site', iconUrl: 'old', provider: { key: 'site' } };
    icons.request([item]);
    icons.request([{ ...item, iconUrl: 'new' }]);
    expect(resolve).toHaveBeenCalledTimes(2);
    pending[0]({ accent: '#111111' });
    await Promise.resolve();
    await Promise.resolve();
    expect(redraw).not.toHaveBeenCalled();
    icons.request([]);
    pending[1]({ accent: '#222222' });
    await Promise.resolve();
    await Promise.resolve();
    expect(redraw).not.toHaveBeenCalled();
    icons.request([item]);
    icons.invalidate();
    icons.request([item]);
    pending[2]({ accent: '#333333' });
    pending[3]({ accent: '#444444' });
    await Promise.resolve();
    await Promise.resolve();
    expect(redraw).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledTimes(4);
    icons.dispose();
  });

  it('keeps the drawn theme through a refresh until the new one arrives', async () => {
    const pending: Array<(theme: { accent: string } | null) => void> = [];
    const resolve = vi.fn(() => new Promise<{ accent: string } | null>((done) => pending.push(done)));
    const redraw = vi.fn();
    const icons = new ModeMenuIcons(readControllerOptions({ getThemeForProvider: resolve }, document.createElement('input')), redraw);
    const item: ModeMenuItem = { id: 'site', label: 'Site', provider: { key: 'site' } };
    const settle = async () => {
      await Promise.resolve();
      await Promise.resolve();
    };
    const unthemed = icons.tileColors(item);
    icons.request([item]);
    pending[0]({ accent: '#112233' });
    await settle();
    const first = icons.tileColors(item);
    expect(first).not.toEqual(unthemed);

    icons.invalidate();
    icons.request([item]);
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(icons.tileColors(item), 'the tile keeps its colors while the theme is asked for again').toEqual(first);
    pending[1]({ accent: '#445566' });
    await settle();
    expect(icons.tileColors(item)).not.toEqual(first);

    icons.invalidate();
    icons.request([item]);
    pending[2](null);
    await settle();
    expect(icons.tileColors(item), 'a theme that is gone falls back').toEqual(unthemed);
    expect(redraw).toHaveBeenCalledTimes(3);
    icons.dispose();
  });
});
