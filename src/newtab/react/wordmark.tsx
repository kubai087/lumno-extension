import NumberFlow, { NumberFlowGroup } from '@number-flow/react';
import type { CSSProperties } from 'react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { queryHtmlElement } from '../../shared/dom-lookup';
import { getPagePortals } from '../app/portals';

export type NewtabTopContentMode = 'brand' | 'time';

// One of the clock faces from NEWTAB_TIME_FONTS in src/domain/settings.ts.
export interface TopContentClockFont {
  colonGap: number;
  colonShift: number;
  family: string;
  id: string;
  stretch: string;
  tracking: number | null;
}

// How the brand mark sits on the page: the image for the theme, or on a
// wallpaper a solid layer in the sampled ink; the clock takes the same ink.
export interface WordmarkAppearance {
  imageSrc: string;
  imageOpacity: number;
  solidOpacity: number;
  solidFill: string;
}

export interface TopContentModel {
  animateEntry: boolean;
  appearance: WordmarkAppearance;
  ariaLabel: string;
  font?: TopContentClockFont;
  /** The clock's size at full window width, in px. */
  fontSize?: number;
  fontWeight?: number;
  locale?: string;
  mode: NewtabTopContentMode;
  /** The clock's opacity, 0-1. */
  opacity?: number;
  showSeconds?: boolean;
  /** Draws hours 1-12 with the locale's AM/PM. */
  twelveHour?: boolean;
}

export interface TopContentControllerOptions {
  onActivate(disposition: 'newTab' | 'backgroundTab'): void;
  onEntryAnimationComplete(animationName?: string): void;
}

export interface TopContentController {
  destroy(): void;
  getButton(): HTMLButtonElement | null;
  getContent(): HTMLElement | null;
  getImage(): HTMLImageElement | null;
  render(model: TopContentModel): void;
  // Draws the last model in a new appearance, leaving its entry motion alone.
  updateAppearance(appearance: WordmarkAppearance): void;
}

const containerStyle = `
  all: unset;
  width: 90vw;
  max-width: var(--x-nt-search-max-width, 720px);
  max-height: 74px;
  min-height: 0;
  margin: 0 0 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  position: relative;
  z-index: 3;
  overflow: hidden;
  pointer-events: auto;
  opacity: 1;
  transform: translate3d(0, 0, 0);
  user-select: none;
`;

const buttonStyle: CSSProperties = {
  alignItems: 'center',
  cursor: 'pointer',
  display: 'inline-flex',
  justifyContent: 'center',
  lineHeight: 0,
  pointerEvents: 'auto',
  position: 'relative'
};

const clockStyle: CSSProperties = {
  alignItems: 'center',
  color: 'var(--x-nt-wordmark-solid-fill, rgb(31 41 55))',
  display: 'inline-flex',
  fontFamily: '"Open Sans", sans-serif',
  fontSize: 'clamp(42px, 4.2vw, 54px)',
  fontStretch: '86%',
  fontVariantNumeric: 'tabular-nums',
  justifyContent: 'center',
  lineHeight: 0.86,
  pointerEvents: 'none',
  position: 'relative',
  textRendering: 'geometricPrecision'
};

const CLOCK_DEFAULT_FONT_SIZE = 54;

// The default clamp(42px, 4.2vw, 54px), scaled so narrow windows shrink a
// custom size the same way.
function getClockFontSize(fontSize: number | undefined) {
  if (typeof fontSize !== 'number' || !Number.isFinite(fontSize) ||
      fontSize === CLOCK_DEFAULT_FONT_SIZE) {
    return clockStyle.fontSize;
  }
  const scale = fontSize / CLOCK_DEFAULT_FONT_SIZE;
  const round = (value: number) => Math.round(value * 100) / 100;
  return `clamp(${round(42 * scale)}px, ${round(4.2 * scale)}vw, ${round(fontSize)}px)`;
}

const clockDigitsStyle = {
  '--number-flow-mask-height': '0.16em',
  '--number-flow-mask-width': '0.24em'
};

// Each face sets these on the clock; the defaults are Open Sans's.
const colonStyle: CSSProperties = {
  display: 'inline-block',
  margin: '0 var(--x-nt-clock-colon-gap, 0.055em)',
  opacity: 0.72,
  transform: 'translateY(var(--x-nt-clock-colon-shift, -0.035em))'
};

