import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModeMenuItem } from '../search/input-mode/types';
import { FakeAnimation } from '../../../tests/fakes/animation';
import { queryHtmlElement, queryHtmlTag } from '../dom-lookup';
import { expectSvg, getElements, getSvgs } from '../../../tests/fakes/dom';
import { LumnoSearchInputMode, createModeParts, getTestContrastRatio, resetModeTest } from '../../../tests/fakes/search-input-mode';

afterEach(resetModeTest);

describe('Search scope menu: glyphs, themes and the chip', () => {
  it('reuses lighter vector glyphs in browser-content cards and the active tag', () => {
    const parts = createModeParts();
    const iconNames = ['browser', 'star', 'bookmark', 'history'];
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        getModeMenuItems: () => iconNames.map((menuIconName) => ({
          group: 'Browser content',
          iconName: 'ri-window-line',
          id: `local:${menuIconName}`,
          kind: 'local',
          label: menuIconName,
          menuIconName
        }))
      }
    );

    controller.setPrefixText('Open tabs', {}, {
      iconName: 'ri-window-line',
      menuIconName: 'browser',
      modeId: 'openTabs'
    });
    controller.openModeMenu();

    const menuGlyphs = getSvgs(controller.menuElement, '.x-lumno-search-input-mode__menu-line-icon');
    expect(menuGlyphs.map((glyph) => glyph.dataset.iconName)).toEqual(iconNames);
    expect(
      menuGlyphs.every((glyph) => (
        glyph.getAttribute('stroke-width') === '1.65' &&
        glyph.getAttribute('viewBox') === '0 0 24 24'
      ))
    ).toBe(true);
    expect(
      controller.menuElement.querySelectorAll(
        '.x-lumno-search-input-mode__menu-favicon-mask > i'
      )
    ).toHaveLength(0);
    const builtInCards = Array.from(
      getElements(controller.menuElement, '.x-lumno-search-input-mode__menu-icon[data-icon-kind="builtin"]')
    );
    const builtInItems = Array.from(
      getElements(controller.menuElement, '.x-lumno-search-input-mode__menu-item')
    );
    expect(builtInCards).toHaveLength(4);
    expect(
      builtInCards.every((card) => (
        card.style.getPropertyValue('--x-lumno-search-mode-icon-bg') === '' &&
        card.style.getPropertyValue('--x-lumno-search-mode-icon-active-bg') === '' &&
        card.style.getPropertyValue('--x-lumno-search-mode-icon-color') ===
          'var(--x-nt-text, #111827)'
      ))
    ).toBe(true);
    expect(
      builtInItems.every((item) => (
        item.style.getPropertyValue('--x-lumno-search-mode-selected-bg').includes(
          'var(--x-nt-text, #111827) 11%'
        )
      ))
    ).toBe(true);
    const prefixGlyph = expectSvg(parts.modePrefix.querySelector('[data-search-input-mode-line-icon]'), 'prefix glyph');
    expect(prefixGlyph?.dataset.iconName).toBe('browser');
    expect(prefixGlyph?.getAttribute('stroke-width')).toBe('2');
    expect(prefixGlyph?.style.display).toBe('inline-flex');
    expect(parts.modePrefixGlyph.style.display).toBe('none');
    expect(parts.modePrefix.style.background).toContain(
      'var(--x-nt-text, #111827) 9%'
    );
    controller.destroy();
  });

  it('reserves the stronger overlay theme surface for selected built-in cards', () => {
    const parts = createModeParts('overlay');
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        getModeMenuItems: () => [{
          group: 'Browser content',
          id: 'openTabs',
          kind: 'openTabs',
          label: 'Open tabs',
          menuIconName: 'browser'
        }],
        isDarkMode: () => true,
        surface: 'overlay'
      }
    );

    controller.setPrefixText('Open tabs', {}, { menuIconName: 'browser' });
    controller.openModeMenu();

    const card = queryHtmlElement(controller.menuElement, '.x-lumno-search-input-mode__menu-icon[data-icon-kind="builtin"]');
    const menuItem = queryHtmlElement(controller.menuElement, '.x-lumno-search-input-mode__menu-item');
    expect(card?.style.getPropertyValue('--x-lumno-search-mode-icon-bg')).toBe('');
    expect(card?.style.getPropertyValue('--x-lumno-search-mode-icon-active-bg')).toBe('');
    expect(card?.style.getPropertyValue('--x-lumno-search-mode-icon-color')).toBe(
      'var(--x-ov-text, #111827)'
    );
    expect(
      menuItem?.style.getPropertyValue('--x-lumno-search-mode-selected-bg')
    ).toContain('var(--x-ov-text, #111827) 16%');
    expect(
      menuItem?.style.getPropertyValue('--x-lumno-search-mode-item-focus-ring')
    ).toBe('var(--x-ov-text, #111827)');
    expect(parts.modePrefix.style.background).toContain(
      'var(--x-ov-text, #111827) 14%'
    );
    expect(
      parts.modePrefix.querySelector('[data-search-input-mode-line-icon]')
        ?.getAttribute('data-icon-name')
    ).toBe('browser');
    controller.destroy();
  });

  it('keeps the built-in tag SVG when an earlier provider favicon fails late', () => {
    const parts = createModeParts();
    const controller = LumnoSearchInputMode.createInputModeController(parts, {});

    controller.setPrefixText('YouTube', {}, {
      iconName: 'ri-global-line',
      iconUrl: 'https://www.youtube.com/favicon.ico',
      modeId: 'provider:youtube'
    });
    controller.setPrefixText('Bookmarks', {}, {
      menuIconName: 'bookmark',
      modeId: 'local:bookmark'
    });
    parts.modePrefixIcon.dispatchEvent(new Event('error'));

    const prefixGlyph = expectSvg(parts.modePrefix.querySelector('[data-search-input-mode-line-icon]'), 'prefix glyph');
    expect(prefixGlyph?.dataset.iconName).toBe('bookmark');
    expect(prefixGlyph?.style.display).toBe('inline-flex');
    expect(parts.modePrefixGlyph.style.display).toBe('none');
    expect(parts.modePrefixIcon.style.display).toBe('none');
    controller.destroy();
  });

  it('enforces Overlay keyboard and pointer selection focus targets', async () => {
    const parts = createModeParts('overlay');
    const shadowHost = document.createElement('div');
    const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
    document.body.appendChild(shadowHost);
    shadowRoot.appendChild(parts.container);
    const duckduckgoItem: ModeMenuItem = {
      group: 'Search engines',
      iconName: 'ri-global-line',
      id: 'provider:ddg',
      kind: 'provider',
      label: 'DuckDuckGo',
      provider: { key: 'ddg', name: 'DuckDuckGo' }
    };
    const onModeMenuSelect = vi.fn();
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        getModeMenuItems: () => [duckduckgoItem],
        onModeMenuSelect,
        surface: 'overlay'
      }
    );
    controller.setPrefixText('Search open tabs', {}, {
      iconName: 'ri-window-line',
      modeId: 'openTabs'
    });
    controller.openModeMenu();
    const menuItem = queryHtmlTag(controller.menuElement, '[role="menuitemradio"]', 'button');
    expect(menuItem).not.toBeNull();

    const enterEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Enter'
    });
    menuItem?.dispatchEvent(enterEvent);
    await Promise.resolve();
    expect(enterEvent.defaultPrevented).toBe(true);
    expect(shadowRoot.activeElement).toBe(menuItem);
    expect(controller.menuElement.dataset.searchActive).toBe('true');

    menuItem?.dispatchEvent(
      new Event('pointerdown', { bubbles: true, composed: true })
    );

    expect(controller.menuElement.hidden).toBe(false);
    menuItem?.click();
    await Promise.resolve();
    expect(onModeMenuSelect).toHaveBeenCalledWith(duckduckgoItem);
    expect(controller.menuElement.hidden).toBe(false);
    expect(parts.modePrefix.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(shadowHost);
    expect(shadowRoot.activeElement).toBe(parts.input);
    expect(controller.menuElement.dataset.searchActive).toBe('false');
    controller.destroy();
  });

  it('uses a contrast-safe themed label on a taller borderless chip', () => {
    const parts = createModeParts();
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        defaultAccentColor: [0, 174, 236]
      }
    );

    controller.setPrefixText('Bilibili', { accentRgb: [0, 174, 236] }, {
      iconName: 'ri-global-line',
      modeId: 'provider:bilibili'
    });

    expect(parts.modePrefixChevron.classList.contains('ri-arrow-down-s-line')).toBe(
      true
    );
    expect(parts.modePrefixChevron.style.color).toBe('rgb(5, 121, 169)');
    expect(parts.modePrefixChevron.style.opacity).toBe('');
    expect(
      parts.container.style.getPropertyValue('--x-lumno-search-mode-accent')
    ).toBe('rgb(5, 121, 169)');
    expect(
      parts.container.style.getPropertyValue('--x-lumno-search-mode-selected-bg')
    ).toBe('rgba(0, 174, 236, 0.075)');
    expect(parts.modePrefix.style.color).toBe('rgb(5, 121, 169)');
    expect(parts.modePrefix.style.height).toBe('32px');
    expect(parts.modePrefix.style.padding).toBe('0px 6px');
    expect(parts.modePrefix.style.borderStyle).toBe('none');
    expect(parts.modePrefix.style.boxShadow).toBe('none');
    expect(getTestContrastRatio(
      [5, 121, 169],
      [0, 174, 236].map((channel) => Math.round(
        (channel * 0.075) + (255 * 0.925)
      ))
    )).toBeGreaterThanOrEqual(4.5);
    expect(parts.modePrefixCurrent.textContent).toBe('当前');
    expect(parts.modePrefix.style.justifyContent).toBe('flex-start');
    expect(parts.modePrefixText.style.display).toBe('block');
    expect(parts.modePrefixText.style.flex).toBe('0 1 auto');
    expect(parts.modePrefixText.style.lineHeight).toBe('18px');
    expect(parts.modePrefixCurrent.style.fontSize).toBe('13px');
    expect(parts.modePrefixCurrent.style.lineHeight).toBe('18px');
    expect(parts.modePrefixCurrent.style.display).toBe('none');
    expect(parts.modePrefixCurrent.style.overflow).toBe('hidden');
    expect(parts.modePrefixCurrent.style.flex).toBe('0 0 auto');
    expect(parts.modePrefixChevron.style.flex).toBe('0 0 auto');
    expect(parts.modePrefix.getAttribute('data-menu-open')).toBe('false');
    expect(parts.modePrefixCurrent.style.background).toBe('');
    controller.destroy();
  });

  it('drives current text and the chevron from one state while repeated clicks toggle the menu', () => {
    const parts = createModeParts();
    const prefixAnimation = new FakeAnimation();
    const animatePrefix = vi.fn(
      (_keyframes: Keyframe[], _options?: KeyframeAnimationOptions) =>
        prefixAnimation
    );
    Object.defineProperty(parts.modePrefix, 'animate', {
      configurable: true,
      value: animatePrefix
    });
    const controller = LumnoSearchInputMode.createInputModeController(parts, {
      getModeMenuItems: () => [{
        active: true,
        id: 'provider:youtube',
        kind: 'provider',
        label: 'YouTube'
      }]
    });

    controller.setPrefixText('YouTube', {}, {
      animate: true,
      modeId: 'provider:youtube'
    });

    expect(animatePrefix).toHaveBeenCalledWith([
      {
        opacity: 0.4,
        transform: 'translateY(-50%) translateX(-4px) scaleX(0.92)'
      },
      {
        opacity: 1,
        transform: 'translateY(-50%) translateX(0) scaleX(1)'
      }
    ], {
      duration: 180,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
    });
    prefixAnimation.emitFinish();
    animatePrefix.mockClear();
    expect(parts.modePrefixCurrent.textContent).toBe('当前');
    expect(parts.modePrefixCurrent.style.opacity).toBe('');
    expect(parts.modePrefix.getAttribute('data-menu-open')).toBe('false');

    parts.modePrefix.focus();
    parts.modePrefix.click();

    expect(controller.menuElement.hidden).toBe(false);
    expect(document.activeElement).toBe(controller.menuElement);
    expect(parts.modePrefix.style.zIndex).toBe('41');
    expect(parts.modePrefix.getAttribute('data-menu-open')).toBe('true');

    controller.setPrefixText('YouTube', { accentRgb: [255, 0, 0] }, {
      modeId: 'provider:youtube'
    });

    expect(prefixAnimation.cancel).not.toHaveBeenCalled();
    expect(parts.modePrefix.getAttribute('data-menu-open')).toBe('true');
    expect(parts.modePrefixCurrent.style.opacity).toBe('');

    parts.modePrefix.click();

    expect(controller.menuElement.hidden).toBe(true);
    expect(document.activeElement).toBe(parts.modePrefix);
    expect(parts.modePrefix.style.zIndex).toBe('1');
    expect(parts.modePrefix.getAttribute('data-menu-open')).toBe('false');
    expect(parts.modePrefixCurrent.style.opacity).toBe('');
    controller.destroy();
  });

  it('cancels a pending asynchronous open when the chip is clicked again', async () => {
    const parts = createModeParts();
    let resolveItems: ((items: ModeMenuItem[]) => void) | undefined;
    const itemsPromise = new Promise<ModeMenuItem[]>((resolve) => {
      resolveItems = resolve;
    });
    const controller = LumnoSearchInputMode.createInputModeController(parts, {
      getModeMenuItems: () => itemsPromise
    });
    controller.setPrefixText('YouTube');

    parts.modePrefix.click();
    expect(controller.menuElement.getAttribute('aria-busy')).toBe('true');

    parts.modePrefix.click();
    expect(controller.menuElement.hidden).toBe(true);
    expect(controller.menuElement.hasAttribute('aria-busy')).toBe(false);
    expect(parts.modePrefix.getAttribute('aria-expanded')).toBe('false');
    expect(parts.modePrefix.getAttribute('data-menu-open')).toBe('false');

    resolveItems?.([{
      active: true,
      id: 'provider:youtube',
      kind: 'provider',
      label: 'YouTube'
    }]);
    await itemsPromise;
    await Promise.resolve();

    expect(controller.menuElement.hidden).toBe(true);
    expect(parts.modePrefix.getAttribute('aria-expanded')).toBe('false');
    controller.destroy();
  });

  it('keeps the chip shadow unchanged when it receives focus', () => {
    const parts = createModeParts();
    const controller = LumnoSearchInputMode.createInputModeController(parts);
    controller.setPrefixText('YouTube', { accentRgb: [255, 0, 0] });
    const restingShadow = parts.modePrefix.style.boxShadow;

    parts.modePrefix.focus();

    expect(parts.modePrefix.style.boxShadow).toBe(restingShadow);
    expect(parts.modePrefix.style.boxShadow).not.toContain('0 0 0 3px');
    controller.destroy();
  });
});
