import { act } from 'react';
import { createViewStore } from '../../shared/react/view-store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTopContentController,
  type TopContentState,
  type TopContentClockFont,
  type TopContentController,
  type WordmarkAppearance
} from './wordmark';
import { getElement, getElements } from '../../../tests/fakes/dom';
import { queryHtmlElement } from '../../shared/dom-lookup';

let controllers: TopContentController[] = [];

const APPEARANCE: WordmarkAppearance = {
  imageSrc: '/wordmark.svg',
  imageOpacity: 0.82,
  solidOpacity: 0,
  solidFill: 'rgb(31 41 55)'
};

function createController(
  animateEntry = true,
  mode: 'brand' | 'time' = 'brand',
  showSeconds = false,
  fontWeight?: number,
  font?: TopContentClockFont
) {
  const host = document.createElement('div');
  const onActivate = vi.fn();
  const onEntryAnimationComplete = vi.fn();
  document.body.appendChild(host);
  const store = createViewStore<TopContentState>({ model: null });
  const controller = createTopContentController(host, {
    onActivate,
    onEntryAnimationComplete
  }, store);
  controllers.push(controller);
  act(() => {
    store.setState({ model: {
      animateEntry,
      ariaLabel: 'Lumno Chrome Web Store',
      appearance: APPEARANCE,
      locale: 'zh-CN',
      mode,
      showSeconds,
      fontWeight,
      font
    } });
  });
  return { controller, host, onActivate, onEntryAnimationComplete, store };
}