const twoDigitFormat = Object.freeze({
  minimumIntegerDigits: 2,
  useGrouping: false
});

// 12-hour clocks read "9:41", not "09:41".
const twelveHourFormat = Object.freeze({
  minimumIntegerDigits: 1,
  useGrouping: false
});

// AM/PM sits small after the digits, in every language. At a third of the
// clock's size it needs more weight than the digits to read as clearly.
const dayPeriodStyle: CSSProperties = {
  fontSize: '0.34em',
  fontStretch: 'normal',
  letterSpacing: '0.02em',
  lineHeight: 1,
  marginLeft: '0.3em',
  opacity: 0.72,
  whiteSpace: 'nowrap'
};

const hourDigits = Object.freeze({ 1: Object.freeze({ max: 2 }) });
const minuteDigits = Object.freeze({ 1: Object.freeze({ max: 5 }) });
const CLOCK_LETTER_SPACING_BASE_EM = -0.055;
const CLOCK_LETTER_SPACING_STEP_EM = 0.004;
const CLOCK_LETTER_SPACING_MIN_WEIGHT = 300;
const CLOCK_LETTER_SPACING_WEIGHT_STEP = 100;
const CLOCK_LETTER_SPACING_MAX_STEPS = 5;

function getClockLetterSpacing(fontWeight: number) {
  const spacingSteps = Math.min(
    CLOCK_LETTER_SPACING_MAX_STEPS,
    Math.max(
      0,
      Math.floor(
        (fontWeight - CLOCK_LETTER_SPACING_MIN_WEIGHT) /
          CLOCK_LETTER_SPACING_WEIGHT_STEP
      )
    )
  );
  return `${(
    CLOCK_LETTER_SPACING_BASE_EM +
    spacingSteps * CLOCK_LETTER_SPACING_STEP_EM
  ).toFixed(3)}em`;
}

function getCurrentTime() {
  const now = new Date();
  return {
    hours: now.getHours(),
    minutes: now.getMinutes(),
    seconds: now.getSeconds()
  };
}

