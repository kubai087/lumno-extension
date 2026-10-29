import { act } from 'react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import {
  createDefaultPanelState,
  createPanelActions,
  createQuoteSettingsModel,
  createSectionSettingsModel
} from './wallpaper-view.fixtures';
import {
  createWallpaperViewController,
  type WallpaperPanelActions,
  type WallpaperPanelModel,
  type QuoteSettingsActions,
  type SectionSettingsActions,
  type WallpaperPanelState,
  type WallpaperViewController
} from './wallpaper-view';
import { expectElement, expectTag, getElement, getElements, getTag, getTags, required } from '../../../tests/react/dom';
import { queryHtmlElement, queryHtmlTag } from '../../shared/dom-lookup';

let controller: WallpaperViewController | null = null;

afterEach(() => {
  if (controller) {
    act(() => controller?.destroy());
  }
  controller = null;
  document.body.replaceChildren();
});

type MockActions = Record<keyof WallpaperPanelActions, Mock<() => void>>;

function createActions(): MockActions {
  return createPanelActions(() => vi.fn<() => void>());
}

const MODEL: WallpaperPanelModel = {
  appearanceOptions: [{ mode: 'system' }, { mode: 'light' }, { mode: 'dark' }],
  favicons: [{ id: 'default', previewUrl: '/favicon.png' }, { id: 'alternate', inlineSvg: ['svg', { viewBox: '0 0 104 104' }] }],
  marks: { shortcutColumns: [0, 100 / 3, 200 / 3, 100] }
};

function createState(edit?: (state: WallpaperPanelState, actions: MockActions) => void) {
  const actions = createActions();
  const state = createDefaultPanelState();
  state.actions = actions;
  state.header.helpUrl = 'https://lumno.kubai.design/help/newtab-wallpaper/';
  state.header.helpText = 'Visit the Help Center';
  state.theme.infoTooltip = 'Global: the default theme for all pages.';
  state.wallpaper.builtIn.tiles = [
    { id: 'coast', label: 'Select Coast', path: '/coast.webp', selected: true, thumbnailUrl: '/coast-thumb.webp' },
    { id: 'field', label: 'Select Field', path: '/field.webp', selected: false, thumbnailUrl: '/field-thumb.webp' }
  ];
  state.theme.modes = ['system', 'light', 'dark'].map((mode) => ({
    ariaLabel: `Switch to ${mode}`,
    imageUrl: `/newtab-${mode}.svg`,
    label: mode,
    mode,
    selected: mode === 'system'
  }));
  state.favicon.options = [
    { id: 'default', label: 'Select Default favicon', selected: true },
    { id: 'alternate', label: 'Select Alternate favicon', selected: false }
  ];
  edit?.(state, actions);
  return { actions, state };
}

function mount(state: WallpaperPanelState, model: WallpaperPanelModel = MODEL) {
  act(() => {
    controller = createWallpaperViewController({ documentObj: document, model, state });
  });
  if (!controller) {
    throw new Error('Expected wallpaper view controller');
  }
  document.body.appendChild(controller.control);
  return controller;
}

function createQuoteActions(): Record<keyof QuoteSettingsActions, Mock> {
  return {
    toggleExpanded: vi.fn(),
    setEnabled: vi.fn(),
    setProvider: vi.fn(),
    importFile: vi.fn(),
    shuffleLibrary: vi.fn(),
    setCategory: vi.fn(),
    setFontSize: vi.fn()
  };
}

function createSectionActions(): Record<keyof SectionSettingsActions, Mock> {
  return {
    toggleBookmarkExpanded: vi.fn(),
    setBookmarkVisible: vi.fn(),
    setBookmarkRows: vi.fn(),
    setBookmarkColumns: vi.fn(),
    setBookmarkFolderIconsVisible: vi.fn(),
    setBookmarkTopbarLayout: vi.fn(),
    toggleRecentExpanded: vi.fn(),
    setRecentVisible: vi.fn(),
    setRecentMode: vi.fn(),
    setRecentRows: vi.fn()
  };
}

function rerender(state: WallpaperPanelState) {
  act(() => controller?.render(state));
}

function refs() {
  return required(controller, 'controller').getRefs();
}

function setNativeValue(input: HTMLInputElement, value: string) {
  const setter = required(required(Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'), 'Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, ').set, 'Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, ');
  setter.call(input, value);
}

function typeInto(input: HTMLInputElement, value: string) {
  act(() => {
    setNativeValue(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function key(target: HTMLElement, name: string) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: name }));
  });
}