afterEach(() => {
  act(() => controllers.forEach((controller) => controller.destroy()));
  controllers = [];
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('New Tab top-content React island', () => {
  it('owns the existing wordmark host and visual elements', () => {
    const { controller, host } = createController();

    expect(host.id).toBe('_x_extension_newtab_wordmark_2026_unique_');
    expect(host.dataset.reactIsland).toBe('newtab-wordmark');
    expect(host.dataset.enter).toBe('run');
    expect(controller.getButton()?.getAttribute('aria-label')).toBe(
      'Lumno Chrome Web Store'
    );
    expect(controller.getImage()?.getAttribute('src')).toBe('/wordmark.svg');
    expect(controller.getImage()?.getAttribute('width')).toBe('112');
    expect(controller.getImage()?.getAttribute('height')).toBe('25.1557');
    expect(controller.getImage()?.style.opacity).toBe('0.82');
    expect(getElement(host, '.x-nt-wordmark-solid').style.opacity).toBe('0');
  });

  it('takes a new appearance without replaying its entry motion', () => {
    const { controller, host, store } = createController(true);
    const { model } = store.getSnapshot();
    act(() => store.setState({ model: model && { ...model, appearance: {
      imageSrc: '/wordmark-dark.svg',
      imageOpacity: 0,
      solidOpacity: 0.6,
      solidFill: 'rgb(238 240 242)'
    } } }));

    expect(host.dataset.enter).toBe('run');
    expect(controller.getImage()?.getAttribute('src')).toBe('/wordmark-dark.svg');
    expect(controller.getImage()?.style.opacity).toBe('0');
    expect(getElement(host, '.x-nt-wordmark-solid').style.opacity).toBe('0.6');
    expect(controller.getButton()?.style.getPropertyValue('--x-nt-wordmark-solid-fill')).toBe('rgb(238 240 242)');
  });

  it('preserves foreground and background navigation dispositions', () => {
    const { controller, onActivate } = createController();
    const button = controller.getButton();

    act(() => button?.click());
    act(() => {
      button?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, ctrlKey: true })
      );
    });
    act(() => {
      button?.dispatchEvent(
        new MouseEvent('auxclick', { bubbles: true, button: 1 })
      );
    });

    expect(onActivate.mock.calls).toEqual([
      ['newTab'],
      ['backgroundTab'],
      ['backgroundTab']
    ]);
  });

  it('renders a single-line animated hour and minute clock by default', () => {
    const { controller, host } = createController(true, 'time');
    const clock = queryHtmlElement(host, 'time.x-nt-time-mark');

    expect(controller.getContent()).toBe(clock);
    expect(clock?.getAttribute('datetime')).toMatch(/^\d{2}:\d{2}$/);
    expect(clock?.dataset.showSeconds).toBe('false');
    expect(clock?.style.display).toBe('inline-flex');
    expect(clock?.style.fontFamily).toContain('Open Sans');
    expect(clock?.style.fontWeight).toBe('320');
    expect(clock?.style.letterSpacing).toBe('-0.055em');
    expect(clock?.querySelectorAll('number-flow-react')).toHaveLength(2);
    expect(clock?.querySelector('br')).toBeNull();
    expect(controller.getButton()).toBeNull();
    expect(controller.getImage()).toBeNull();
    expect(host.querySelector('.x-nt-wordmark-solid')).toBeNull();
  });

  it('applies a custom variable-font weight to the clock', () => {
    const { host } = createController(true, 'time', false, 650);
    const clock = queryHtmlElement(host, 'time.x-nt-time-mark');

    expect(clock?.style.fontWeight).toBe('650');
    expect(clock?.style.letterSpacing).toBe('-0.043em');
  });

  it('draws the clock in the chosen face with its own tracking and colon placement', () => {
    const { host } = createController(true, 'time', false, 480, {
      colonGap: -0.08,
      colonShift: 0,
      family: '"Lumno Clock Bitcount", "Open Sans", monospace',
      id: 'bitcount',
      stretch: '',
      tracking: 0
    });
    const clock = queryHtmlElement(host, 'time.x-nt-time-mark');

    expect(clock?.dataset.timeFont).toBe('bitcount');
    expect(clock?.style.fontFamily).toContain('Lumno Clock Bitcount');
    expect(clock?.style.fontStretch).toBe('normal');
    expect(clock?.style.fontWeight).toBe('480');
    expect(clock?.style.letterSpacing).toBe('0em');
    expect(clock?.style.getPropertyValue('--x-nt-clock-colon-gap')).toBe('-0.08em');
    expect(clock?.style.getPropertyValue('--x-nt-clock-colon-shift')).toBe('0em');
  });

  it("keeps Open Sans's weight-based tracking when the face has none of its own", () => {
    const { host } = createController(true, 'time', false, 650, {
      colonGap: 0.055,
      colonShift: -0.035,
      family: '"Open Sans", sans-serif',
      id: 'open-sans',
      stretch: '86%',
      tracking: null
    });
    const clock = queryHtmlElement(host, 'time.x-nt-time-mark');

    expect(clock?.style.fontStretch).toBe('86%');
    expect(clock?.style.letterSpacing).toBe('-0.043em');
  });

  it('widens clock letter spacing in restrained 100-weight steps', () => {
    const cases: Array<[number, string]> = [
      [399, '-0.055em'],
      [400, '-0.051em'],
      [500, '-0.047em'],
      [699, '-0.043em'],
      [700, '-0.039em'],
      [800, '-0.035em']
    ];

    cases.forEach(([fontWeight, expectedLetterSpacing]) => {
      const { host } = createController(true, 'time', false, fontWeight);
      const clock = queryHtmlElement(host, 'time.x-nt-time-mark');

      expect(clock?.style.fontWeight).toBe(String(fontWeight));
      expect(clock?.style.letterSpacing).toBe(expectedLetterSpacing);
    });
  });

  it('draws a 12-hour clock with AM/PM after the digits in every language', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 19, 21, 5, 0));
    const render = (locale: string, twelveHour: boolean) => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const store = createViewStore<TopContentState>({ model: null });
      const controller = createTopContentController(host, {
        onActivate: vi.fn(),
        onEntryAnimationComplete: vi.fn()
      }, store);
      controllers.push(controller);
      act(() => {
        store.setState({ model: {
          animateEntry: false,
          ariaLabel: 'Lumno',
          appearance: APPEARANCE,
          locale,
          mode: 'time',
          twelveHour
        } });
      });
      return getElement(host, 'time.x-nt-time-mark');
    };

    const english = render('en-US', true);
    const englishDigits = getElement(english, '[aria-hidden="true"]');
    const englishPeriod = queryHtmlElement(english, '.x-nt-time-day-period');
    expect(english.dataset.twelveHour).toBe('true');
    expect(english.getAttribute('datetime')).toBe('21:05');
    expect(english.getAttribute('aria-label')).toMatch(/^9:05\sPM$/);
    expect(englishPeriod?.textContent).toBe('PM');
    expect(englishPeriod?.dataset.dayPeriod).toBe('pm');
    expect(englishPeriod?.style.fontWeight).toBe('520');
    expect(englishDigits.lastElementChild).toBe(englishPeriod);

    const chinese = render('zh-CN', true);
    const chinesePeriod = queryHtmlElement(chinese, '.x-nt-time-day-period');
    expect(chinesePeriod?.textContent).toBe('PM');
    expect(getElement(chinese, '[aria-hidden="true"]').lastElementChild).toBe(chinesePeriod);

    const twentyFourHour = render('en-US', false);
    expect(twentyFourHour.dataset.twelveHour).toBe('false');
    expect(twentyFourHour.getAttribute('aria-label')).toBe('21:05');
    expect(twentyFourHour.querySelector('.x-nt-time-day-period')).toBeNull();
  });

  it('uses a restrained soft-swap element instead of rolling seconds', () => {
    const { host, onEntryAnimationComplete } = createController(
      true,
      'time',
      true
    );
    const clock = queryHtmlElement(host, 'time.x-nt-time-mark');
    const seconds = (clock ? queryHtmlElement(clock, '.x-nt-time-seconds-value') : null);
    const secondsDigits = (seconds ? getElements(seconds, '.x-nt-time-seconds-digit') : []);

    expect(clock?.getAttribute('datetime')).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(clock?.dataset.showSeconds).toBe('true');
    expect(clock?.querySelectorAll('number-flow-react')).toHaveLength(2);
    expect(seconds?.textContent).toMatch(/^\d{2}$/);
    expect(seconds?.dataset.second).toMatch(/^\d{1,2}$/);
    expect(secondsDigits).toHaveLength(2);
    expect(secondsDigits?.[0]?.dataset.place).toBe('tens');
    expect(secondsDigits?.[1]?.dataset.place).toBe('ones');
    expect(clock?.getAttribute('aria-label')).toMatch(/\d{2}:\d{2}:\d{2}/);

    const secondsAnimationEnd = new Event('animationend', { bubbles: true });
    Object.defineProperty(secondsAnimationEnd, 'animationName', {
      value: '_x_nt_time_seconds_soft_swap_2026_unique_'
    });
    act(() => secondsDigits?.[1]?.dispatchEvent(secondsAnimationEnd));
    expect(onEntryAnimationComplete).not.toHaveBeenCalled();
  });

  it('replaces only the seconds digit whose value changes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 19, 12, 34, 10, 100));
    const originalVisibilityState = Object.getOwnPropertyDescriptor(
      document,
      'visibilityState'
    );
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible'
    });

    try {
      const { host } = createController(false, 'time', true);
      const getDigits = () =>
        Array.from(
          getElements(host, '.x-nt-time-seconds-digit')
        );
      const initialDigits = getDigits();

      expect(initialDigits.map((digit) => digit.textContent).join('')).toBe(
        '10'
      );
      act(() => vi.advanceTimersByTime(1_000));
      const digitsAtEleven = getDigits();
      expect(digitsAtEleven.map((digit) => digit.textContent).join('')).toBe(
        '11'
      );
      expect(digitsAtEleven[0]).toBe(initialDigits[0]);
      expect(digitsAtEleven[1]).not.toBe(initialDigits[1]);

      act(() => vi.advanceTimersByTime(9_000));
      const digitsAtTwenty = getDigits();
      expect(digitsAtTwenty.map((digit) => digit.textContent).join('')).toBe(
        '20'
      );
      expect(digitsAtTwenty[0]).not.toBe(digitsAtEleven[0]);
      expect(digitsAtTwenty[1]).not.toBe(digitsAtEleven[1]);
    } finally {
      if (originalVisibilityState) {
        Object.defineProperty(
          document,
          'visibilityState',
          originalVisibilityState
        );
      } else {
        Reflect.deleteProperty(document, 'visibilityState');
      }
    }
  });

  it('pauses second ticks while hidden and catches up when visible again', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 19, 12, 34, 10, 100));
    const originalVisibilityState = Object.getOwnPropertyDescriptor(
      document,
      'visibilityState'
    );
    const setVisibilityState = (value: DocumentVisibilityState) => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value
      });
    };

    try {
      setVisibilityState('visible');
      const { host } = createController(false, 'time', true);
      const getSeconds = () =>
        queryHtmlElement(host, '.x-nt-time-seconds-value')
          ?.textContent;

      expect(getSeconds()).toBe('10');
      act(() => vi.advanceTimersByTime(1_000));
      expect(getSeconds()).toBe('11');

      setVisibilityState('hidden');
      act(() => document.dispatchEvent(new Event('visibilitychange')));
      act(() => vi.advanceTimersByTime(5_000));
      expect(getSeconds()).toBe('11');

      setVisibilityState('visible');
      act(() => document.dispatchEvent(new Event('visibilitychange')));
      expect(getSeconds()).toBe('16');
      act(() => vi.advanceTimersByTime(1_000));
      expect(getSeconds()).toBe('17');
    } finally {
      if (originalVisibilityState) {
        Object.defineProperty(
          document,
          'visibilityState',
          originalVisibilityState
        );
      } else {
        Reflect.deleteProperty(document, 'visibilityState');
      }
    }
  });

  it('reports the named entry animation and reduced-motion state', () => {
    const { controller, host, onEntryAnimationComplete } =
      createController(false);
    expect(host.dataset.enter).toBe('done');
    const event = new Event('animationend', { bubbles: true });
    Object.defineProperty(event, 'animationName', {
      value: '_x_nt_wordmark_enter_2026_unique_'
    });
    act(() => controller.getButton()?.dispatchEvent(event));
    expect(onEntryAnimationComplete).toHaveBeenCalledWith(
      '_x_nt_wordmark_enter_2026_unique_'
    );
  });
});
