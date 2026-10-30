import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { FakeAnimation } from '../../../tests/fakes/animation';
import { queryHtmlElement } from '../dom-lookup';
import { expectSvg } from '../../../tests/fakes/dom';
import { LumnoSearchInputMode, createModeParts, resetModeTest } from '../../../tests/fakes/search-input-mode';

afterEach(resetModeTest);

describe('Search scope tag: modes, the current label and motion', () => {
  it('enters open-tabs mode with its browser icon and no default-search ghost', () => {
    const parts = createModeParts();
    const animation = new FakeAnimation();
    const animate = vi.fn(
      (_keyframes: Keyframe[], _options?: KeyframeAnimationOptions) =>
        animation
    );
    Object.defineProperty(parts.modePrefix, 'animate', {
      configurable: true,
      value: animate
    });
    const iconAnimation = new FakeAnimation();
    const animateIcon = vi.fn(
      (_keyframes: Keyframe[], _options?: KeyframeAnimationOptions) =>
        iconAnimation
    );
    const controller = LumnoSearchInputMode.createInputModeController(parts);
    const lineIcon = expectSvg(parts.modePrefix.querySelector('[data-search-input-mode-line-icon]'), 'line icon');
    Object.defineProperty(lineIcon, 'animate', {
      configurable: true,
      value: animateIcon
    });

    controller.setPrefixText('Search open tabs', {}, {
      animate: true,
      iconName: 'ri-window-line',
      menuIconName: 'browser',
      modeId: 'openTabs'
    });

    expect(animate).toHaveBeenCalledWith([
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
    animation.emitFinish();
    expect(lineIcon.style.display).toBe('inline-flex');
    expect(parts.modePrefixGlyph.style.display).toBe('none');
    expect(animateIcon).toHaveBeenCalledWith([
      { opacity: 0.45, offset: 0, transform: 'scale(0.84)' },
      {
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: 1,
        offset: 0.62,
        transform: 'scale(1.05)'
      },
      {
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        opacity: 1,
        offset: 0.84,
        transform: 'scale(0.99)'
      },
      { opacity: 1, offset: 1, transform: 'scale(1)' }
    ], {
      duration: 180,
      easing: 'linear'
    });
    expect(
      parts.modePrefix.querySelector('[data-search-input-mode-icon-ghost]')
    ).toBeNull();
    expect(parts.modePrefix.style.opacity).toBe('1');
    expect(parts.modePrefix.style.transform).toBe(
      'translateY(-50%) translateX(0) scaleX(1)'
    );
    expect(parts.modePrefix.style.willChange).toBe('auto');
    controller.destroy();
  });

  it('expands the current label in normal flow so it continuously pushes the chevron aside', () => {
    const parts = createModeParts();
    const animationStartStates: Array<Record<string, string | undefined>> = [];
    const measurementStates: Array<Record<string, string | undefined>> = [];
    const resizeAnimations = [0, 1].map(() => new FakeAnimation());
    const animateCurrent = vi.fn(
      (_keyframes: Keyframe[], _options?: KeyframeAnimationOptions) => {
        animationStartStates.push({ ...parts.modePrefix.dataset });
        return resizeAnimations[animateCurrent.mock.calls.length - 1];
      }
    );
    Object.defineProperty(parts.modePrefixCurrent, 'animate', {
      configurable: true,
      value: animateCurrent
    });
    Object.defineProperty(parts.modePrefixCurrent, 'getBoundingClientRect', {
      configurable: true,
      value: () => {
        if (parts.modePrefix.dataset.currentMeasuring === 'true') {
          measurementStates.push({ ...parts.modePrefix.dataset });
        }
        const visible = parts.modePrefix.dataset.currentMeasuring === 'true' ||
          parts.modePrefix.dataset.currentVisible === 'true';
        const inlineWidth = Number.parseFloat(parts.modePrefixCurrent.style.width);
        const width = visible
          ? (Number.isFinite(inlineWidth) ? inlineWidth : 24)
          : 0;
        return {
          bottom: 0,
          height: 26,
          left: 0,
          right: width,
          toJSON: () => ({}),
          top: 0,
          width,
          x: 0,
          y: 0
        };
      }
    });
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
    controller.setPrefixText('Google', {}, {
      iconName: 'ri-google-fill',
      modeId: 'provider:google'
    });

    expect(parts.modePrefixCurrent.textContent).toBe('当前');
    expect(parts.modePrefixCurrent.style.display).toBe('none');
    expect(parts.modePrefix.dataset.currentMeasuring).toBe('false');
    expect(controller.openModeMenu('none')).toBe(true);
    expect(parts.modePrefixCurrent.style.display).toBe('inline-flex');
    expect(parts.modePrefix.dataset.currentVisible).toBe('true');
    expect(parts.modePrefix.dataset.currentMeasuring).toBe('false');
    expect(parts.modePrefixCurrent.style.position).toBe('');
    expect(parts.modePrefixCurrent.style.left).toBe('');
    expect(Array.from(parts.modePrefix.children).indexOf(parts.modePrefixCurrent)).toBeLessThan(
      Array.from(parts.modePrefix.children).indexOf(parts.modePrefixChevron)
    );
    expect(measurementStates.length).toBeGreaterThan(0);
    expect(measurementStates.every((state) => (
      state.currentVisible === 'false' && state.currentMeasuring === 'true'
    ))).toBe(true);
    expect(animationStartStates[0]).toMatchObject({
      currentMeasuring: 'false',
      currentVisible: 'true'
    });
    expect(animateCurrent.mock.calls[0][0]).toEqual([
      { marginLeft: '-6px', width: '0px' },
      { marginLeft: '0px', width: '24px' }
    ]);
    expect(animateCurrent.mock.calls[0][1]).toEqual({
      duration: 140,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
    });
    controller.setPrefixText('Google', { accent: '#2563eb' }, {
      iconName: 'ri-google-fill',
      modeId: 'provider:google'
    });
    expect(parts.modePrefixCurrent.style.position).toBe('');
    expect(parts.modePrefixCurrent.style.left).toBe('');
    resizeAnimations[0].emitFinish();
    expect(parts.modePrefixCurrent.style.display).toBe('inline-flex');
    expect(parts.modePrefix.dataset.currentVisible).toBe('true');
    expect(parts.modePrefixCurrent.style.width).toBe('');
    expect(parts.modePrefixCurrent.style.marginLeft).toBe('');
    expect(
      parts.modePrefixCurrent.querySelector(
        '[data-search-input-mode-current-text]'
      )?.textContent
    ).toBe('当前');

    expect(controller.closeModeMenu(false)).toBe(true);
    expect(parts.modePrefixCurrent.style.display).toBe('inline-flex');
    expect(parts.modePrefix.dataset.currentVisible).toBe('true');
    expect(animateCurrent.mock.calls[1][0]).toEqual([
      { marginLeft: '0px', width: '24px' },
      { marginLeft: '-6px', width: '0px' }
    ]);
    resizeAnimations[1].emitFinish();
    expect(parts.modePrefixCurrent.style.display).toBe('none');
    expect(parts.modePrefix.dataset.currentVisible).toBe('false');
    controller.destroy();
  });

  it('continues a reversed current-slot resize from its in-flight geometry and ignores stale completion', () => {
    const parts = createModeParts();
    let inFlightWidth = 0;
    let inFlightMarginLeft = -6;
    const resizeAnimations = [0, 1].map(() => new FakeAnimation());
    const animateCurrent = vi.fn(
      (_keyframes: Keyframe[], _options?: KeyframeAnimationOptions) =>
        resizeAnimations[animateCurrent.mock.calls.length - 1]
    );
    Object.defineProperty(parts.modePrefixCurrent, 'animate', {
      configurable: true,
      value: animateCurrent
    });
    Object.defineProperty(parts.modePrefixCurrent, 'getBoundingClientRect', {
      configurable: true,
      value: () => {
        const width = parts.modePrefix.dataset.currentMeasuring === 'true'
          ? 24
          : (parts.modePrefix.dataset.currentVisible === 'true' ? inFlightWidth : 0);
        return {
          bottom: 26,
          height: 26,
          left: 0,
          right: width,
          toJSON: () => ({}),
          top: 0,
          width,
          x: 0,
          y: 0
        };
      }
    });
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      if (element === parts.modePrefixCurrent) {
        const marginLeft = parts.modePrefix.dataset.currentMeasuring === 'true'
          ? 0
          : inFlightMarginLeft;
        const style = document.createElement('div').style;
        style.marginLeft = `${marginLeft}px`;
        return style;
      }
      return originalGetComputedStyle(element);
    });
    const controller = LumnoSearchInputMode.createInputModeController(parts, {
      getModeMenuItems: () => [{
        active: true,
        id: 'provider:google',
        kind: 'provider',
        label: 'Google'
      }]
    });
    controller.setPrefixText('Google', {}, { modeId: 'provider:google' });

    expect(controller.openModeMenu('none')).toBe(true);
    expect(animateCurrent.mock.calls[0][0]).toEqual([
      { marginLeft: '-6px', width: '0px' },
      { marginLeft: '0px', width: '24px' }
    ]);

    inFlightWidth = 14;
    inFlightMarginLeft = -2;
    expect(controller.closeModeMenu(false)).toBe(true);
    expect(resizeAnimations[0].cancel).toHaveBeenCalledTimes(1);
    expect(animateCurrent.mock.calls[1][0]).toEqual([
      { marginLeft: '-2px', width: '14px' },
      { marginLeft: '-6px', width: '0px' }
    ]);

    resizeAnimations[0].emitFinish();
    expect(parts.modePrefix.dataset.currentVisible).toBe('true');
    expect(parts.modePrefixCurrent.style.willChange).toBe('width');

    resizeAnimations[1].emitFinish();
    expect(parts.modePrefix.dataset.currentVisible).toBe('false');
    expect(parts.modePrefixCurrent.style.width).toBe('');
    expect(parts.modePrefixCurrent.style.marginLeft).toBe('');
    expect(parts.modePrefixCurrent.style.willChange).toBe('auto');
    vi.restoreAllMocks();
    controller.destroy();
  });

  it('keeps the overlay current label clipped by its own in-flow slot before CSS loads', () => {
    const parts = createModeParts('overlay');
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      { surface: 'overlay' }
    );
    const currentText = queryHtmlElement(parts.modePrefixCurrent, '[data-search-input-mode-current-text]');
    controller.setPrefixText('Google', {}, { modeId: 'provider:google' });

    expect(currentText?.style.display).toBe('inline-block');
    expect(currentText?.style.clipPath).toBe('');
    expect(parts.modePrefixCurrent.style.overflow).toBe('hidden');
    expect(parts.modePrefixCurrent.style.position).toBe('');
    expect(parts.modePrefix.hasAttribute('data-current-overlay')).toBe(false);
    controller.destroy();
  });

  it('does not animate when the already-selected mode is selected again', () => {
    const parts = createModeParts();
    const animate = vi.fn();
    Object.defineProperty(parts.modePrefix, 'animate', {
      configurable: true,
      value: animate
    });
    const controller = LumnoSearchInputMode.createInputModeController(parts);
    controller.setPrefixText('Brave Search', {}, {
      iconName: 'ri-global-line',
      modeId: 'provider:brave'
    });

    controller.setPrefixText('Brave Search', {}, {
      animate: true,
      iconName: 'ri-global-line',
      modeId: 'provider:brave'
    });

    expect(animate).not.toHaveBeenCalled();
    expect(parts.modePrefixText.textContent).toBe('Brave Search');
    expect(parts.modePrefix.getAttribute('data-mode-id')).toBe('provider:brave');
    expect(parts.modePrefix.style.willChange).toBe('auto');
    controller.destroy();
  });

  it('stretches on a curve before elastically swapping the scope icon', () => {
    const parts = createModeParts();
    const resizeAnimation = new FakeAnimation();
    const animate = vi.fn(
      (_keyframes: Keyframe[], _options?: KeyframeAnimationOptions) =>
        resizeAnimation
    );
    Object.defineProperty(parts.modePrefix, 'animate', {
      configurable: true,
      value: animate
    });
    const iconAnimation = new FakeAnimation();
    const animateIcon = vi.fn(
      (_keyframes: Keyframe[], _options?: KeyframeAnimationOptions) =>
        iconAnimation
    );
    Object.defineProperty(parts.modePrefixGlyph, 'animate', {
      configurable: true,
      value: animateIcon
    });
    const outgoingIconAnimation = new FakeAnimation();
    const animateOutgoingIcon = vi.fn(
      (_keyframes: Keyframe[], _options?: KeyframeAnimationOptions) =>
        outgoingIconAnimation
    );
    // jsdom has no Web Animations; the fading copy of the old icon, which
    // the view draws during the swap, takes this stand-in.
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: animateOutgoingIcon
    });
    onTestFinished(() => {
      Reflect.deleteProperty(HTMLElement.prototype, 'animate');
    });
    Object.defineProperty(parts.modePrefix, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        bottom: 0,
        height: 26,
        left: 0,
        right: parts.modePrefixText.textContent === 'Brave Search' ? 176 : 132,
        toJSON: () => ({}),
        top: 0,
        width: parts.modePrefixText.textContent === 'Brave Search' ? 176 : 132,
        x: 0,
        y: 0
      })
    });
    const controller = LumnoSearchInputMode.createInputModeController(parts);
    controller.setPrefixText('Open tabs', {}, {
      iconName: 'ri-window-line',
      modeId: 'openTabs'
    });

    controller.setPrefixText('Brave Search', {}, {
      animate: true,
      iconName: 'ri-global-line',
      modeId: 'provider:brave'
    });

    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.calls[0][0]).toEqual([
      { width: '132px' },
      { width: '176px' }
    ]);
    expect(animate.mock.calls[0][1]).toEqual({
      duration: 140,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
    });
    expect(
      animate.mock.calls[0][0].every((frame) =>
        !('opacity' in frame) && !('transform' in frame)
      )
    ).toBe(true);
    expect(parts.modePrefixText.textContent).toBe('Open tabs');
    expect(parts.modePrefixGlyph.className).toContain('ri-window-line');
    expect(animateIcon).not.toHaveBeenCalled();
    expect(parts.modePrefixGlyph.style.transition).toBe('none');
    expect(parts.modePrefix.style.transition).toContain('background-color 140ms ease');
    expect(parts.modePrefixCurrent.textContent).toBe('当前');
    expect(parts.modePrefix.style.willChange).toBe('width');
    resizeAnimation.emitFinish();
    expect(parts.modePrefixText.textContent).toBe('Brave Search');
    expect(parts.modePrefixGlyph.className).toContain('ri-global-line');
    expect(animateIcon).toHaveBeenCalledWith([
      { opacity: 0.45, offset: 0, transform: 'scale(0.84)' },
      {
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: 1,
        offset: 0.62,
        transform: 'scale(1.05)'
      },
      {
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        opacity: 1,
        offset: 0.84,
        transform: 'scale(0.99)'
      },
      { opacity: 1, offset: 1, transform: 'scale(1)' }
    ], {
      duration: 180,
      easing: 'linear'
    });
    expect(animateOutgoingIcon).toHaveBeenCalledWith([
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 0, transform: 'scale(0.84)' }
    ], {
      duration: 100,
      easing: 'cubic-bezier(0.4, 0, 1, 1)'
    });
    const ghost = parts.modePrefix.querySelector('[data-search-input-mode-icon-ghost]');
    expect(ghost?.className).toContain('ri-window-line');
    expect(parts.modePrefixGlyph.style.transform).toBe('none');
    expect(parts.modePrefix.style.willChange).toBe('auto');
    outgoingIconAnimation.emitFinish();
    expect(parts.modePrefix.querySelector('[data-search-input-mode-icon-ghost]')).toBeNull();
    controller.destroy();
  });

  it('keeps the direct width animation when an existing mode becomes shorter', () => {
    const parts = createModeParts();
    const resizeAnimation = new FakeAnimation();
    const animate = vi.fn(
      (_keyframes: Keyframe[], _options?: KeyframeAnimationOptions) =>
        resizeAnimation
    );
    Object.defineProperty(parts.modePrefix, 'animate', {
      configurable: true,
      value: animate
    });
    const animateIcon = vi.fn(() => new FakeAnimation());
    Object.defineProperty(parts.modePrefixGlyph, 'animate', {
      configurable: true,
      value: animateIcon
    });
    Object.defineProperty(parts.modePrefix, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        bottom: 0,
        height: 26,
        left: 0,
        right: parts.modePrefixText.textContent === 'Brave Search' ? 176 : 132,
        toJSON: () => ({}),
        top: 0,
        width: parts.modePrefixText.textContent === 'Brave Search' ? 176 : 132,
        x: 0,
        y: 0
      })
    });
    const controller = LumnoSearchInputMode.createInputModeController(parts);
    controller.setPrefixText('Brave Search', {}, {
      iconName: 'ri-global-line',
      modeId: 'provider:brave'
    });

    controller.setPrefixText('Open tabs', {}, {
      animate: true,
      iconName: 'ri-window-line',
      modeId: 'openTabs'
    });

    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.calls[0][0]).toEqual([
      { width: '176px' },
      { width: '132px' }
    ]);
    expect(parts.modePrefixText.textContent).toBe('Open tabs');
    expect(parts.modePrefixGlyph.className).toContain('ri-window-line');
    expect(animateIcon).toHaveBeenCalledTimes(1);
    expect(
      animate.mock.calls[0][0].every((frame) =>
        !('opacity' in frame) && !('transform' in frame)
      )
    ).toBe(true);
    expect(parts.modePrefix.style.willChange).toBe('width');
    resizeAnimation.emitFinish();
    expect(parts.modePrefix.style.willChange).toBe('auto');
    controller.destroy();
  });
});
