import { beforeEach, describe, expect, it, vi } from 'vitest';
import zhCnMessages from '../../../_locales/zh_CN/messages.json';
import {
  NOT_DRAGGING,
  createRuntime,
  installBroadcastChannel,
  installMatchMedia,
  openPanel,
  panelActions,
  panelState
} from '../../../tests/fakes/wallpaper/runtime';
import { newtabTimeFont, newtabTimeFontWeight, newtabTimeSecondsVisible, newtabTopContentMode } from '../../domain/settings/newtab-time';

vi.mock('../react/wallpaper-view', async () => ({
  createWallpaperViewController: (await import('../../../tests/fakes/wallpaper/view-recorder')).createRecordingWallpaperView
}));

beforeEach(() => {
  installMatchMedia();
  installBroadcastChannel();
});

const zhMessages: Record<string, { message: string } | undefined> = zhCnMessages;

async function setup() {
  const harness = await createRuntime();
  harness.runtime.createControls();
  openPanel(harness.runtime);
  return { ...harness, search: () => panelState(harness.runtime).search };
}

describe('the content above the search bar', () => {
  it('shows the brand mark by default, without time settings', async () => {
    const { search } = await setup();
    expect(search().topContent.tabs.active).toBe('brand');
    expect(search().timeWeight.visible).toBe(false);
    expect(search().timeFont.visible).toBe(false);
    expect(search().seconds.visible).toBe(false);
    expect(search().timeFont.value).toBe('open-sans');
    expect(search().timeFont.options.map((option) => option.label))
      .toEqual(['Open Sans', 'Geist', 'JetBrains Mono', 'Bricolage Grotesque', 'Unbounded', 'Bitcount']);
    expect([search().timeWeight.min, search().timeWeight.max, search().timeWeight.value, search().timeWeight.step])
      .toEqual([300, 800, 320, undefined]);
    expect(search().timeWeight.resetVisible).toBe(false);
  });

  it('shows the time\'s font, weight and seconds once the time is chosen', async () => {
    const { runtime, settings, search } = await setup();
    panelActions(runtime).selectTopContent('time');
    expect(settings.get(newtabTopContentMode)).toBe('time');
    expect(search().timeWeight.visible).toBe(true);
    expect(search().timeFont.visible).toBe(true);
    expect(search().seconds.visible).toBe(true);
  });

  it('moves the weight to a picked face\'s default and range, and resets to it', async () => {
    const { runtime, settings, search } = await setup();
    const actions = panelActions(runtime);
    actions.selectTopContent('time');
    actions.setTimeFontWeight(700, NOT_DRAGGING);
    actions.setTimeFont('bitcount');
    expect(settings.get(newtabTimeFont)).toBe('bitcount');
    expect(settings.get(newtabTimeFontWeight)).toBe(480);
    expect([search().timeFont.value, search().timeWeight.min, search().timeWeight.max, search().timeWeight.value])
      .toEqual(['bitcount', 300, 550, 480]);
    expect(search().timeWeight.resetVisible).toBe(false);
    // A heavier synced weight shows at the face's ceiling; the stored weight is kept.
    await settings.set(newtabTimeFontWeight, 800);
    expect(search().timeWeight.value).toBe(550);
    actions.resetTimeFontWeight();
    expect(settings.get(newtabTimeFontWeight)).toBe(480);
  });

  it('follows a face another device picks, and falls back to Open Sans for an unknown one', async () => {
    const { runtime, settings, search } = await setup();
    panelActions(runtime).selectTopContent('time');
    await settings.set(newtabTimeFont, 'geist');
    expect(search().timeWeight.max).toBe(800);
    await settings.set(newtabTimeFont, 'papyrus');
    expect(settings.get(newtabTimeFont)).toBe('open-sans');
  });

  it('offers a reset for a changed weight and saves the seconds switch', async () => {
    const { runtime, settings, search } = await setup();
    const actions = panelActions(runtime);
    actions.selectTopContent('time');
    actions.setTimeFontWeight(612, NOT_DRAGGING);
    expect(settings.get(newtabTimeFontWeight)).toBe(612);
    expect(search().timeWeight.value).toBe(612);
    expect(search().timeWeight.resetVisible).toBe(true);
    actions.resetTimeFontWeight();
    expect(settings.get(newtabTimeFontWeight)).toBe(320);
    expect(search().timeWeight.resetVisible).toBe(false);
    actions.setTimeSecondsVisible(true);
    expect(settings.get(newtabTimeSecondsVisible)).toBe(true);
    expect(search().seconds.toggle.checked).toBe(true);
  });

  it('follows settings changed on another device', async () => {
    const { runtime, settings, search } = await setup();
    panelActions(runtime).selectTopContent('time');
    panelActions(runtime).setTimeSecondsVisible(true);
    await settings.set(newtabTimeFontWeight, 9999);
    expect(search().timeWeight.value).toBe(800);
    await settings.set(newtabTimeSecondsVisible, false);
    expect(search().seconds.toggle.checked).toBe(false);
    await settings.set(newtabTopContentMode, 'off');
    expect(search().topContent.tabs.active).toBe('off');
    expect(search().timeWeight.visible).toBe(false);
  });

  it('labels its settings in the page language', async () => {
    const { runtime, settings } = await createRuntime({
      t: (key, fallback) => zhMessages[key]?.message ?? fallback ?? ''
    });
    await settings.set(newtabTopContentMode, 'time');
    runtime.createControls();
    const { search } = panelState(runtime);
    expect(search.topContent.title).toBe('搜索框上方内容');
    expect(search.topContent.tabs.label).toBe('搜索框上方内容');
    expect(search.topContent.tabs.options.map((option) => [option.value, option.label]))
      .toEqual([['brand', '品牌标识'], ['time', '时间'], ['off', '隐藏']]);
    expect(search.topContent.tabs.active).toBe('time');
    expect(search.timeWeight.label).toBe('时间字重');
    expect(search.timeWeight.visible).toBe(true);
    expect(search.seconds.title).toBe('显示秒数');
    expect(search.seconds.toggle.label).toBe('显示秒数');
    expect(search.seconds.visible).toBe(true);
  });
});
