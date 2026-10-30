import { beforeEach, describe, expect, it, vi } from 'vitest';
import zhCnMessages from '../../../_locales/zh_CN/messages.json';
import {
  NOT_DRAGGING,
  TYPED,
  createRuntime,
  findTile,
  installBroadcastChannel,
  installMatchMedia,
  openPanel,
  panelActions,
  panelOf,
  panelState
} from '../../../tests/fakes/wallpaper/runtime';
import type { WallpaperRuntime } from './wallpaper';
import { required } from '../../../tests/fakes/dom';

vi.mock('../react/wallpaper-view', async () => ({
  createWallpaperViewController: (await import('../../../tests/fakes/wallpaper/view-recorder')).createRecordingWallpaperView
}));

beforeEach(() => {
  installMatchMedia();
  installBroadcastChannel();
});

describe('the appearance panel', () => {
  it('lists the built-in wallpapers with their thumbnails', async () => {
    const { runtime } = await createRuntime();
    runtime.createControls();
    [
      ['impressionist-orchard-white', 'assets/wallpapers/lumno-newtab-impressionist-orchard-white.webp'],
      ['pointillist-lakeside-white', 'assets/wallpapers/lumno-newtab-pointillist-lakeside-white.webp'],
      ['white-3d-observatory', 'assets/wallpapers/lumno-newtab-white-3d-observatory.webp'],
      ['white-shanshui-bamboo-bridge', 'assets/wallpapers/lumno-newtab-white-shanshui-bamboo-bridge.webp']
    ].forEach(([id, path]) => {
      const tile = required(findTile(runtime, id), id);
      expect(tile.source).toBe('built-in');
      expect(tile.path).toBe(path);
      expect(tile.thumbnailUrl.endsWith('-thumb.webp')).toBe(true);
    });
  });

  it('blurs a slider inside it when it closes', async () => {
    const { runtime } = await createRuntime();
    runtime.createControls();
    document.body.appendChild(required(runtime.getControlElement()));
    const slider = document.createElement('input');
    slider.type = 'range';
    panelOf(runtime).controller.panel.appendChild(slider);
    slider.focus();
    expect(document.activeElement).toBe(slider);

    runtime.closePanel();

    expect(document.activeElement).not.toBe(slider);
  });

  it('renders open with its header', async () => {
    const { runtime } = await createRuntime();
    runtime.createControls();
    openPanel(runtime);
    expect(runtime.isPanelOpen()).toBe(true);
    expect(panelState(runtime).open).toBe(true);
    expect(required(runtime.getControlElement()).getAttribute('data-panel-open')).toBe('true');
    expect(panelState(runtime).button.label).toBe('Appearance');
    expect(panelState(runtime).header.moreSettingsUrl).toBe('chrome-extension://lumno/src/options/options.html#appearance');
  });

  it('shows the search width in pixels with marks on its snap points', async () => {
    const { runtime } = await createRuntime();
    runtime.createControls();
    openPanel(runtime);
    const { width } = panelState(runtime).search;
    expect([width.min, width.max, width.value, width.suffix, width.valueText]).toEqual([640, 1040, 920, ' px', '920 px']);
    expect(panelOf(runtime).model.marks?.searchWidth).toEqual([0, 20, 70, 100]);
  });
});

describe('the shortcut settings', () => {
  async function setup() {
    const page = {
      shortcutsVisible: true,
      shortcutAddVisible: true,
      dock: true,
      columns: 10,
      writes: new Array<unknown[]>()
    };
    const { runtime } = await createRuntime({
      getShortcutsVisible: () => page.shortcutsVisible,
      setShortcutsVisible(value) {
        page.shortcutsVisible = Boolean(value);
        page.writes.push(['visible', page.shortcutsVisible]);
      },
      getShortcutAddVisible: () => page.shortcutAddVisible,
      setShortcutAddVisible(value) {
        page.shortcutAddVisible = Boolean(value);
        page.writes.push(['add', page.shortcutAddVisible]);
      },
      getShortcutDockMagnificationEnabled: () => page.dock,
      setShortcutDockMagnificationEnabled(value) {
        page.dock = Boolean(value);
        page.writes.push(['dock', page.dock]);
      },
      getShortcutColumns: () => page.columns,
      setShortcutColumns(value, options) {
        page.columns = Number(value);
        page.writes.push(['columns', page.columns, Boolean(options && options.persist)]);
      }
    });
    runtime.createControls();
    openPanel(runtime);
    return { page, runtime };
  }

  it('start enabled with ten columns between 4 and 16', async () => {
    const { runtime } = await setup();
    const { shortcuts } = panelState(runtime);
    expect(shortcuts.enabled).toBe(true);
    expect(shortcuts.toggle.checked).toBe(true);
    expect(shortcuts.columns.value).toBe(10);
    expect([shortcuts.columns.min, shortcuts.columns.max]).toEqual([4, 16]);
  });

  it('preview columns while the slider moves and save them when it stops, clamped to the range', async () => {
    const { page, runtime } = await setup();
    const actions = panelActions(runtime);
    actions.setShortcutColumns(7, NOT_DRAGGING);
    expect(page.writes.at(-1)).toEqual(['columns', 7, false]);
    actions.setShortcutColumns(7, TYPED);
    expect(page.columns).toBe(7);
    expect(page.writes.at(-1)).toEqual(['columns', 7, true]);
    expect(panelState(runtime).shortcuts.columns.value).toBe(7);
    actions.setShortcutColumns(11, TYPED);
    expect(page.columns).toBe(11);
    actions.setShortcutColumns(99, TYPED);
    expect(page.columns).toBe(16);
  });

  it('disable their settings while shortcuts are off', async () => {
    const { page, runtime } = await setup();
    const actions = panelActions(runtime);
    actions.setShortcutsVisible(false);
    expect(page.shortcutsVisible).toBe(false);
    expect(panelState(runtime).shortcuts.enabled).toBe(false);
    expect(panelState(runtime).shortcuts.toggle.checked).toBe(false);
    actions.setShortcutsVisible(true);
    expect(panelState(runtime).shortcuts.enabled).toBe(true);
  });

  it('switch the add tile and the dock magnification', async () => {
    const { page, runtime } = await setup();
    const actions = panelActions(runtime);
    actions.setShortcutAddVisible(false);
    actions.setShortcutDockMagnification(false);
    expect(page.writes.slice(-2)).toEqual([['add', false], ['dock', false]]);
    expect(panelState(runtime).shortcuts.add.toggle.checked).toBe(false);
    expect(panelState(runtime).shortcuts.dock.toggle.checked).toBe(false);
  });
});