function getClockDateTime(
  time: { hours: number; minutes: number; seconds: number },
  showSeconds: boolean
) {
  const hours = String(time.hours).padStart(2, '0');
  const minutes = String(time.minutes).padStart(2, '0');
  const seconds = String(time.seconds).padStart(2, '0');
  return showSeconds ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}`;
}

function getTwelveHour(hours: number) {
  return hours % 12 || 12;
}

function createLocalizedTimeFormatter(
  locale: string | undefined,
  showSeconds: boolean,
  twelveHour: boolean
) {
  try {
    const format: Intl.DateTimeFormatOptions = twelveHour
      ? { hour: 'numeric', hourCycle: 'h12', minute: '2-digit' }
      : { hour: '2-digit', hourCycle: 'h23', minute: '2-digit' };
    if (showSeconds) {
      format.second = '2-digit';
    }
    return new Intl.DateTimeFormat(locale || undefined, format);
  } catch (_error) {
    return null;
  }
}

function getLocalizedTimeLabel(
  formatter: Intl.DateTimeFormat | null,
  dateTime: string
) {
  const [hours, minutes, seconds = 0] = dateTime.split(':').map(Number);
  const value = new Date();
  value.setHours(hours, minutes, seconds, 0);
  return formatter ? formatter.format(value) : dateTime;
}

const ClockHourMinuteDigits = memo(function ClockHourMinuteDigits({
  hours,
  locale,
  minutes,
  twelveHour
}: {
  hours: number;
  locale?: string;
  minutes: number;
  twelveHour: boolean;
}) {
  return (
    <NumberFlowGroup>
      <NumberFlow
        digits={hourDigits}
        format={twelveHour ? twelveHourFormat : twoDigitFormat}
        locales={locale}
        style={clockDigitsStyle}
        trend={0}
        value={twelveHour ? getTwelveHour(hours) : hours}
      />
      <span style={colonStyle}>:</span>
      <NumberFlow
        digits={minuteDigits}
        format={twoDigitFormat}
        locales={locale}
        style={clockDigitsStyle}
        trend={0}
        value={minutes}
      />
    </NumberFlowGroup>
  );
});

const solidStyle: CSSProperties = {
  background: 'var(--x-nt-wordmark-solid-fill, rgb(31 41 55))',
  contain: 'paint',
  inset: 0,
  mask: 'url("../../assets/images/lumno-wordmark-mask.svg") center / contain no-repeat',
  opacity: 0,
  pointerEvents: 'none',
  position: 'absolute',
  transition: 'background-color 180ms ease, opacity 180ms ease',
  WebkitMask:
    'url("../../assets/images/lumno-wordmark-mask.svg") center / contain no-repeat',
  zIndex: 0
};

const imageStyle: CSSProperties = {
  display: 'block',
  filter: 'none',
  height: 'auto',
  maxWidth: '52%',
  objectFit: 'contain',
  opacity: 0.82,
  position: 'relative',
  transform: 'translateY(0)',
  transition: 'opacity 180ms ease',
  width: 180,
  zIndex: 1
};

function getDisposition(event: {
  button?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
}) {
  return event.ctrlKey || event.metaKey || event.button === 1
    ? 'backgroundTab'
    : 'newTab';
}

function Wordmark({
  model,
  onActivate,
  onEntryAnimationComplete
}: {
  model: TopContentModel;
  onActivate(disposition: 'newTab' | 'backgroundTab'): void;
  onEntryAnimationComplete(animationName?: string): void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const button = buttonRef.current;
    if (!button) {
      return undefined;
    }
    const onAnimationCancel = () => onEntryAnimationComplete();
    button.addEventListener('animationcancel', onAnimationCancel);
    return () => {
      button.removeEventListener('animationcancel', onAnimationCancel);
    };
  }, [onEntryAnimationComplete]);
  return (
    <button
      aria-label={model.ariaLabel}
      className="x-nt-wordmark-content x-nt-wordmark-brand"
      onAnimationEnd={(event) =>
        onEntryAnimationComplete(event.animationName || undefined)
      }
      onAuxClick={(event) => {
        if (event.button !== 1) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onActivate(getDisposition(event));
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onActivate(getDisposition(event));
      }}
      ref={buttonRef}
      style={{ ...buttonStyle, '--x-nt-wordmark-solid-fill': model.appearance.solidFill }}
      type="button"
    >
      <span
        aria-hidden="true"
        className="x-nt-wordmark-solid"
        style={{ ...solidStyle, opacity: model.appearance.solidOpacity }}
      />
      <img
        alt=""
        className="x-nt-wordmark-image"
        draggable={false}
        height={25.1557}
        src={model.appearance.imageSrc}
        style={{ ...imageStyle, opacity: model.appearance.imageOpacity }}
        width={112}
      />
    </button>
  );
}

function ClockMark({
  model,
  onEntryAnimationComplete
}: {
  model: TopContentModel;
  onEntryAnimationComplete(animationName?: string): void;
}) {
  const showSeconds = model.showSeconds === true;
  const twelveHour = model.twelveHour === true;
  const fontWeight = model.fontWeight ?? 320;
  const font = model.font;
  const fontStyle = font
    ? ({
        fontFamily: font.family,
        fontStretch: font.stretch || 'normal',
        letterSpacing:
          typeof font.tracking === 'number'
            ? `${font.tracking}em`
            : getClockLetterSpacing(fontWeight),
        '--x-nt-clock-colon-gap': `${font.colonGap}em`,
        '--x-nt-clock-colon-shift': `${font.colonShift}em`
      })
    : { letterSpacing: getClockLetterSpacing(fontWeight) };
  const [time, setTime] = useState(getCurrentTime);
  const dateTime = getClockDateTime(time, showSeconds);
  const secondsText = String(time.seconds).padStart(2, '0');
  const localizedTimeFormatter = useMemo(
    () => createLocalizedTimeFormatter(model.locale, showSeconds, twelveHour),
    [model.locale, showSeconds, twelveHour]
  );
  const isAfternoon = time.hours >= 12;

  useEffect(() => {
    let timer = 0;
    const interval = showSeconds ? 1_000 : 60_000;
    const clearTimer = () => {
      if (timer) {
        window.clearTimeout(timer);
        timer = 0;
      }
    };
    const syncTime = () => {
      const nextTime = getCurrentTime();
      setTime((currentTime) => {
        const displayedTimeUnchanged =
          currentTime.hours === nextTime.hours &&
          currentTime.minutes === nextTime.minutes &&
          (!showSeconds || currentTime.seconds === nextTime.seconds);
        return displayedTimeUnchanged ? currentTime : nextTime;
      });
    };
    const scheduleNextTick = () => {
      clearTimer();
      if (document.visibilityState !== 'visible') {
        return;
      }
      const delay = interval - (Date.now() % interval) + 24;
      timer = window.setTimeout(() => {
        timer = 0;
        if (document.visibilityState !== 'visible') {
          return;
        }
        syncTime();
        scheduleNextTick();
      }, delay);
    };
    const handleVisibilityChange = () => {
      clearTimer();
      if (document.visibilityState === 'visible') {
        syncTime();
        scheduleNextTick();
      }
    };
    scheduleNextTick();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [showSeconds]);

  return (
    <time
      aria-label={getLocalizedTimeLabel(localizedTimeFormatter, dateTime)}
      className="x-nt-wordmark-content x-nt-time-mark"
      data-show-seconds={showSeconds ? 'true' : 'false'}
      data-twelve-hour={twelveHour ? 'true' : 'false'}
      data-time-font={font?.id}
      dateTime={dateTime}
      onAnimationEnd={(event) =>
        onEntryAnimationComplete(event.animationName || undefined)
      }
      style={{
        ...clockStyle,
        '--x-nt-wordmark-solid-fill': model.appearance.solidFill,
        ...fontStyle,
        fontSize: getClockFontSize(model.fontSize),
        fontWeight
      }}
    >
      {/* The entry animation runs on the <time> element's opacity, so the
          chosen opacity sits on the digits inside it. */}
      <span
        aria-hidden="true"
        style={typeof model.opacity === 'number' && model.opacity < 1
          ? { opacity: model.opacity }
          : undefined}
      >
        <ClockHourMinuteDigits
          hours={time.hours}
          locale={model.locale}
          minutes={time.minutes}
          twelveHour={twelveHour}
        />
        {showSeconds ? (
          <>
            <span style={colonStyle}>:</span>
            <span
              className="x-nt-time-seconds-value"
              data-second={time.seconds}
            >
              <span
                className="x-nt-time-seconds-digit"
                data-place="tens"
                key={`tens-${secondsText[0]}`}
                onAnimationEnd={(event) => event.stopPropagation()}
              >
                {secondsText[0]}
              </span>
              <span
                className="x-nt-time-seconds-digit"
                data-place="ones"
                key={`ones-${secondsText[1]}`}
                onAnimationEnd={(event) => event.stopPropagation()}
              >
                {secondsText[1]}
              </span>
            </span>
          </>
        ) : null}
        {twelveHour ? (
          <span
            className="x-nt-time-day-period"
            data-day-period={isAfternoon ? 'pm' : 'am'}
            style={{ ...dayPeriodStyle, fontWeight: Math.min(700, fontWeight + 200) }}
          >
            {isAfternoon ? 'PM' : 'AM'}
          </span>
        ) : null}
      </span>
    </time>
  );
}

export function createTopContentController(
  host: HTMLElement | null,
  options: TopContentControllerOptions
): TopContentController {
  if (!host) {
    return Object.freeze({
      destroy() {},
      getButton: () => null,
      getContent: () => null,
      getImage: () => null,
      render() {},
      updateAppearance() {}
    });
  }
  host.id = '_x_extension_newtab_wordmark_2026_unique_';
  host.dataset.reactIsland = 'newtab-wordmark';
  host.style.cssText = containerStyle;
  let destroyed = false;
  let current: TopContentModel | null = null;
  const draw = (model: TopContentModel) => {
    current = model;
    getPagePortals().show(host, (
      model.mode === 'time' ? (
        <ClockMark
          key={model.showSeconds === true ? 'seconds' : 'minutes'}
          model={model}
          onEntryAnimationComplete={options.onEntryAnimationComplete}
        />
      ) : (
        <Wordmark
          model={model}
          onActivate={options.onActivate}
          onEntryAnimationComplete={options.onEntryAnimationComplete}
        />
      )
    ));
  };
  return Object.freeze({
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      getPagePortals().remove(host);
    },
    getButton() {
      return host.querySelector('button');
    },
    getContent() {
      return queryHtmlElement(host, '.x-nt-wordmark-content');
    },
    getImage() {
      return host.querySelector('img');
    },
    render(model: TopContentModel) {
      if (destroyed) {
        return;
      }
      host.dataset.enter = model.animateEntry ? 'run' : 'done';
      draw(model);
    },
    updateAppearance(appearance: WordmarkAppearance) {
      if (destroyed || !current) {
        return;
      }
      draw({ ...current, appearance });
    }
  });
}
