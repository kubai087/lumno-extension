import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createWallpaperViewApi,
  createWallpaperViewController,
  type WallpaperViewController
} from './wallpaper-view';

let controller: WallpaperViewController | null = null;

afterEach(() => {
  if (controller) {
    act(() => controller?.destroy());
  }
  controller = null;
  document.body.innerHTML = '';
});

describe('New Tab React wallpaper view', () => {
  it('renders the complete appearance panel contract', () => {
    act(() => {
      controller = createWallpaperViewController({
        documentObj: document,
        model: {
          activeTab: 'built-in',
          appearanceOptions: [
            { mode: 'system', imageUrl: '/system.svg' },
            { mode: 'light', imageUrl: '/light.svg' },
            { mode: 'dark', imageUrl: '/dark.svg' }
          ],
          effectInkTones: [
            { tone: 'dark', fallback: 'Shadows' },
            { tone: 'light', fallback: 'Highlights' }
          ],
          favicons: [{ id: 'default', previewUrl: '/favicon.png' }],
          icons: { info: '<i class="ri-information-line"></i>' },
          moreSettingsUrl: '/options#appearance',
          helpCenterUrl: 'https://lumno.kubai.design/help/newtab-wallpaper/',
          searchWidth: {
            min: 720,
            max: 1040,
            ticks: []
          },
          shortcutColumns: {
            defaultValue: 10,
            min: 4,
            max: 16
          },
          shortcutSize: {
            defaultValue: 64,
            min: 48,
            max: 80
          },
          shortcutGap: {
            defaultValue: 4,
            min: 0,
            max: 24
          },
          topContentOptions: [
            { value: 'brand', label: 'Brand' },
            { value: 'time', label: 'Time' },
            { value: 'off', label: 'Hide' }
          ],
          wallpapers: [
            { id: 'coast', path: '/coast.webp', thumbnailUrl: '/coast-thumb.webp' }
          ]
        }
      });
    });
    if (!controller) {
      throw new Error('Expected wallpaper view controller');
    }
    expect(createWallpaperViewApi().implementation).toBe('react');
    expect(controller.control.dataset.reactIsland).toBe('newtab-wallpaper');
    expect(controller.getRefs().builtInGrid).toBeTruthy();
    expect(controller.getRefs().quoteEnabledToggle.getAttribute('role')).toBe('switch');
    expect(controller.getRefs().quoteBody.hidden).toBe(true);
    expect(controller.getRefs().quoteFileInput.getAttribute('accept')).toContain('.txt');
    expect(controller.getRefs().quoteFileInput.getAttribute('accept')).toContain('.md');
    const quoteTabGroups = controller.getRefs().quoteBody.querySelectorAll('.x-nt-segmented-tabs');
    expect(Array.from(quoteTabGroups, (group) => group.getAttribute('data-wallpaper-ref')))
      .toEqual(['quoteCategory']);
    expect(quoteTabGroups[0].querySelector('.x-nt-segmented-tabs-indicator')).not.toBeNull();
    const onQuotePositionChange = vi.fn();
    const view = controller;
    act(() => {
      view.renderQuotePositionSelect({
        ariaLabel: 'Quote position',
        onChange: onQuotePositionChange,
        options: ['top', 'input', 'search', 'bottom'].map((value) => ({ value, label: value })),
        value: 'search'
      });
    });
    const quotePositionHost = controller.getRefs().quotePositionSelectHost;
    expect(quotePositionHost.classList.contains('_x_extension_custom_select_2024_unique_')).toBe(true);
    expect(quotePositionHost.querySelector('select')?.value).toBe('search');
    const topOption = document.querySelector<HTMLElement>(
      '[data-react-select-owner="x-nt-quote-position"] [data-value="top"]'
    );
    expect(controller.containsSelectMenuTarget(topOption)).toBe(true);
    act(() => {
      topOption?.click();
    });
    expect(onQuotePositionChange).toHaveBeenCalledWith('top');
    expect(controller.getRefs().quoteProviderHint).toBeUndefined();
    expect(controller.getRefs().quoteInfoButton.previousElementSibling).toBe(
      controller.getRefs().quoteAccordionTrigger
    );
    const sectionTriggers = Array.from(
      controller.control.querySelectorAll<HTMLButtonElement>('.x-nt-section-trigger')
    );
    expect(sectionTriggers.map((trigger) => trigger.dataset.wallpaperRef)).toEqual([
      'themeSectionTrigger',
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
      expect(controller?.control.querySelector(`#${trigger.getAttribute('aria-controls')}`)).not.toBeNull();
    });
    expect(controller.getRefs().bingDailyHint).toBeUndefined();
    expect(controller.getRefs().bingDailyInfoButton.closest('.x-nt-appearance-setting-title-group')).not.toBeNull();
    expect(controller.getRefs().bingSelectedLink.classList.contains('x-lumno-link-button')).toBe(true);
    expect(controller.getRefs().bingSelectedLink.getAttribute('target')).toBe('_blank');
    expect(controller.getRefs().bingSelectedLink.querySelector('.ri-external-link-line')).not.toBeNull();
    expect(controller.getRefs().moreSettingsLink.classList.contains('x-lumno-link-button')).toBe(true);
    expect(controller.getRefs().moreSettingsLink.querySelector('.ri-external-link-line')).not.toBeNull();
    const helpFooterLink = controller.getRefs().helpFooterLink;
    expect(helpFooterLink.getAttribute('href')).toBe('https://lumno.kubai.design/help/newtab-wallpaper/');
    expect(helpFooterLink.getAttribute('target')).toBe('_blank');
    expect(helpFooterLink.closest('.x-nt-appearance-help-footer')).not.toBeNull();
    expect(controller.getRefs().helpFooterPrompt.parentElement).toBe(helpFooterLink.parentElement);
    // Pinned under the scroll area, so it stays visible while settings scroll.
    expect(helpFooterLink.closest('.x-nt-wallpaper-panel-scroll')).toBeNull();
    expect(helpFooterLink.closest('.x-nt-wallpaper-panel')?.lastElementChild)
      .toBe(helpFooterLink.parentElement);
    expect(controller.getRefs().bingTab.textContent).toBe('Bing');
    expect(controller.getRefs().bingDailyToggle.getAttribute('role')).toBe('switch');
    expect(controller.getRefs().bingSelectedSource.hidden).toBe(true);
    expect(controller.getRefs().bingRefresh.closest('.x-nt-overlay-control-header')).not.toBeNull();
    expect(controller.control.querySelector('[data-wallpaper-tab="wallhaven"]')).toBeNull();
    expect(
      controller.control.querySelector('[data-wallpaper-id="coast"]')
    ).not.toBeNull();
    // The filter dropdown is mounted into this host by the wallpaper runtime.
    expect(
      controller.getRefs().effectSelectHost.closest('.x-nt-appearance-setting-row')
    ).toBe(controller.getRefs().effectLabel.parentElement);
    expect(
      controller.getRefs().effectLabel.classList.contains('x-nt-appearance-setting-title')
    ).toBe(true);
    expect(
      controller.control.querySelectorAll('[data-wallpaper-effect-type]')
    ).toHaveLength(0);
    const onEffectChange = vi.fn();
    act(() => {
      controller?.renderEffectSelect({
        ariaLabel: 'Wallpaper filter',
        onChange: onEffectChange,
        options: [
          { value: 'none', label: 'Off' },
          { value: 'grain', label: 'Grain' }
        ],
        value: 'none'
      });
    });
    const effectSelectHost = controller.getRefs().effectSelectHost;
    expect(effectSelectHost.classList.contains('_x_extension_custom_select_2024_unique_')).toBe(true);
    expect(effectSelectHost.querySelector('select')?.value).toBe('none');
    expect(effectSelectHost.querySelector('._x_extension_select_label_2024_unique_')?.textContent).toBe('Off');
    const grainOption = document.querySelector<HTMLElement>(
      '[data-react-select-owner="x-nt-wallpaper-effect"] [data-value="grain"]'
    );
    expect(grainOption?.getAttribute('role')).toBe('option');
    expect(controller.containsSelectMenuTarget(grainOption)).toBe(true);
    act(() => {
      grainOption?.click();
    });
    expect(onEffectChange).toHaveBeenCalledWith('grain');
    expect(
      controller.control.querySelectorAll('[data-wallpaper-blur-style]')
    ).toHaveLength(0);
    expect(controller.getRefs().effectBlurStyleControl).toBeUndefined();
    expect(
      controller.control.querySelectorAll('[data-wallpaper-effect-ink-tone]')
    ).toHaveLength(2);
    expect(controller.getRefs().effectInkToneControl).toBeTruthy();
    expect(controller.getRefs().effectCrtGrainControl).toBeUndefined();
    expect(
      controller.getRefs().effectSpacingSlider?.dataset.wallpaperDynamicRange
    ).toBeUndefined();
    const sliderRows = controller.control.querySelectorAll<HTMLElement>(
      '.x-nt-range-slider-row'
    );
    expect(sliderRows).toHaveLength(16);
    sliderRows.forEach((row) => {
      const slider = row.querySelector<HTMLInputElement>('input[type="range"]');
      const valueInput = row.querySelector<HTMLInputElement>('input[type="number"]');
      expect(slider).not.toBeNull();
      expect(row.classList.contains('x-range-slider-field')).toBe(true);
      expect(row.firstElementChild?.classList.contains('x-range-slider-field-label')).toBe(true);
      expect(valueInput?.max).toBe(slider?.max);
      expect(valueInput?.style.width).toBe('var(--x-range-slider-value-width, 52px)');
      expect(valueInput?.classList.contains('_x_extension_shortcut_input_2024_unique_'))
        .toBe(true);
      expect(valueInput?.classList.contains(
        '_x_extension_range_slider_value_input_2026_unique_'
      )).toBe(true);
      expect(valueInput?.style.height).toBe('var(--x-range-slider-value-height, 30px)');
    });
    expect(controller.getRefs().effectSizeSlider?.dataset.wallpaperDynamicRange).toBeUndefined();
    expect(controller.getRefs().effectTextureSlider?.dataset.wallpaperDynamicRange).toBeUndefined();
    expect(controller.getRefs().effectStrengthSlider?.dataset.wallpaperDynamicRange).toBeUndefined();
    const segmentedGroups = [controller.getRefs().effectInkToneOptions];
    segmentedGroups.forEach((group) => {
      expect(group?.classList.contains('x-nt-segmented-tabs')).toBe(true);
      expect(group?.querySelector('.x-nt-segmented-tabs-indicator')).not.toBeNull();
      group?.querySelectorAll('button').forEach((button) => {
        expect(button.classList.contains('x-nt-segmented-tab')).toBe(true);
      });
    });
    expect(controller.getRefs().effectInkToneIndicator).toBeTruthy();
    expect(controller.getRefs().effectCrtPresetIndicator).toBeUndefined();
    expect(
      controller.control.querySelectorAll('[data-wallpaper-effect-crt-preset]')
    ).toHaveLength(0);
    const topContentGroup = controller.getRefs().topContentTabs;
    expect(topContentGroup?.getAttribute('role')).toBe('group');
    const topContentButtons = topContentGroup?.querySelectorAll('button');
    expect(topContentButtons).toHaveLength(3);
    expect(topContentButtons?.[0]?.getAttribute('aria-pressed')).toBe('true');
    const inputAutoFocusToggle = controller.getRefs().inputAutoFocusToggle;
    expect(inputAutoFocusToggle?.getAttribute('role')).toBe('switch');
    expect(inputAutoFocusToggle?.getAttribute('aria-label')).toBe(
      'Automatically focus the search input'
    );
    const inputAutoFocusInfoButton = controller.getRefs().inputAutoFocusInfoButton;
    expect(inputAutoFocusInfoButton?.classList.contains('x-nt-appearance-info-button')).toBe(true);
    expect(inputAutoFocusInfoButton?.querySelector('.ri-information-line')).not.toBeNull();
  });

  it('renders the shortcuts accordion collapsed with editable slider ticks', () => {
    act(() => {
      controller = createWallpaperViewController({
        documentObj: document,
        model: {
          appearanceOptions: [],
          favicons: [],
          icons: { arrow: '<i class="ri-arrow-right-s-line"></i>' },
          searchWidth: { min: 720, max: 1040, ticks: [] },
          shortcutColumns: {
            defaultValue: 10,
            min: 4,
            max: 16
          },
          shortcutSize: {
            defaultValue: 64,
            min: 48,
            max: 80
          },
          shortcutGap: {
            defaultValue: 4,
            min: 0,
            max: 24
          },
          wallpapers: []
        }
      });
    });
    if (!controller) {
      throw new Error('Expected wallpaper view controller');
    }
    const refs = controller.getRefs();
    const trigger = refs.shortcutsAccordionTrigger as HTMLButtonElement;
    const details = refs.shortcutsDetails as HTMLDivElement;
    const slider = refs.shortcutColumnsSlider as HTMLInputElement;
    const valueInput = refs.shortcutColumnsSliderValueInput as HTMLInputElement;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toBe(
      '_x_extension_newtab_shortcuts_settings_2026_unique_'
    );
    expect(details.getAttribute('role')).toBe('region');
    expect(details.hidden).toBe(true);
    expect(slider.type).toBe('range');
    expect(slider.min).toBe('4');
    expect(slider.max).toBe('16');
    expect(slider.step).toBe('1');
    expect(slider.value).toBe('10');
    expect(valueInput.type).toBe('number');
    expect(valueInput.value).toBe('10');
    expect(valueInput.max).toBe(slider.max);
    expect(valueInput.max).toBe('16');
    expect(valueInput.style.width).toBe('var(--x-range-slider-value-width, 52px)');
    expect(valueInput.style.height).toBe('var(--x-range-slider-value-height, 30px)');
    const marks = slider.style.getPropertyValue('--x-range-slider-marks');
    expect(marks.match(/linear-gradient/g)).toHaveLength(2);
    expect(marks).toContain('* 0.3333)');
    expect(marks).toContain('* 0.6667)');
    const sizeSlider = refs.shortcutSizeSlider as HTMLInputElement;
    const sizeReset = refs.shortcutSizeResetButton as HTMLButtonElement;
    const gapSlider = refs.shortcutGapSlider as HTMLInputElement;
    const gapReset = refs.shortcutGapResetButton as HTMLButtonElement;
    expect([sizeSlider.min, sizeSlider.value, sizeSlider.max]).toEqual([
      '48', '64', '80'
    ]);
    expect([gapSlider.min, gapSlider.value, gapSlider.max]).toEqual([
      '0', '4', '24'
    ]);
    [sizeReset, gapReset].forEach((button) => {
      expect(button.querySelector('.ri-reset-left-line')).not.toBeNull();
      expect(button.querySelector('.ri-size-14')).not.toBeNull();
      expect(button.classList.contains(
        '_x_extension_shortcut_group_action_2024_unique_'
      )).toBe(true);
      // Reset trails the label so all tracks keep the same length.
      expect(button.parentElement?.classList.contains('x-range-slider-field-label')).toBe(true);
      expect(button.classList.contains('x-range-slider-reset')).toBe(true);
      expect(button.disabled).toBe(true);
    });
  });

  it('renders the bookmark and site card sections under shortcuts', () => {
    act(() => {
      controller = createWallpaperViewController({
        documentObj: document,
        model: {
          appearanceOptions: [],
          favicons: [],
          icons: { arrow: '<i class="ri-arrow-right-s-line"></i>' },
          searchWidth: { min: 720, max: 1040, ticks: [] },
          wallpapers: []
        }
      });
    });
    if (!controller) {
      throw new Error('Expected wallpaper view controller');
    }
    const refs = controller.getRefs();
    const shortcutsSection = refs.shortcutsAccordion.parentElement;
    expect(shortcutsSection?.nextElementSibling?.classList.contains('x-nt-panel-divider')).toBe(true);
    expect(shortcutsSection?.nextElementSibling?.nextElementSibling).toBe(refs.bookmarkSettingsSection);
    expect(refs.bookmarkSettingsSection.nextElementSibling?.nextElementSibling).toBe(refs.recentSettingsSection);
    expect(refs.recentSettingsSection.nextElementSibling).toBe(refs.quoteDivider);
    [
      [refs.bookmarkSettingsTrigger, refs.bookmarkSettingsBody, refs.bookmarkSettingsToggle],
      [refs.recentSettingsTrigger, refs.recentSettingsBody, refs.recentSettingsToggle]
    ].forEach(([trigger, body, toggle]) => {
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(trigger.getAttribute('aria-controls')).toBe(body.id);
      expect(body.hidden).toBe(true);
      expect(toggle.getAttribute('role')).toBe('switch');
    });
    const rows = refs.bookmarkRowsSlider as HTMLInputElement;
    const columns = refs.bookmarkColumnsSlider as HTMLInputElement;
    expect([rows.min, rows.max, rows.step]).toEqual(['1', '8', '1']);
    expect([columns.min, columns.max, columns.step]).toEqual(['4', '8', '1']);
    expect(refs.bookmarkGridSettings.contains(refs.bookmarkFolderIconsToggle)).toBe(true);
    expect(refs.bookmarkTopbarSettings.hidden).toBe(true);
    expect(Array.from(
      refs.bookmarkTopbarLayoutTabs.querySelectorAll('button'),
      (button) => button.dataset.bookmarkTopbarLayout
    )).toEqual(['docked', 'floating']);
    expect(Array.from(refs.recentModeTabs.querySelectorAll('button'), (button) => button.dataset.recentMode))
      .toEqual(['latest', 'most', 'custom']);
    expect(Array.from(refs.recentRowsTabs.querySelectorAll('button'), (button) => button.textContent))
      .toEqual(['1', '2']);

    const onViewModeChange = vi.fn();
    const onSurfaceChange = vi.fn(() => false);
    act(() => {
      controller?.renderBookmarkViewModeSelect({
        ariaLabel: 'Display mode',
        onChange: onViewModeChange,
        options: ['folder', 'list', 'top'].map((value) => ({ value, label: value })),
        value: 'folder'
      });
      controller?.renderBookmarkTopbarSurfaceSelect({
        ariaLabel: 'Bar background',
        onChange: onSurfaceChange,
        options: ['adaptive', 'custom'].map((value) => ({
          value,
          label: value,
          radio: true,
          checked: value === 'adaptive'
        })),
        value: 'adaptive'
      });
    });
    expect(refs.bookmarkViewModeSelectHost.querySelector('select')?.value).toBe('folder');
    const topOption = document.querySelector<HTMLElement>(
      '[data-react-select-owner="x-nt-bookmark-view-mode"] [data-value="top"]'
    );
    expect(controller.containsSelectMenuTarget(topOption)).toBe(true);
    act(() => topOption?.click());
    expect(onViewModeChange).toHaveBeenCalledWith('top');
    const customOption = document.querySelector<HTMLElement>(
      '[data-react-select-owner="x-nt-bookmark-topbar-surface"] [data-value="custom"]'
    );
    act(() => customOption?.click());
    expect(onSurfaceChange).toHaveBeenCalledWith('custom');
    // Declined until the picker returns a color.
    expect(refs.bookmarkTopbarSurfaceSelectHost.querySelector('select')?.value).toBe('adaptive');
  });

  it('updates custom wallpaper tiles without replacing the panel', () => {
    act(() => {
      controller = createWallpaperViewController({
        documentObj: document,
        model: {
          appearanceOptions: [],
          favicons: [],
          icons: {},
          searchWidth: { min: 720, max: 1040, ticks: [] },
          wallpapers: []
        }
      });
    });
    if (!controller) {
      throw new Error('Expected wallpaper view controller');
    }
    const panel = controller.panel;
    let tiles: HTMLElement[] = [];
    act(() => {
      tiles = controller?.renderCustomWallpapers([
        { id: 'custom-1', thumbnailUrl: 'data:image/png;base64,AA==' }
      ]) || [];
    });
    expect(tiles).toHaveLength(1);
    expect(tiles[0].dataset.wallpaperId).toBe('custom-1');
    expect(controller.panel).toBe(panel);
  });

  it('renders the curated source and the link form', () => {
    act(() => {
      controller = createWallpaperViewController({
        documentObj: document,
        model: {
          appearanceOptions: [],
          curatedCategories: [
            { value: 'nature', label: 'Nature' },
            { value: 'city', label: 'City' }
          ],
          favicons: [],
          icons: {},
          searchWidth: { min: 720, max: 1040, ticks: [] },
          wallpapers: []
        }
      });
    });
    if (!controller) {
      throw new Error('Expected wallpaper view controller');
    }
    const refs = controller.getRefs();
    expect(Array.from(refs.tabs.querySelectorAll('[data-wallpaper-tab]'), (tab) => tab.getAttribute('data-wallpaper-tab')))
      .toEqual(['built-in', 'local', 'bing', 'curated']);
    expect(Array.from(refs.curatedCategoryTabs.querySelectorAll('[data-curated-category]'), (tab) => tab.textContent))
      .toEqual(['Nature', 'City']);
    expect(refs.curatedDailyToggle.getAttribute('role')).toBe('switch');
    expect(refs.curatedSelectedSource.hidden).toBe(true);
    expect(refs.urlTile.closest('[data-wallpaper-panel="local"]')).not.toBeNull();
    expect(refs.urlForm.hidden).toBe(true);
    expect(refs.urlTile.getAttribute('aria-controls')).toBe(refs.urlForm.id);
    expect(refs.urlSubmit.getAttribute('type')).toBe('submit');
    let tiles: HTMLElement[] = [];
    act(() => {
      tiles = controller?.renderCuratedWallpapers([
        { id: 'picsum-28', thumbnailUrl: 'https://picsum.photos/id/28/480/270' }
      ]) || [];
    });
    expect(tiles).toHaveLength(1);
    expect(tiles[0].closest('[data-wallpaper-ref="curatedItemsHost"]')).not.toBeNull();
    expect(refs.bingItemsHost.children).toHaveLength(0);
  });

  it('preserves zero as an explicit shortcut spacing value', () => {
    act(() => {
      controller = createWallpaperViewController({
        documentObj: document,
        model: {
          appearanceOptions: [],
          favicons: [],
          icons: {},
          searchWidth: { min: 720, max: 1040, ticks: [] },
          shortcutGap: { defaultValue: 0, min: 0, max: 24 },
          wallpapers: []
        }
      });
    });
    const refs = controller?.getRefs();
    expect((refs?.shortcutGapSlider as HTMLInputElement)?.value).toBe('0');
    expect((refs?.shortcutGapSliderValueInput as HTMLInputElement)?.value).toBe('0');
  });
});