describe('the input auto-focus setting', () => {
  it('starts off, explains itself in a tooltip and saves its switch', async () => {
    let enabled = false;
    const writes: boolean[] = [];
    const tooltips: Array<{ anchor: HTMLElement; text: string }> = [];
    const { runtime } = await createRuntime({
      getInputAutoFocusEnabled: () => enabled,
      setInputAutoFocusEnabled(value) {
        enabled = Boolean(value);
        writes.push(enabled);
      },
      showTopActionTooltip: (anchor, text) => tooltips.push({ anchor, text })
    });
    runtime.createControls();
    openPanel(runtime);
    const { autoFocus } = panelState(runtime).search;
    expect(autoFocus.toggle.checked).toBe(false);
    expect(autoFocus.infoLabel).toBe('Input auto-focus info');
    expect(autoFocus.infoTooltip).toBe(
      'If you prefer to use the browser’s native address bar, turn this option off. The extension URL will no longer appear in the address bar.'
    );
    const anchor = document.createElement('button');
    panelActions(runtime).showTooltip(anchor, autoFocus.infoTooltip);
    expect(tooltips).toEqual([{ anchor, text: autoFocus.infoTooltip }]);

    panelActions(runtime).setInputAutoFocus(true);
    expect(writes).toEqual([true]);
    expect(panelState(runtime).search.autoFocus.toggle.checked).toBe(true);
    expect(zhCnMessages.newtab_input_auto_focus_help.message)
      .toBe('如倾向使用浏览器原生地址栏，可关闭该选项。关闭后地址栏中的扩展 URL 将不再显示。');
  });
});

describe('the theme settings', () => {
  const modeOf = (runtime: WallpaperRuntime, mode: string) =>
    required(panelState(runtime).theme.modes.find((item) => item.mode === mode), mode);

  it('offer the New Tab scope to follow the global theme, and keep the search width there', async () => {
    const { runtime } = await createRuntime({ getThemeScope: () => 'home' });
    runtime.createControls();
    openPanel(runtime);
    expect(panelState(runtime).theme.scope.active).toBe('home');
    expect(modeOf(runtime, 'system').label).toBe('Follow "Global"');
    expect(panelState(runtime).search.width.value).toBe(920);
  });

  it('preview what following the global theme shows, with the Lumno badge', async () => {
    let globalMode = 'dark';
    const { runtime } = await createRuntime({ getThemeScope: () => 'home', getGlobalThemeMode: () => globalMode });
    runtime.createControls();
    openPanel(runtime);
    expect(modeOf(runtime, 'system').imageUrl.endsWith('assets/images/newtab-dark.svg')).toBe(true);
    expect(modeOf(runtime, 'light').imageUrl.endsWith('assets/images/newtab-light.svg')).toBe(true);
    expect(modeOf(runtime, 'system').badgeUrl?.endsWith('assets/images/lumno.png')).toBe(true);
    expect(modeOf(runtime, 'light').badgeUrl).toBe('');
    globalMode = 'system';
    runtime.updateAppearanceSelectionUi();
    expect(modeOf(runtime, 'system').imageUrl.endsWith('assets/images/newtab-system.svg')).toBe(true);
  });

  it('switch between the global and New Tab scopes with their own previews', async () => {
    let scope = 'global';
    let runtimeRef: WallpaperRuntime | null = null;
    const { runtime } = await createRuntime({
      getThemeScope: () => scope,
      // As the page does, the scope's change redraws the appearance options.
      setThemeScope(next) {
        scope = next === 'home' ? 'home' : 'global';
        required(runtimeRef).updateAppearanceSelectionUi();
      }
    });
    runtimeRef = runtime;
    runtime.createControls();
    openPanel(runtime);
    const theme = () => panelState(runtime).theme;
    expect(theme().scope.active).toBe('global');
    expect(modeOf(runtime, 'system').label).toBe('Follow system');
    expect(theme().modes.map((mode) => mode.imageUrl.split('/').pop())).toEqual(['system.svg', 'light.svg', 'dark.svg']);
    expect(modeOf(runtime, 'system').badgeUrl).toBe('');
    expect(theme().scope.options.map((option) => [option.value, option.label])).toEqual([['global', 'Global'], ['home', 'New Tab']]);

    panelActions(runtime).selectThemeScope('home');
    expect(scope).toBe('home');
    expect(theme().scope.active).toBe('home');
    expect(modeOf(runtime, 'system').label).toBe('Follow "Global"');
    expect(theme().modes.map((mode) => mode.imageUrl.split('/').pop()))
      .toEqual(['newtab-system.svg', 'newtab-light.svg', 'newtab-dark.svg']);

    panelActions(runtime).selectThemeScope('global');
    expect(scope).toBe('global');
    expect(theme().scope.active).toBe('global');
  });
});