describe('New Tab React wallpaper view', () => {
  it('picks a glass style and follows updated preferences without remounting', () => {
    const { state, actions } = createState();
    mount(state);
    const host = refs().glassStyleSelectHost;
    const select = host.querySelector('select');
    expect(select?.value).toBe('none');
    act(() => getTag(host, 'button', 'button').click());
    const liquid = queryHtmlElement(document, '[data-react-select-owner="x-nt-glass-style"] [data-value="liquid"]');
    act(() => liquid?.click());
    expect(actions.setGlassStyle).toHaveBeenCalledWith('liquid');
    state.glassStyle.value = 'frosted';
    rerender(state);
    expect(refs().glassStyleSelectHost.querySelector('select')).toBe(select);
    expect(select?.value).toBe('frosted');
    act(() => refs().styleSectionTrigger.click());
    expect(refs().styleSectionBody.hidden).toBe(true);
    rerender(state);
    expect(refs().styleSectionBody.hidden).toBe(true);
    act(() => refs().styleSectionTrigger.click());
    expect(refs().styleSectionBody.hidden).toBe(false);
    expect(refs().glassStyleTitle.textContent).toBe(state.glassStyle.title);
  });

  it('shows the material theme only under a glass style', () => {
    const { state, actions } = createState();
    mount(state);
    expect(refs().glassThemeRow.hidden).toBe(true);
    state.glassStyle.value = 'liquid';
    state.glassStyle.theme.visible = true;
    rerender(state);
    expect(refs().glassThemeRow.hidden).toBe(false);
    expect(refs().glassThemeTitle.textContent).toBe('Material theme');
    expect(refs().glassThemeInfoButton.getAttribute('aria-label')).toBe('Material theme');
    expect(refs().glassThemeTabs.querySelector('[data-newtab-glass-theme="follow"]')?.getAttribute('aria-pressed')).toBe('true');
    act(() => getElement(refs().glassThemeTabs, '[data-newtab-glass-theme="dark"]').click());
    expect(actions.selectGlassTheme).toHaveBeenCalledWith('dark');
  });

  it('marks only the theme option that carries a badge', () => {
    const { state } = createState();
    state.theme.modes[0].badgeUrl = '/lumno.png';
    mount(state);
    const badges = getTags(refs().appearanceOptions, '.x-nt-appearance-badge', 'img');
    expect(badges).toHaveLength(1);
    expect(badges[0].closest('[data-theme-mode]')?.getAttribute('data-theme-mode')).toBe('system');
    expect(badges[0].getAttribute('src')).toBe('/lumno.png');
  });

  it('renders the complete appearance panel contract', () => {
    const { state } = createState();
    mount(state);
    const view = required(controller, 'controller');
    act(() => view.renderSectionSettings(createSectionSettingsModel(createSectionActions())));
    const quoteActions = createQuoteActions();
    const onQuotePositionChange = vi.fn();
    act(() => view.renderQuoteSettings(createQuoteSettingsModel(quoteActions, (model) => {
      model.quote.positionSelect.onChange = onQuotePositionChange;
    })));
    expect(view.control.dataset.reactIsland).toBe('newtab-wallpaper');
    expect(view.control.dataset.panelOpen).toBe('false');
    expect(refs().builtInGrid).toBeTruthy();
    // Sections other runtimes hand models for keep their element contract.
    expect(refs().quoteEnabledToggle.getAttribute('role')).toBe('switch');
    expect(refs().quoteBody.hidden).toBe(true);
    expect(refs().quoteFileInput.getAttribute('accept')).toContain('.txt');
    expect(refs().quoteFileInput.getAttribute('accept')).toContain('.md');
    const quoteTabGroups = refs().quoteBody.querySelectorAll('.x-nt-segmented-tabs');
    expect(Array.from(quoteTabGroups, (group) => group.getAttribute('data-wallpaper-ref')))
      .toEqual(['quoteSource', 'quoteCategory']);
    expect(quoteTabGroups[0].querySelector('.x-nt-segmented-tabs-indicator')).not.toBeNull();
    const quotePositionHost = refs().quotePositionSelectHost;
    expect(quotePositionHost.classList.contains('_x_extension_custom_select_2024_unique_')).toBe(true);
    expect(quotePositionHost.querySelector('select')?.value).toBe('search');
    const topOption = queryHtmlElement(document, '[data-react-select-owner="x-nt-quote-position"] [data-value="top"]');
    expect(view.containsSelectMenuTarget(topOption)).toBe(true);
    act(() => {
      topOption?.click();
    });
    expect(onQuotePositionChange).toHaveBeenCalledWith('top');
    expect(refs().quoteInfoButton.previousElementSibling).toBe(refs().quoteAccordionTrigger);
    const sectionTriggers = Array.from(
      getTags(view.control, '.x-nt-section-trigger', 'button')
    );
    expect(sectionTriggers.map((trigger) => trigger.dataset.wallpaperRef)).toEqual([
      'themeSectionTrigger',
      'styleSectionTrigger',
      'searchSectionTrigger',
      'shortcutsAccordionTrigger',
      'bookmarkSettingsTrigger',
      'recentSettingsTrigger',
      'quoteAccordionTrigger',
      'wallpaperAccordionTrigger',
      'faviconSectionTrigger'
    ]);
    sectionTriggers.forEach((trigger) => {
      expect(trigger.firstElementChild?.classList.contains('x-nt-section-chevron')).toBe(true);
      expect(trigger.lastElementChild?.classList.contains('x-nt-wallpaper-panel-title')).toBe(true);
      expect(view.control.querySelector(`#${trigger.getAttribute('aria-controls')}`)).not.toBeNull();
    });
    expect(refs().bingDailyInfoButton.closest('.x-nt-appearance-setting-title-group')).not.toBeNull();
    expect(refs().bingSelectedLink.classList.contains('x-lumno-link-button')).toBe(true);
    expect(refs().bingSelectedLink.getAttribute('target')).toBe('_blank');
    expect(refs().moreSettingsLink.querySelector('.ri-external-link-line')).not.toBeNull();
    const helpFooterLink = refs().helpFooterLink;
    expect(helpFooterLink.getAttribute('href')).toBe('https://lumno.kubai.design/help/newtab-wallpaper/');
    expect(helpFooterLink.textContent).toBe('Visit the Help Center');
    expect(refs().helpFooterPrompt.parentElement).toBe(helpFooterLink.parentElement);
    // Pinned under the scroll area, so it stays visible while settings scroll.
    expect(helpFooterLink.closest('.x-nt-wallpaper-panel-scroll')).toBeNull();
    expect(helpFooterLink.closest('.x-nt-wallpaper-panel')?.lastElementChild)
      .toBe(helpFooterLink.parentElement);
    expect(refs().bingTab.textContent).toBe('Bing');
    expect(refs().bingSelectedSource.hidden).toBe(true);
    expect(refs().bingRefresh.closest('.x-nt-overlay-control-header')).not.toBeNull();
    expect(refs().effectSelectHost.closest('.x-nt-appearance-setting-row'))
      .toBe(refs().effectLabel.parentElement);
    const sliderRows = getElements(view.control, '.x-nt-range-slider-row');
    expect(sliderRows).toHaveLength(18);
    sliderRows.forEach((row) => {
      const slider = queryHtmlTag(row, 'input[type="range"]', 'input');
      const valueInput = queryHtmlTag(row, 'input[type="number"]', 'input');
      expect(slider).not.toBeNull();
      expect(row.classList.contains('x-range-slider-field')).toBe(true);
      expect(valueInput?.max).toBe(slider?.max);
      expect(valueInput?.classList.contains('_x_extension_range_slider_value_input_2026_unique_')).toBe(true);
    });
    [refs().effectInkToneOptions, refs().topContentTabs, refs().modeTabs, refs().tabs].forEach((group) => {
      expect(group.classList.contains('x-nt-segmented-tabs')).toBe(true);
      expect(group.querySelector('.x-nt-segmented-tabs-indicator')).not.toBeNull();
    });
    // Shortcuts follow input auto-focus in the search section's reading order.
    expect(refs().inputAutoFocusToggle.compareDocumentPosition(refs().shortcutsAccordion)
      & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(refs().topContentTabs.getAttribute('role')).toBe('group');
    expect(refs().topContentBrandTab.getAttribute('aria-pressed')).toBe('true');
    expect(refs().inputAutoFocusInfoButton.querySelector('.ri-information-line')).not.toBeNull();
  });

  it('renders every setting from the state and re-renders in place', () => {
    const { state } = createState();
    mount(state);
    const panel = required(controller, 'controller').panel;
    const { state: next } = createState((draft) => {
      draft.open = true;
      draft.button = { active: true, label: 'Appearance' };
      draft.search.topContent.tabs.active = 'time';
      draft.search.timeWeight = {
        ...draft.search.timeWeight,
        resetLabel: 'Reset time font weight',
        resetVisible: true,
        value: 600,
        visible: true
      };
      draft.search.timeSize = {
        ...draft.search.timeSize,
        resetLabel: 'Reset time size',
        resetVisible: true,
        value: 80,
        visible: true
      };
      draft.search.timeOpacity = {
        ...draft.search.timeOpacity,
        resetLabel: 'Reset time opacity',
        resetVisible: false,
        value: 100,
        valueText: '100%',
        visible: true
      };
      draft.search.timeInk = { ...draft.search.timeInk, visible: true, tabs: { ...draft.search.timeInk.tabs, active: 'dark' } };
      draft.search.seconds = { ...draft.search.seconds, visible: true, toggle: { checked: true, label: 'Show seconds' } };
      draft.search.twelveHour = { ...draft.search.twelveHour, visible: true, toggle: { checked: false, label: '12-hour clock' } };
      draft.wallpaper.overlay = { ...draft.wallpaper.overlay, value: 72 };
      draft.wallpaper.effect.sliders.spacing = {
        ...draft.wallpaper.effect.sliders.spacing,
        suffix: '%',
        value: 40,
        valueText: '40%',
        visible: true
      };
      draft.wallpaper.builtIn.tiles = draft.wallpaper.builtIn.tiles.map((tile) => ({
        ...tile,
        selected: tile.id === 'field'
      }));
      draft.favicon.options = draft.favicon.options.map((option) => ({ ...option, selected: option.id === 'alternate' }));
    });
    // A section another runtime drew stays as it drew it.
    act(() => controller?.renderQuoteSettings(createQuoteSettingsModel(createQuoteActions(), (model) => {
      model.quote.enabled = true;
    })));
    rerender(next);
    expect(required(controller, 'controller').panel).toBe(panel);
    expect(refs().quoteBody.hidden).toBe(false);
    expect(panel.dataset.open).toBe('true');
    expect(required(controller, 'controller').control.dataset.panelOpen).toBe('true');
    expect(refs().button.getAttribute('aria-expanded')).toBe('true');
    expect(refs().button.dataset.active).toBe('true');
    expect(refs().topContentTimeTab.dataset.active).toBe('true');
    expect(refs().topContentBrandTab.dataset.active).toBe('false');
    expect(refs().topContentWeightControl.hidden).toBe(false);
    expect((expectTag(refs().topContentWeightSlider, 'input')).value).toBe('600');
    const weightReset = expectTag(refs().topContentWeightResetButton, 'button');
    expect(weightReset.disabled).toBe(false);
    expect(weightReset.getAttribute('aria-label')).toBe('Reset time font weight');
    act(() => weightReset.click());
    expect(next.actions.resetTimeFontWeight).toHaveBeenCalled();
    expect(refs().topContentSizeControl.hidden).toBe(false);
    expect((expectTag(refs().topContentSizeSlider, 'input')).value).toBe('80');
    const sizeReset = expectTag(refs().topContentSizeResetButton, 'button');
    expect(sizeReset.disabled).toBe(false);
    expect(sizeReset.getAttribute('aria-label')).toBe('Reset time size');
    act(() => sizeReset.click());
    expect(next.actions.resetTimeFontSize).toHaveBeenCalled();
    expect(refs().topContentOpacitySlider.getAttribute('aria-valuetext')).toBe('100%');
    expect(refs().topContentOpacitySlider.closest('.x-nt-range-slider-row')?.getAttribute('data-value-suffix')).toBe('%');
    expect((expectTag(refs().topContentOpacityResetButton, 'button')).disabled).toBe(true);
    expect(refs().topContentInkRow.hidden).toBe(false);
    expect(refs().topContentInkTitle.textContent).toBe('Time color');
    expect(refs().topContentInkTabs.querySelector('[data-newtab-time-ink="dark"]')?.getAttribute('aria-pressed')).toBe('true');
    act(() => getElement(refs().topContentInkTabs, '[data-newtab-time-ink="light"]').click());
    expect(next.actions.selectTimeInk).toHaveBeenCalledWith('light');
    expect((expectTag(refs().topContentSecondsToggle, 'input')).checked).toBe(true);
    expect(refs().topContentTwelveHourRow.hidden).toBe(false);
    expect(refs().topContentTwelveHourTitle.textContent).toBe('12-hour clock');
    expect((expectTag(refs().topContentTwelveHourToggle, 'input')).checked).toBe(false);
    act(() => (expectTag(refs().topContentTwelveHourToggle, 'input')).click());
    expect(next.actions.setTime12Hour).toHaveBeenCalledWith(true);
    expect((expectTag(refs().overlaySlider, 'input')).value).toBe('72');
    expect((expectTag(refs().overlaySliderValueInput, 'input')).value).toBe('72');
    expect(refs().effectSpacingControl.dataset.visible).toBe('true');
    expect(refs().effectSpacingSlider.getAttribute('aria-valuetext')).toBe('40%');
    expect(refs().effectSpacingSlider.closest('.x-nt-range-slider-row')?.getAttribute('data-value-suffix')).toBe('%');
    expect(refs().effectSizeSlider.parentElement?.dataset.disabled).toBe('true');
    const selectedTiles = Array.from(
      getElements(refs().builtInGrid, '.x-nt-wallpaper-tile'),
      (tile) => [tile.dataset.wallpaperId, tile.dataset.selected, tile.getAttribute('aria-pressed')]
    );
    expect(selectedTiles).toEqual([['coast', 'false', 'false'], ['field', 'true', 'true']]);
    expect(refs().faviconOptions.querySelector('[data-newtab-favicon-id="alternate"]')?.getAttribute('data-selected'))
      .toBe('true');
  });

  it('reports every control through the actions', () => {
    const { actions, state } = createState((draft) => {
      draft.wallpaper.local.tiles = [
        { id: 'custom-1', label: 'Select Mine', selected: false, thumbnailUrl: 'data:image/png;base64,AA==' }
      ];
      draft.wallpaper.bing.tiles = [
        { id: 'bing-1', label: 'Select Bridge', selected: false, thumbnailUrl: '/b.jpg', tooltip: 'Bridge · 2026-10-01' }
      ];
      draft.wallpaper.curated.tiles = [
        { id: 'picsum-28', label: 'Select Photo', selected: false, thumbnailUrl: '/c.jpg', tooltip: 'Photo' }
      ];
      draft.wallpaper.curated.category.tabs = {
        active: 'nature',
        options: [{ label: 'Nature', value: 'nature' }, { label: 'City', value: 'city' }]
      };
    });
    mount(state);
    act(() => (expectTag(refs().button, 'button')).click());
    expect(actions.togglePanel).toHaveBeenCalledTimes(1);
    act(() => getElement(refs().builtInGrid, '[data-wallpaper-id="field"]').click());
    expect(actions.selectWallpaper).toHaveBeenCalledWith('field');
    const customTile = getElement(refs().localGrid, '[data-wallpaper-id="custom-1"]');
    act(() => getElement(customTile, '.x-nt-wallpaper-delete-button').click());
    expect(actions.deleteWallpaper).toHaveBeenCalledWith('custom-1');
    expect(actions.selectWallpaper).toHaveBeenCalledTimes(1);
    key(customTile, 'Enter');
    expect(actions.selectWallpaper).toHaveBeenLastCalledWith('custom-1');
    act(() => getElement(refs().bingItemsHost, '[data-wallpaper-id="bing-1"]').click());
    expect(actions.selectBingWallpaper).toHaveBeenCalledWith('bing-1');
    act(() => {
      getElement(refs().bingItemsHost, '[data-wallpaper-id="bing-1"]')
        .dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    expect(actions.showTooltip).toHaveBeenCalledWith(expect.any(HTMLElement), 'Bridge · 2026-10-01');
    actions.hideTooltip.mockClear();
    act(() => {
      getElement(refs().panel, '.x-nt-wallpaper-panel-scroll').dispatchEvent(new Event('scroll'));
    });
    expect(actions.hideTooltip).toHaveBeenCalled();
    act(() => getElement(refs().curatedItemsHost, '[data-wallpaper-id="picsum-28"]').click());
    expect(actions.selectCuratedWallpaper).toHaveBeenCalledWith('picsum-28');
    act(() => getElement(refs().curatedCategoryTabs, '[data-curated-category="city"]').click());
    expect(actions.selectCuratedCategory).toHaveBeenCalledWith('city');
    act(() => (expectTag(refs().enabledToggle, 'input')).click());
    expect(actions.setWallpaperEnabled).toHaveBeenCalledWith(false);
    act(() => (expectTag(refs().modeSyncToggle, 'input')).click());
    expect(actions.setModeSync).toHaveBeenCalledWith(false);
    act(() => (expectTag(refs().bingDailyToggle, 'input')).click());
    expect(actions.setBingDaily).toHaveBeenCalledWith(true);
    act(() => (expectTag(refs().bingRefresh, 'button')).click());
    expect(actions.refreshBing).toHaveBeenCalled();
    act(() => getElement(refs().appearanceScopeTabs, '[data-theme-scope="home"]').click());
    expect(actions.selectThemeScope).toHaveBeenCalledWith('home');
    act(() => getElement(refs().appearanceOptions, '[data-theme-mode="dark"]').click());
    expect(actions.selectThemeMode).toHaveBeenCalledWith('dark');
    act(() => getElement(refs().effectInkToneOptions, '[data-wallpaper-effect-ink-tone="light"]').click());
    expect(actions.selectInkTone).toHaveBeenCalledWith('light');
    act(() => getElement(refs().faviconOptions, '[data-newtab-favicon-id="alternate"]').click());
    expect(actions.selectFavicon).toHaveBeenCalledWith('alternate');
    act(() => refs().topContentTimeTab.click());
    expect(actions.selectTopContent).toHaveBeenCalledWith('time');
    act(() => (expectTag(refs().inputAutoFocusToggle, 'input')).click());
    expect(actions.setInputAutoFocus).toHaveBeenCalledWith(true);
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    const fileInput = expectTag(refs().customInput, 'input');
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    act(() => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(actions.importWallpaperFile).toHaveBeenCalledWith(file);
    act(() => refs().appearanceInfoButton.focus());
    expect(actions.showTooltip).toHaveBeenLastCalledWith(refs().appearanceInfoButton, state.theme.infoTooltip);
  });

  it('marks the photo whose context menu is open', () => {
    const { state } = createState((draft) => {
      draft.wallpaper.curated.tiles = [
        { id: 'picsum-28', label: 'Bridge', selected: false, thumbnailUrl: '/28.jpg', tooltip: 'Bridge', contextMenuOpen: true },
        { id: 'picsum-29', label: 'Lake', selected: false, thumbnailUrl: '/29.jpg', tooltip: 'Lake' }
      ];
    });
    mount(state);
    expect(getElement(refs().curatedItemsHost, '[data-wallpaper-id="picsum-28"]').dataset.contextMenuOpen).toBe('true');
    expect(getElement(refs().curatedItemsHost, '[data-wallpaper-id="picsum-29"]').hasAttribute('data-context-menu-open')).toBe(false);
  });

  it('opens the save menu on a right-clicked photo and stops uploads at the limit', () => {
    const { actions, state } = createState((draft) => {
      draft.wallpaper.curated.tiles = [
        { id: 'picsum-28', label: 'Select Bridge', selected: false, thumbnailUrl: '/28.jpg', tooltip: 'Bridge' }
      ];
      draft.wallpaper.local.upload.full = true;
    });
    mount(state);
    const tile = getElement(refs().curatedItemsHost, '[data-wallpaper-id="picsum-28"]');
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 60 });
    act(() => {
      tile.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(actions.hideTooltip).toHaveBeenCalled();
    expect(actions.openOnlineWallpaperMenu).toHaveBeenCalledWith('picsum-28', tile, { x: 40, y: 60 });
    const fileInput = expectTag(refs().customInput, 'input');
    const pick = vi.spyOn(fileInput, 'click');
    act(() => refs().uploadTile.click());
    expect(actions.showLocalWallpaperLimit).toHaveBeenCalled();
    expect(pick).not.toHaveBeenCalled();
  });

  it('selects the filter from the state and reports a new one', () => {
    const { actions, state } = createState((draft) => {
      draft.wallpaper.effect.select = {
        ariaLabel: 'Wallpaper filter',
        options: [{ value: 'none', label: 'Off' }, { value: 'grain', label: 'Grain' }],
        value: 'none'
      };
    });
    mount(state);
    const host = refs().effectSelectHost;
    expect(host.querySelector('select')?.value).toBe('none');
    expect(host.querySelector('._x_extension_select_label_2024_unique_')?.textContent).toBe('Off');
    const grainOption = queryHtmlElement(document, '[data-react-select-owner="x-nt-wallpaper-effect"] [data-value="grain"]');
    expect(required(controller, 'controller').containsSelectMenuTarget(grainOption)).toBe(true);
    act(() => grainOption?.click());
    expect(actions.selectEffect).toHaveBeenCalledWith('grain');
  });

  it('shows the random mix categories as checkboxes that toggle without closing', () => {
    const { actions, state } = createState((draft) => {
      draft.wallpaper.activeTab = 'curated';
      draft.wallpaper.curated.mix = {
        ariaLabel: 'Categories in the mix',
        label: '2 categories',
        options: [
          { value: 'nature', label: 'Nature', checkbox: true, checked: true },
          { value: 'city', label: 'City', checkbox: true, checked: false }
        ],
        visible: true
      };
    });
    mount(state);
    const host = refs().curatedMixSelectHost;
    expect(host.closest('.x-nt-overlay-control-header')?.contains(refs().curatedRefresh)).toBe(true);
    expect(host.querySelector('._x_extension_select_label_2024_unique_')?.textContent).toBe('2 categories');
    act(() => getTag(host, 'button', 'button').click());
    const city = getElement(document, '[data-react-select-owner="x-nt-curated-mix"] [data-value="city"]');
    expect(city.getAttribute('role')).toBe('menuitemcheckbox');
    expect(city.getAttribute('aria-checked')).toBe('false');
    expect(required(controller, 'controller').containsSelectMenuTarget(city)).toBe(true);
    act(() => city.click());
    expect(actions.setCuratedMixCategory).toHaveBeenCalledWith('city', true);
    expect(host.dataset.open).toBe('true');
  });

  it('hides the mix categories outside the random tab', () => {
    const { state } = createState((draft) => {
      draft.wallpaper.curated.mix = { ariaLabel: '', label: '', options: [], visible: false };
    });
    mount(state);
    expect(refs().curatedMixSelectHost).toBeUndefined();
  });

  it('moves between source tabs with the arrow keys as one tab stop', () => {
    const { actions, state } = createState();
    mount(state);
    const tabs = Array.from(getTags(refs().tabs, '[role="tab"]', 'button'));
    expect(refs().tabs.getAttribute('role')).toBe('tablist');
    expect(tabs.map((tab) => [tab.dataset.wallpaperTab, tab.tabIndex, tab.getAttribute('aria-selected')])).toEqual([
      ['built-in', 0, 'true'],
      ['local', -1, 'false'],
      ['bing', -1, 'false'],
      ['curated', -1, 'false']
    ]);
    tabs.forEach((tab) => {
      const panel = document.getElementById(tab.getAttribute('aria-controls') || '');
      expect(panel?.getAttribute('role')).toBe('tabpanel');
      expect(panel?.getAttribute('aria-labelledby')).toBe(tab.id);
    });
    expect(refs().builtInGrid.getAttribute('aria-hidden')).toBe('false');
    expect(refs().bingPanel.getAttribute('aria-hidden')).toBe('true');

    key(tabs[0], 'ArrowRight');
    expect(actions.selectSourceTab).toHaveBeenLastCalledWith('local');
    expect(document.activeElement).toBe(tabs[1]);
    key(tabs[0], 'ArrowLeft');
    expect(actions.selectSourceTab).toHaveBeenLastCalledWith('curated');
    expect(document.activeElement).toBe(tabs[3]);
    key(tabs[0], 'End');
    expect(actions.selectSourceTab).toHaveBeenLastCalledWith('curated');
    const callsBeforeHome = actions.selectSourceTab.mock.calls.length;
    key(tabs[0], 'Home');
    // Home lands on the tab that is already selected, so nothing changes.
    expect(actions.selectSourceTab.mock.calls.length).toBe(callsBeforeHome);
    expect(document.activeElement).toBe(tabs[0]);

    const { state: next } = createState((draft) => {
      draft.wallpaper.activeTab = 'bing';
      draft.wallpaper.source.tabs.active = 'bing';
    });
    rerender(next);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, -1, 0, -1]);
    expect(refs().body.dataset.activeTab).toBe('bing');
    expect(refs().bingPanel.getAttribute('aria-hidden')).toBe('false');
    expect(refs().builtInGrid.getAttribute('aria-hidden')).toBe('true');
  });

  it('slides the segmented indicator under the selected option', () => {
    // jsdom has no layout: give each source tab a box from its position in the row.
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const tab = (expectElement(this)).dataset?.wallpaperTab;
      const index = ['built-in', 'local', 'bing', 'curated'].indexOf(tab || '');
      const left = index >= 0 ? 10 + index * 60 : 0;
      const width = index >= 0 ? 56 : 300;
      return new DOMRect(left, 0, width, 30);
    });
    const offsetWidth = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(300);
    const { state } = createState();
    mount(state);
    const indicator = refs().tabsIndicator;
    expect(indicator.style.width).toBe('56px');
    expect(indicator.style.transform).toBe('translateX(10px)');
    expect(indicator.dataset.ready).toBe('true');
    const { state: next } = createState((draft) => {
      draft.wallpaper.activeTab = 'bing';
      draft.wallpaper.source.tabs.active = 'bing';
    });
    rerender(next);
    expect(indicator.style.transform).toBe('translateX(130px)');
    rect.mockRestore();
    offsetWidth.mockRestore();
  });

  it('shows the light and dark tabs only for separate wallpapers, with keyboard support', () => {
    const { actions, state } = createState();
    mount(state);
    expect(refs().modeRow.dataset.visible).toBe('false');
    const { state: split } = createState((draft) => {
      draft.wallpaper.mode.visible = true;
      draft.wallpaper.mode.tabs.active = 'dark';
      draft.wallpaper.modeSync.toggle = { checked: false, label: 'Same wallpaper' };
    });
    split.actions = actions;
    rerender(split);
    expect(refs().modeRow.dataset.visible).toBe('true');
    expect(refs().modeRow.getAttribute('aria-hidden')).toBe('false');
    expect((expectTag(refs().modeSyncToggle, 'input')).checked).toBe(false);
    expect(refs().darkModeTab.getAttribute('aria-selected')).toBe('true');
    expect(refs().darkModeTab.tabIndex).toBe(0);
    expect(refs().lightModeTab.tabIndex).toBe(-1);
    key(refs().darkModeTab, 'ArrowRight');
    expect(actions.selectWallpaperMode).toHaveBeenCalledWith('light');
  });

  it('reports slider moves, drags and typed values', () => {
    const { actions, state } = createState((draft) => {
      draft.shortcuts.columns = { ...draft.shortcuts.columns, value: 10 };
    });
    mount(state);
    act(() => (expectTag(refs().shortcutsAccordionTrigger, 'button')).click());
    const slider = expectTag(refs().shortcutColumnsSlider, 'input');
    const valueInput = expectTag(refs().shortcutColumnsSliderValueInput, 'input');
    expect([slider.min, slider.max, slider.step, slider.value]).toEqual(['4', '16', '1', '10']);
    const marks = slider.style.getPropertyValue('--x-range-slider-marks');
    expect(marks.match(/linear-gradient/g)).toHaveLength(2);

    typeInto(slider, '7');
    expect(actions.setShortcutColumns).toHaveBeenLastCalledWith(7, { dragging: false, final: false });
    // The runtime answers with the new value; the end of the move then saves it.
    const { state: moved } = createState((draft) => {
      draft.shortcuts.columns = { ...draft.shortcuts.columns, value: 7 };
    });
    moved.actions = actions;
    rerender(moved);
    act(() => {
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(actions.setShortcutColumns).toHaveBeenLastCalledWith(7, { dragging: false, final: true });
    act(() => {
      slider.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    typeInto(slider, '9');
    expect(actions.setShortcutColumns).toHaveBeenLastCalledWith(9, { dragging: true, final: false });
    act(() => {
      slider.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    });

    // The value box keeps a draft until it is committed.
    act(() => valueInput.focus());
    typeInto(valueInput, '11');
    const callsWhileTyping = actions.setShortcutColumns.mock.calls.length;
    expect(valueInput.value).toBe('11');
    key(valueInput, 'Enter');
    expect(actions.setShortcutColumns.mock.calls.length).toBe(callsWhileTyping + 1);
    expect(actions.setShortcutColumns).toHaveBeenLastCalledWith(11, { dragging: false, final: true });
    expect(valueInput.value).toBe('7');
    // Digits beyond the range snap to its end while typing.
    act(() => valueInput.focus());
    typeInto(valueInput, '99');
    expect(valueInput.value).toBe('16');
    act(() => valueInput.blur());
    expect(actions.setShortcutColumns).toHaveBeenLastCalledWith(16, { dragging: false, final: true });
    // An empty draft falls back to the current value without reporting anything.
    const callsBeforeEmpty = actions.setShortcutColumns.mock.calls.length;
    act(() => valueInput.focus());
    typeInto(valueInput, '');
    act(() => valueInput.blur());
    expect(actions.setShortcutColumns.mock.calls.length).toBe(callsBeforeEmpty);
    expect(valueInput.value).toBe('7');
  });

  it('lets a value box take digits below a minimum above 9 until the commit', () => {
    const { actions, state } = createState((draft) => {
      draft.search.timeWeight = { ...draft.search.timeWeight, visible: true };
    });
    mount(state);
    const valueInput = expectTag(refs().topContentWeightSliderValueInput, 'input');
    act(() => valueInput.focus());
    typeInto(valueInput, '5');
    expect(valueInput.value).toBe('5');
    typeInto(valueInput, '50');
    typeInto(valueInput, '500');
    expect(valueInput.value).toBe('500');
    key(valueInput, 'Enter');
    expect(actions.setTimeFontWeight).toHaveBeenLastCalledWith(500, { dragging: false, final: true });
    // A draft left below the minimum is clamped when it is committed.
    act(() => valueInput.focus());
    typeInto(valueInput, '2');
    act(() => valueInput.blur());
    expect(actions.setTimeFontWeight).toHaveBeenLastCalledWith(300, { dragging: false, final: true });
  });

  it('shows the slider value in a bubble while the thumb is dragged', async () => {
    const { state } = createState((draft) => {
      draft.wallpaper.overlay = { ...draft.wallpaper.overlay, value: 64 };
    });
    mount(state);
    const slider = expectTag(refs().overlaySlider, 'input');
    act(() => {
      slider.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));
    });
    const bubble = document.getElementById('_x_extension_newtab_slider_value_bubble_2026_unique_');
    expect(bubble?.textContent).toBe('64');
    expect(bubble?.dataset.visible).toBe('true');
    expect(bubble?.parentElement).toBe(document.body);
    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup'));
    });
    expect(bubble?.dataset.visible).toBe('false');
  });

  it('folds the shortcut details and keeps them folded while shortcuts are off', () => {
    const { actions, state } = createState();
    mount(state);
    const trigger = expectTag(refs().shortcutsAccordionTrigger, 'button');
    const details = refs().shortcutsDetails;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(details.getAttribute('role')).toBe('region');
    expect(details.hidden).toBe(true);
    expect((expectTag(refs().shortcutAddToggle, 'input')).disabled).toBe(true);
    expect((expectTag(refs().shortcutColumnsSlider, 'input')).disabled).toBe(true);
    expect((expectTag(refs().shortcutColumnsSliderValueInput, 'input')).disabled).toBe(true);
    act(() => trigger.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(details.hidden).toBe(false);
    expect((expectTag(refs().shortcutAddToggle, 'input')).disabled).toBe(false);
    expect((expectTag(refs().shortcutDockMagnificationToggle, 'input')).disabled).toBe(false);
    expect((expectTag(refs().shortcutColumnsSlider, 'input')).disabled).toBe(false);
    act(() => (expectTag(refs().shortcutAddToggle, 'input')).click());
    expect(actions.setShortcutAddVisible).toHaveBeenCalledWith(false);
    const sizeReset = expectTag(refs().shortcutSizeResetButton, 'button');
    expect(sizeReset.disabled).toBe(true);
    expect(sizeReset.parentElement?.classList.contains('x-range-slider-field-label')).toBe(true);

    const { state: off } = createState((draft) => {
      draft.shortcuts.enabled = false;
      draft.shortcuts.toggle = { checked: false, label: 'Shortcuts' };
    });
    rerender(off);
    expect(trigger.disabled).toBe(true);
    expect(trigger.getAttribute('aria-disabled')).toBe('true');
    expect(details.hidden).toBe(true);
    act(() => trigger.click());
    expect(details.hidden).toBe(true);
    const { state: on } = createState((draft) => {
      draft.shortcuts.size = { ...draft.shortcuts.size, value: 72, resetVisible: true };
    });
    on.actions = actions;
    rerender(on);
    expect(trigger.disabled).toBe(false);
    expect(details.hidden).toBe(true);
    act(() => trigger.click());
    expect(sizeReset.disabled).toBe(false);
    act(() => sizeReset.click());
    expect(actions.resetShortcutSize).toHaveBeenCalled();
  });

  it('opens a section when its switch turns it on', () => {
    const { actions, state } = createState((draft) => {
      draft.shortcuts.enabled = false;
      draft.shortcuts.toggle = { checked: false, label: 'Shortcuts' };
    });
    mount(state);
    act(() => (expectTag(refs().shortcutsToggle, 'input')).click());
    expect(actions.setShortcutsVisible).toHaveBeenCalledWith(true);
    const { state: shortcutsOn } = createState();
    shortcutsOn.actions = actions;
    rerender(shortcutsOn);
    expect(refs().shortcutsAccordionTrigger.getAttribute('aria-expanded')).toBe('true');
    expect(refs().shortcutsDetails.hidden).toBe(false);

    act(() => refs().wallpaperAccordionTrigger.click());
    expect(refs().body.getAttribute('data-visible')).toBe('false');
    const { state: wallpaperOff } = createState((draft) => {
      draft.wallpaper.enabled = false;
      draft.wallpaper.toggle = { ...draft.wallpaper.toggle, checked: false };
    });
    wallpaperOff.actions = actions;
    rerender(wallpaperOff);
    act(() => (expectTag(refs().enabledToggle, 'input')).click());
    expect(actions.setWallpaperEnabled).toHaveBeenCalledWith(true);
    rerender(shortcutsOn);
    expect(refs().body.getAttribute('data-visible')).toBe('true');
  });

  it('folds and unfolds the sections without switches', () => {
    const { state } = createState();
    mount(state);
    [
      ['themeSectionTrigger', 'themeSectionBody'],
      ['searchSectionTrigger', 'searchSectionBody'],
      ['faviconSectionTrigger', 'faviconSectionBody']
    ].forEach(([triggerName, bodyName]) => {
      const trigger = refs()[triggerName];
      const body = refs()[bodyName];
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(body.hidden).toBe(false);
      act(() => trigger.click());
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(body.hidden).toBe(true);
      expect(body.getAttribute('aria-hidden')).toBe('true');
    });
    const wallpaperTrigger = refs().wallpaperAccordionTrigger;
    expect(refs().body.dataset.visible).toBe('true');
    act(() => wallpaperTrigger.click());
    expect(refs().body.dataset.visible).toBe('false');
    expect(wallpaperTrigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('submits the link form and clears it once the runtime saves the link', () => {
    const { actions, state } = createState((draft) => {
      draft.wallpaper.local.url = { ...draft.wallpaper.local.url, open: true, placeholder: 'Paste' };
    });
    mount(state);
    expect(refs().urlForm.hidden).toBe(false);
    expect(refs().urlTile.getAttribute('aria-expanded')).toBe('true');
    expect(refs().urlTile.getAttribute('aria-controls')).toBe(refs().urlForm.id);
    const input = expectTag(refs().urlInput, 'input');
    typeInto(input, 'https://example.com/a.jpg');
    act(() => {
      refs().urlForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(actions.submitWallpaperUrl).toHaveBeenCalledWith('https://example.com/a.jpg');
    const { state: invalid } = createState((draft) => {
      draft.wallpaper.local.url = { ...draft.wallpaper.local.url, invalid: true, open: true };
    });
    invalid.actions = actions;
    rerender(invalid);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.value).toBe('https://example.com/a.jpg');
    typeInto(input, 'https://example.com/b.jpg');
    expect(actions.clearUrlInvalid).toHaveBeenCalled();
    const { state: saved } = createState((draft) => {
      draft.wallpaper.local.url = { ...draft.wallpaper.local.url, clearToken: 1, open: false };
    });
    saved.actions = actions;
    rerender(saved);
    expect(refs().urlForm.hidden).toBe(true);
    expect(input.value).toBe('');
    act(() => refs().urlTile.click());
    expect(actions.toggleUrlForm).toHaveBeenCalled();
  });

  it('draws the bookmark and site card sections once their runtime hands them over', () => {
    const { state } = createState();
    mount(state);
    expect(refs().bookmarkSettingsSection).toBeUndefined();
    act(() => controller?.renderQuoteSettings(createQuoteSettingsModel(createQuoteActions())));
    const shortcutsSection = refs().shortcutsAccordion.parentElement;
    expect(shortcutsSection?.nextElementSibling).toBe(refs().quoteDivider);

    const actions = createSectionActions();
    act(() => controller?.renderSectionSettings(createSectionSettingsModel(actions)));
    expect(shortcutsSection?.nextElementSibling?.nextElementSibling).toBe(refs().bookmarkSettingsSection);
    expect(refs().bookmarkSettingsSection.nextElementSibling?.nextElementSibling).toBe(refs().recentSettingsSection);
    expect(refs().recentSettingsSection.nextElementSibling).toBe(refs().quoteDivider);
    [
      [refs().bookmarkSettingsTrigger, refs().bookmarkSettingsBody, refs().bookmarkSettingsToggle],
      [refs().recentSettingsTrigger, refs().recentSettingsBody, refs().recentSettingsToggle]
    ].forEach(([trigger, body, toggle]) => {
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(trigger.getAttribute('aria-controls')).toBe(body.id);
      expect(body.hidden).toBe(true);
      expect(toggle.getAttribute('role')).toBe('switch');
    });
    const rows = expectTag(refs().bookmarkRowsSlider, 'input');
    expect([rows.min, rows.max, rows.value]).toEqual(['1', '8', '2']);
    expect(Array.from(refs().recentRowsTabs.querySelectorAll('button'), (button) => button.textContent))
      .toEqual(['1', '2']);
    expect(refs().bookmarkTopbarSettings.hidden).toBe(true);

    act(() => refs().bookmarkSettingsTrigger.click());
    act(() => getTag(refs().recentRowsTabs, '[data-recent-rows="2"]', 'button').click());
    act(() => expectTag(refs().recentSettingsToggle, 'input').click());
    expect(actions.toggleBookmarkExpanded).toHaveBeenCalledTimes(1);
    expect(actions.setRecentRows).toHaveBeenCalledWith('2');
    expect(actions.setRecentVisible).toHaveBeenCalledWith(false);

    act(() => controller?.renderSectionSettings(createSectionSettingsModel(actions, (model) => {
      model.bookmark.expanded = true;
      model.bookmark.topbarMode = true;
      model.recent.enabled = false;
    })));
    expect(refs().bookmarkSettingsTrigger.getAttribute('aria-expanded')).toBe('true');
    expect(refs().bookmarkSettingsBody.hidden).toBe(false);
    expect(refs().bookmarkGridSettings.hidden).toBe(true);
    expect(refs().bookmarkTopbarSettings.hidden).toBe(false);
    expect(expectTag(refs().recentSettingsTrigger, 'button').disabled).toBe(true);
    act(() => getTag(refs().bookmarkTopbarLayoutTabs, '[data-bookmark-topbar-layout="floating"]', 'button').click());
    expect(actions.setBookmarkTopbarLayout).toHaveBeenCalledWith('floating');
    // A panel re-render keeps the sections as their runtime last drew them.
    rerender(createState().state);
    expect(refs().bookmarkTopbarSettings.hidden).toBe(false);
  });

  it('draws the quote section from its runtime\'s model', () => {
    const { state, actions: panelActions } = createState();
    mount(state);
    expect(refs().quoteSection).toBeUndefined();
    const actions = createQuoteActions();
    act(() => controller?.renderQuoteSettings(createQuoteSettingsModel(actions)));
    expect(expectTag(refs().quoteAccordionTrigger, 'button').disabled).toBe(true);
    expect(refs().quoteBody.hidden).toBe(true);
    act(() => expectTag(refs().quoteEnabledToggle, 'input').click());
    expect(actions.setEnabled).toHaveBeenCalledWith(true);

    act(() => controller?.renderQuoteSettings(createQuoteSettingsModel(actions, (model) => {
      model.quote.enabled = true;
      model.quote.customMode = true;
      model.quote.source.active = 'custom';
      model.quote.library.status = { text: 'Import failed', error: true };
      model.quote.library.count = { text: '3 quotes', label: 'mine.txt · 3 quotes', filename: 'mine.txt' };
      model.quote.library.shuffleVisible = true;
      model.quote.fontSize.value = 20;
    })));
    expect(refs().quoteBody.hidden).toBe(false);
    expect(refs().quoteCustomBody.hidden).toBe(false);
    expect(refs().quoteCategory.closest('.x-nt-appearance-setting-row')?.hasAttribute('hidden')).toBe(true);
    expect(refs().quoteImportStatus.textContent).toBe('Import failed');
    expect(refs().quoteImportStatus.getAttribute('role')).toBe('alert');
    expect(refs().quoteLibraryCountText.textContent).toBe('3 quotes');
    expect(refs().quoteLibraryCount.getAttribute('aria-label')).toBe('mine.txt · 3 quotes');
    act(() => {
      refs().quoteLibraryCount.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
    });
    expect(panelActions.showTooltip).toHaveBeenCalledWith(refs().quoteLibraryCount, 'mine.txt');
    expect(refs().quoteLibraryShuffleButton.hidden).toBe(false);
    act(() => refs().quoteLibraryShuffleButton.click());
    expect(actions.shuffleLibrary).toHaveBeenCalledTimes(1);
    expect(expectTag(refs().quoteFontSizeSlider, 'input').value).toBe('20');

    const fileInput = expectTag(refs().quoteFileInput, 'input');
    const file = new File(['海上生明月'], 'mine.txt', { type: 'text/plain' });
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    act(() => fileInput.dispatchEvent(new Event('change', { bubbles: true })));
    expect(actions.importFile).toHaveBeenCalledWith(file);

    act(() => controller?.renderQuoteSettings(createQuoteSettingsModel(actions, (model) => {
      model.quote.enabled = true;
    })));
    act(() => getTag(refs().quoteCategory, '[data-quote-category="poetry"]', 'button').click());
    expect(actions.setCategory).toHaveBeenCalledWith('poetry');
  });

  it('closes an open select menu on request', () => {
    const { state } = createState((draft) => {
      draft.wallpaper.effect.select = {
        ariaLabel: 'Wallpaper filter',
        options: [{ value: 'none', label: 'Off' }, { value: 'grain', label: 'Grain' }],
        value: 'none'
      };
    });
    mount(state);
    expect(required(controller, 'controller').closeOpenSelect()).toBe(false);
    act(() => getTag(refs().effectSelectHost, 'button', 'button').click());
    expect(refs().effectSelectHost.dataset.open).toBe('true');
    let closed = false;
    act(() => {
      closed = required(controller, 'controller').closeOpenSelect({ restoreFocus: true });
    });
    expect(closed).toBe(true);
    expect(refs().effectSelectHost.dataset.open).toBe('false');
    expect(document.activeElement).toBe(refs().effectSelectHost.querySelector('button'));
  });

  it('preserves zero as an explicit shortcut spacing value', () => {
    const { state } = createState((draft) => {
      draft.shortcuts.gap = { ...draft.shortcuts.gap, value: 0 };
    });
    mount(state);
    expect((expectTag(refs().shortcutGapSlider, 'input')).value).toBe('0');
    expect((expectTag(refs().shortcutGapSliderValueInput, 'input')).value).toBe('0');
  });
});
