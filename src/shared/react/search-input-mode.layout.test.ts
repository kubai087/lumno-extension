import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModeMenuItem } from '../search/input-mode/types';
import type { CursorTooltipController } from '../ui/cursor-tooltip-model';
import { queryHtmlElement, queryHtmlTag } from '../dom-lookup';
import { getElement, getElements, getTags, required } from '../../../tests/react/dom';
import { LumnoSearchInputMode, createModeParts, getTestContrastRatio, resetModeTest } from '../../../tests/react/search-input-mode';

afterEach(resetModeTest);

describe('Search scope menu: layout, icons and reordering', () => {
  it('opens a wide horizontal menu and supports horizontal arrow navigation', () => {
    const parts = createModeParts();
    const items: ModeMenuItem[] = [
      {
        active: true,
        group: 'Search scope',
        iconName: 'ri-search-line',
        id: 'all',
        kind: 'all',
        label: 'Search everything'
      },
      {
        group: 'Browser content',
        iconName: 'ri-bookmark-3-line',
        id: 'local:bookmark',
        kind: 'local',
        label: 'Bookmarks'
      },
      {
        group: 'Site search',
        iconName: 'ri-global-line',
        id: 'provider:bilibili',
        kind: 'provider',
        label: 'Bilibili'
      }
    ];
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      { getModeMenuItems: () => items }
    );
    controller.setPrefixText('Search everything');
    controller.openModeMenu();
    const menuItems = Array.from(
      getTags(controller.menuElement, '[role="menuitemradio"]', 'button')
    );

    expect(controller.menuElement.style.left).toBe('-6px');
    expect(controller.menuElement.style.right).toBe('-6px');
    expect(controller.menuElement.style.width).toBe('auto');
    expect(controller.menuElement.style.height).toBe(
      'min(360px, 62vh, var(--x-lumno-search-mode-menu-viewport-max-height, 360px))'
    );
    expect(controller.menuElement.style.padding).toBe('0px');
    expect(
      controller.menuElement.classList.contains(
        '_x_extension_menu_surface_2024_unique_'
      )
    ).toBe(true);
    expect(parts.container.getAttribute('data-mode-menu-open')).toBe('true');
    menuItems[0].dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' })
    );
    expect(document.activeElement).toBe(menuItems[1]);
    controller.closeModeMenu();
    expect(parts.container.hasAttribute('data-mode-menu-open')).toBe(false);
    controller.destroy();
  });

  it('keeps the results at their height and fits the scope menu below them', () => {
    const parts = createModeParts();
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        getModeMenuItems: () => [{
          active: true,
          id: 'provider:google',
          kind: 'provider',
          label: 'Google'
        }]
      }
    );
    Object.defineProperty(parts.container, 'offsetHeight', {
      configurable: true,
      value: 56
    });
    vi.spyOn(parts.container, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 244, 760, 56));
    Object.defineProperty(controller.menuElement, 'offsetTop', {
      configurable: true,
      value: 70
    });
    const CAP = '--x-test-results-cap';
    const resultsElement = document.createElement('div');
    let resultsShown = false;
    let naturalHeight = 0;
    // The results are as tall as their rows unless their cap is shorter.
    Object.defineProperty(resultsElement, 'offsetHeight', {
      configurable: true,
      get: () => Math.min(naturalHeight, Number.parseFloat(resultsElement.style.getPropertyValue(CAP)) || Infinity)
    });
    const results = { element: resultsElement, capProperty: CAP, isShown: () => resultsShown } as const;
    const place = (viewportBottom: number) => controller.placeModeMenuBelowResults(results, { viewportBottom });
    const menuMaxHeight = () => controller.menuElement.style.getPropertyValue(
      '--x-lumno-search-mode-menu-viewport-max-height'
    );
    const resultOffset = () => controller.menuElement.style.getPropertyValue(
      '--x-lumno-search-mode-menu-result-offset'
    );
    controller.openModeMenu('none');

    // 871px under the input: no results leave it all to the menu.
    expect(place(1209)).toBe(true);
    expect(resultsElement.style.getPropertyValue(CAP)).toBe('671px');
    expect(menuMaxHeight()).toBe('871px');
    expect(resultOffset()).toBe('0px');

    // One site search row keeps its height, even under a shorter cap left
    // from before; the menu takes the rest.
    resultsShown = true;
    naturalHeight = 72;
    resultsElement.style.setProperty(CAP, '20px');
    expect(place(1209)).toBe(true);
    expect(resultsElement.style.getPropertyValue(CAP)).toBe('671px');
    expect(menuMaxHeight()).toBe('799px');
    expect(resultOffset()).toBe('72px');
    expect(place(1209)).toBe(false);

    // 262px: the menu keeps its least height and the row gets what is left.
    expect(place(600)).toBe(true);
    expect(resultsElement.style.getPropertyValue(CAP)).toBe('62px');
    expect(menuMaxHeight()).toBe('200px');
    expect(resultOffset()).toBe('62px');

    // A long list gives way to the menu's least height and scrolls.
    naturalHeight = 900;
    place(1209);
    expect(menuMaxHeight()).toBe('200px');
    expect(resultOffset()).toBe('671px');

    // Closed, the menu leaves the results uncapped.
    controller.closeModeMenu();
    expect(place(1209)).toBe(true);
    expect(resultsElement.style.getPropertyValue(CAP)).toBe('');
    expect(menuMaxHeight()).toBe('');
    controller.destroy();
  });

  it('lifts an open scope menu when the input contains a query', () => {
    const parts = createModeParts();
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        getModeMenuItems: () => [{
          active: true,
          id: 'provider:youtube',
          kind: 'provider',
          label: 'YouTube'
        }]
      }
    );
    controller.setPrefixText('YouTube');
    controller.openModeMenu();

    expect(controller.menuElement.dataset.hasQuery).toBe('false');
    expect(
      controller.menuElement.style.getPropertyValue(
        '--x-lumno-search-mode-menu-lift'
      )
    ).toBe('0px');

    parts.input.value = '12';
    parts.input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(controller.menuElement.dataset.hasQuery).toBe('true');
    expect(
      controller.menuElement.style.getPropertyValue(
        '--x-lumno-search-mode-menu-lift'
      )
    ).toBe('-8px');
    expect(
      controller.menuElement.style.getPropertyValue(
        '--x-extension-menu-surface-open-transform'
      )
    ).toContain(
      'var(--x-lumno-search-mode-menu-result-offset, 0px)'
    );
    controller.destroy();
  });

  it('shows the full label bubble only when the trailing-ellipsis label overflows', () => {
    const parts = createModeParts();
    const tooltipController = {
      bind: vi.fn<CursorTooltipController['bind']>(() => null),
      hide: vi.fn<CursorTooltipController['hide']>(() => null)
    };
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        modeMenuCursorTooltipController: tooltipController,
        getModeMenuItems: () => [{
          active: true,
          id: 'provider:wechat',
          kind: 'provider',
          label: '微信公众号'
        }]
      }
    );
    controller.setPrefixText('微信公众号');
    controller.openModeMenu();

    const item = queryHtmlTag(controller.menuElement, '[role="menuitemradio"]', 'button');
    const label = getElement(required(item, 'menu item'), '.x-lumno-search-input-mode__menu-label');
    expect(item?.getAttribute('aria-label')).toBe('微信公众号');
    expect(label?.textContent).toBe('微信公众号');
    expect(label?.hasAttribute('title')).toBe(false);
    expect(tooltipController.bind).toHaveBeenCalledOnce();

    const resolveTooltipText = tooltipController.bind.mock.calls[0]?.[1];
    const tooltipOptions = tooltipController.bind.mock.calls[0]?.[2];
    expect(resolveTooltipText).toBeTypeOf('function');
    expect(tooltipOptions?.shouldShow).toBeTypeOf('function');
    expect(tooltipOptions).not.toHaveProperty('placement');
    Object.defineProperty(label, 'clientWidth', {
      configurable: true,
      value: 48
    });
    Object.defineProperty(label, 'scrollWidth', {
      configurable: true,
      value: 76
    });
    expect(resolveTooltipText?.(label)).toBe('微信公众号');
    expect(tooltipOptions?.shouldShow?.(label, null)).toBe(true);
    expect(item?.getAttribute('data-label-truncated')).toBe('true');

    Object.defineProperty(label, 'scrollWidth', {
      configurable: true,
      value: 49
    });
    expect(resolveTooltipText?.(label)).toBe('微信公众号');
    expect(tooltipOptions?.shouldShow?.(label, null)).toBe(true);
    expect(item?.getAttribute('data-label-truncated')).toBe('true');

    Object.defineProperty(label, 'clientWidth', {
      configurable: true,
      value: 80
    });
    expect(resolveTooltipText?.(label)).toBe('微信公众号');
    expect(tooltipOptions?.shouldShow?.(label, null)).toBe(false);
    expect(item?.getAttribute('data-label-truncated')).toBe('false');
    controller.destroy();
  });

  it('uses opaque menu materials with the same radius as each search input', () => {
    const newtabParts = createModeParts();
    const newtabController = LumnoSearchInputMode.createInputModeController(
      newtabParts,
      { surface: 'newtab' }
    );
    expect(newtabController.menuElement.dataset.surface).toBe('newtab');
    expect(newtabController.menuElement.style.background).toBe(
      'var(--x-nt-mode-menu-bg, #FFFFFF)'
    );
    expect(newtabController.menuElement.style.borderRadius).toBe(
      'var(--x-nt-search-shell-radius, 26px)'
    );
    expect(newtabController.menuElement.style.top).toBe('calc(100% + 18px)');
    expect(newtabController.menuElement.style.boxShadow).toBe(
      'var(--x-nt-panel-shadow-focus, 0 16px 40px rgba(15, 23, 42, 0.13))'
    );
    newtabController.destroy();

    const overlayParts = createModeParts('overlay');
    const overlayController = LumnoSearchInputMode.createInputModeController(
      overlayParts,
      { surface: 'overlay' }
    );
    expect(overlayController.menuElement.dataset.surface).toBe('overlay');
    expect(overlayController.menuElement.style.background).toBe(
      'var(--x-ov-mode-menu-bg, #FFFFFF)'
    );
    expect(overlayController.menuElement.style.borderRadius).toBe(
      'var(--x-ov-panel-radius, 26px)'
    );
    expect(overlayController.menuElement.style.top).toBe('calc(100% + 14px)');
    expect(overlayController.menuElement.style.boxShadow).toBe(
      'var(--x-ov-shadow, 0 16px 40px rgba(15, 23, 42, 0.13))'
    );
    expect(overlayController.menuElement.style.left).toBe('-1px');
    expect(overlayController.menuElement.style.right).toBe('-1px');
    overlayController.destroy();
  });

  it('shows a provider menu icon in place of its glyph once it loads', () => {
    const parts = createModeParts();
    const provider = {
      key: 'tb',
      template: 'https://s.taobao.com/search?q={query}'
    };
    const attachFaviconData = vi.fn();
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        attachFaviconData,
        getModeMenuItems: () => [{
          active: true,
          iconName: 'ri-global-line',
          iconUrl: 'https://www.taobao.com/favicon.ico',
          id: 'provider:tb',
          kind: 'provider',
          label: 'Taobao',
          provider
        }],
        getProviderThemeHost: () => 'taobao.com'
      }
    );
    controller.setPrefixText('Taobao');
    controller.openModeMenu();

    const image = getTags(controller.menuElement, 'img', 'img')[0];
    expect(image.getAttribute('src')).toBe('https://www.taobao.com/favicon.ico');
    expect(attachFaviconData).toHaveBeenCalledWith(image, 'https://www.taobao.com/favicon.ico', 'taobao.com');
    act(() => {
      image.dispatchEvent(new Event('load'));
    });
    expect(
      controller.menuElement.querySelector(
        '.x-lumno-search-input-mode__menu-icon'
      )?.getAttribute('data-icon-state')
    ).toBe('resolved');
    expect(
      queryHtmlElement(controller.menuElement, '.x-lumno-search-input-mode__menu-favicon-mask > i')?.hidden
    ).toBe(true);
    const faviconMask = queryHtmlElement(controller.menuElement, '.x-lumno-search-input-mode__menu-favicon-mask');
    expect(faviconMask).not.toBeNull();
    expect(faviconMask?.querySelector('img')?.parentElement).toBe(faviconMask);
    controller.destroy();
  });

  it('renders canonical provider data directly without host-level favicon replacement', () => {
    const parts = createModeParts();
    const provider = {
      key: 'yt',
      name: 'YouTube',
      template: 'https://www.youtube.com/results?search_query={query}'
    };
    const canonicalIcon = 'data:image/png;base64,eW91dHViZQ==';
    const attachFaviconData = vi.fn();
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        attachFaviconData,
        getProviderIcon: () => canonicalIcon,
        getModeMenuItems: () => [{
          active: true,
          iconUrl: canonicalIcon,
          id: 'provider:yt',
          kind: 'provider',
          label: 'YouTube',
          provider
        }]
      }
    );

    controller.setProviderPrefix(provider, {});
    controller.openModeMenu();

    expect(parts.modePrefixIcon.getAttribute('src')).toBe(canonicalIcon);
    expect(
      controller.menuElement.querySelector('img')?.getAttribute('src')
    ).toBe(canonicalIcon);
    expect(attachFaviconData).not.toHaveBeenCalled();
    controller.destroy();
  });

  it('renders a larger prefix favicon with a six-pixel corner mask that follows the tag', () => {
    const parts = createModeParts();
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {}
    );

    controller.setPrefixText('Google', {}, {
      iconHost: 'google.com',
      iconUrl: 'https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png',
      modeId: 'siteSearch'
    });

    expect(parts.modePrefixIcon.style.width).toBe('20px');
    expect(parts.modePrefixIcon.style.height).toBe('20px');
    expect(parts.modePrefixIconFrame.style.width).toBe('20px');
    expect(parts.modePrefixIconFrame.style.height).toBe('20px');
    expect(parts.modePrefixIconFrame.style.borderRadius).toBe('6px');
    expect(parts.modePrefixIconFrame.style.clipPath).toBe('inset(0 round 6px)');
    expect(parts.modePrefixIconFrame.style.isolation).toBe('isolate');
    expect(parts.modePrefixIcon.style.borderRadius).toBe('6px');
    expect(parts.modePrefixIcon.style.clipPath).toBe('inset(0 round 6px)');
    expect(parts.modePrefixIcon.style.overflow).toBe('hidden');
    controller.destroy();
  });

  it('reuses one provider theme result for the icon and selected card', async () => {
    const parts = createModeParts();
    const getThemeForProvider = vi.fn().mockResolvedValue({
      accent: 'rgb(0, 174, 236)',
      accentRgb: [0, 174, 236]
    });
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        getThemeForProvider,
        getModeMenuItems: () => [{
          iconName: 'ri-bilibili-fill',
          id: 'provider:bilibili',
          kind: 'provider',
          label: 'Bilibili',
          provider: { key: 'bilibili' }
        }]
      }
    );
    controller.setPrefixText('Bilibili');
    controller.openModeMenu();
    await Promise.resolve();

    const icon = queryHtmlElement(controller.menuElement, '.x-lumno-search-input-mode__menu-icon');
    const menuItem = queryHtmlElement(controller.menuElement, '.x-lumno-search-input-mode__menu-item');
    const label = (menuItem ? queryHtmlElement(menuItem, '.x-lumno-search-input-mode__menu-label') : null);
    menuItem?.dispatchEvent(new MouseEvent('mouseenter'));
    menuItem?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

    expect(getThemeForProvider).toHaveBeenCalledTimes(1);
    expect(getThemeForProvider).toHaveBeenCalledWith({ key: 'bilibili' });
    expect(icon?.style.getPropertyValue('--x-lumno-search-mode-icon-bg')).toBe('');
    expect(icon?.style.getPropertyValue('--x-lumno-search-mode-icon-active-bg')).toBe('');
    expect(
      icon?.style.getPropertyValue('--x-lumno-search-mode-icon-color')
    ).toBe('rgb(3, 148, 203)');
    expect(
      menuItem?.style.getPropertyValue('--x-lumno-search-mode-selected-bg')
    ).toBe('rgba(0, 174, 236, 0.14)');
    const focusRingRgb = (
      menuItem?.style.getPropertyValue('--x-lumno-search-mode-item-focus-ring') || ''
    ).match(/[0-9]+/g)?.map(Number) || [];
    expect(focusRingRgb).toHaveLength(3);
    expect(getTestContrastRatio(focusRingRgb, [219, 244, 252]))
      .toBeGreaterThanOrEqual(3);
    expect(menuItem?.getAttribute('aria-label')).toBe('Bilibili');
    expect(label?.textContent).toBe('Bilibili');
    expect(label?.isConnected).toBe(true);
    expect(getThemeForProvider).toHaveBeenCalledTimes(1);
    controller.destroy();
  });

  it('keeps one glyph and no nested fallback card when a provider favicon fails', () => {
    const parts = createModeParts();
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        getModeMenuItems: () => [{
          active: true,
          iconName: 'ri-global-line',
          iconUrl: 'https://missing.example/favicon.ico',
          id: 'provider:missing',
          kind: 'provider',
          label: 'Missing',
          provider: { key: 'missing' }
        }]
      }
    );
    controller.setPrefixText('Missing');
    controller.openModeMenu();
    act(() => {
      getTags(controller.menuElement, 'img', 'img')[0].dispatchEvent(new Event('error'));
    });

    const icon = controller.menuElement.querySelector(
      '.x-lumno-search-input-mode__menu-icon'
    );
    expect(icon?.getAttribute('data-icon-state')).toBe('fallback');
    expect(icon?.querySelectorAll('i')).toHaveLength(1);
    expect(icon?.querySelector('i')?.classList.contains('ri-size-24')).toBe(true);
    expect(icon?.querySelector('img')).toBeNull();
    controller.destroy();
  });

  it('returns focus to the chip when Escape closes the menu', () => {
    const parts = createModeParts();
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        getModeMenuItems: () => [
          {
            active: true,
            id: 'all',
            kind: 'all',
            label: 'Search everything'
          }
        ]
      }
    );
    controller.setPrefixText('Search everything');
    controller.openModeMenu();
    controller.menuElement.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })
    );

    expect(controller.menuElement.hidden).toBe(true);
    expect(document.activeElement).toBe(parts.modePrefix);
    controller.destroy();
  });

  it('tells presses inside a closed shadow root from presses outside it', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadowRoot = host.attachShadow({ mode: 'closed' });
    const overlaySibling = document.createElement('button');
    const parts = createModeParts('overlay');
    shadowRoot.append(overlaySibling, parts.container);
    let selectedModeId = '';
    const controller = LumnoSearchInputMode.createInputModeController(parts, {
      surface: 'overlay',
      getModeMenuItems: () => [
        { active: true, id: 'provider:example', kind: 'provider', label: 'Example' },
        { active: false, id: 'provider:other', kind: 'provider', label: 'Other' }
      ],
      onModeMenuSelect: (item) => {
        selectedModeId = String(item.id);
      }
    });
    const press = (target: EventTarget, type: string) => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, composed: true });
      target.dispatchEvent(event);
      return event;
    };

    expect(controller.openModeMenu('none')).toBe(true);
    press(parts.modePrefix, 'pointerdown');
    press(parts.modePrefix, 'click');
    expect(controller.isModeMenuVisible()).toBe(false);
    press(parts.modePrefix, 'pointerdown');
    press(parts.modePrefix, 'click');
    expect(controller.isModeMenuVisible()).toBe(true);

    const otherButton = getElement(controller.menuElement, '[data-mode-id="provider:other"]');
    // Native pointer focus would scroll the panel's ancestors.
    expect(press(otherButton, 'pointerdown').defaultPrevented).toBe(true);
    expect(controller.isModeMenuVisible()).toBe(true);
    press(otherButton, 'click');
    expect(selectedModeId).toBe('provider:other');
    expect(shadowRoot.activeElement).toBe(parts.input);
    expect(controller.menuElement.getAttribute('data-search-active')).toBe('false');
    expect(controller.isModeMenuVisible()).toBe(true);

    press(controller.menuElement, 'pointerdown');
    expect(shadowRoot.activeElement).toBe(controller.menuElement);
    controller.menuElement.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Tab' })
    );
    expect(shadowRoot.activeElement).toBe(parts.input);

    press(overlaySibling, 'pointerdown');
    expect(controller.isModeMenuVisible()).toBe(false);
    expect(controller.openModeMenu('none')).toBe(true);
    press(document.body, 'pointerdown');
    expect(controller.isModeMenuVisible()).toBe(false);
    expect(host.isConnected).toBe(true);
    controller.destroy();
  });

  it('reorders tiles of one list by dragging and reports the new order', async () => {
    const parts = createModeParts();
    const items: ModeMenuItem[] = ['a', 'b', 'c'].map((id) => ({
      group: 'Custom', groupKey: 'custom', id, kind: 'provider', label: id.toUpperCase(), orderList: 'custom'
    }));
    items.push({ group: 'Custom', groupKey: 'custom', id: 'pinned', kind: 'provider', label: 'Pinned', orderList: 'pinned' });
    const onModeMenuReorder = vi.fn();
    const onModeMenuSelect = vi.fn();
    const controller = LumnoSearchInputMode.createInputModeController(parts, {
      getModeMenuItems: () => items,
      onModeMenuReorder,
      onModeMenuSelect
    });
    controller.openModeMenu();
    const buttons = getTags(controller.menuElement, '[role="menuitemradio"]', 'button');
    expect(buttons.map((button) => button.dataset.sortList || '')).toEqual(['custom', 'custom', 'custom', '']);
    // jsdom has no layout: the tiles sit in a row, 80px wide with 10px gaps.
    buttons.forEach((button, index) => {
      button.getBoundingClientRect = () => DOMRect.fromRect({ x: index * 90, y: 0, width: 80, height: 40 });
    });
    const pointer = (target: EventTarget, type: string, x: number) => {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: 20, button: 0 }));
    };
    pointer(buttons[0], 'pointerdown', 20);
    pointer(window, 'pointermove', 40);
    pointer(window, 'pointermove', 205);
    pointer(window, 'pointerup', 205);
    // The click that ends the drag selects nothing.
    buttons[0].click();
    expect(onModeMenuSelect).not.toHaveBeenCalled();

    // The tile glides into its slot before the drop lands.
    expect(onModeMenuReorder).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 220));
    expect(onModeMenuReorder).toHaveBeenCalledTimes(1);
    expect(onModeMenuReorder).toHaveBeenCalledWith({
      item: items[0],
      list: 'custom',
      movedItems: [items[1], items[2], items[0]],
      listItems: [items[1], items[2], items[0]]
    });
    expect(
      getTags(controller.menuElement, '[role="menuitemradio"]', 'button').map((button) => button.dataset.modeId)
    ).toEqual(['b', 'c', 'a', 'pinned']);
    controller.destroy();
  });

  it('moves whole groups from their titles', () => {
    const parts = createModeParts();
    const onModeMenuGroupMove = vi.fn();
    const controller = LumnoSearchInputMode.createInputModeController(parts, {
      getModeMenuItems: () => [
        { group: 'Engines', groupKey: 'engines', id: 'google', kind: 'provider', label: 'Google' },
        { group: 'Local', groupKey: 'local', id: 'history', kind: 'local', label: 'History' },
        { group: 'Local', groupKey: 'local', id: 'bookmarks', kind: 'local', label: 'Bookmarks' }
      ],
      onModeMenuGroupMove
    });
    controller.openModeMenu();
    const titles = getElements(controller.menuElement, '.x-lumno-search-input-mode__menu-group');
    expect(titles.map((title) => title.dataset.groupKey)).toEqual(['engines', 'local']);
    const moveButtons = titles.map((title) => getTags(title, '[data-group-move]', 'button'));
    expect(moveButtons.map((pair) => pair.map((button) => button.disabled))).toEqual([[true, false], [false, true]]);

    moveButtons[0][1].click();
    expect(onModeMenuGroupMove).toHaveBeenCalledWith({ delta: 1, group: 'engines', groups: ['engines', 'local'] });
    controller.destroy();
  });

  it('shows the glyph in the tag when the site icon fails to load', () => {
    const parts = createModeParts();
    const controller = LumnoSearchInputMode.createInputModeController(parts, {});
    controller.setPrefixText('YouTube', {}, {
      iconName: 'ri-global-line',
      iconUrl: 'https://www.youtube.com/favicon.ico',
      modeId: 'provider:youtube'
    });
    expect(parts.modePrefixIconFrame.style.display).toBe('inline-flex');
    expect(parts.modePrefixGlyph.style.display).toBe('none');

    parts.modePrefixIcon.dispatchEvent(new Event('error'));

    expect(parts.modePrefixIconFrame.style.display).toBe('none');
    expect(parts.modePrefixIcon.hasAttribute('src')).toBe(false);
    expect(parts.modePrefixGlyph.style.display).toBe('inline-flex');
    expect(parts.modePrefixGlyph.className).toContain('ri-global-line');
    controller.destroy();
  });
});
