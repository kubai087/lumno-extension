import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode
} from 'react';
import { createPortal } from 'react-dom';
import { RangeSliderField } from '../../../shared/react/range-slider';
import { useSegmentedIndicator } from '../../../shared/react/segmented-indicator';
import { getRangeSliderRow } from '../../dom/event-targets';

// Controls of the New Tab appearance panel. Each one renders from the state the
// wallpaper runtime hands down and reports changes through callbacks; none of them
// keeps a copy of a setting.

export const ref = (name: string) => ({ 'data-wallpaper-ref': name });

export interface TooltipActions {
  hideTooltip(): void;
  showTooltip(anchor: HTMLElement, text: string): void;
}

/** Hover and focus show `text` beside the element; leaving either hides it. */
export function tooltipHandlers(actions: TooltipActions, text: string | undefined) {
  if (!text) {
    return {};
  }
  const show = (event: { currentTarget: HTMLElement }) => actions.showTooltip(event.currentTarget, text);
  const hide = () => actions.hideTooltip();
  return { onBlur: hide, onFocus: show, onMouseEnter: show, onMouseLeave: hide };
}

export interface ToggleState {
  checked: boolean;
  disabled?: boolean;
  label: string;
}

export function Switch({
  name,
  onChange,
  toggle
}: {
  name: string;
  onChange(checked: boolean): void;
  toggle: ToggleState;
}) {
  return (
    <label className="x-nt-wallpaper-switch">
      <input
        {...ref(name)}
        aria-checked={toggle.checked ? 'true' : 'false'}
        aria-label={toggle.label || undefined}
        checked={toggle.checked}
        disabled={Boolean(toggle.disabled)}
        onChange={(event) => onChange(event.currentTarget.checked)}
        role="switch"
        type="checkbox"
      />
      <span aria-hidden="true" className="x-nt-wallpaper-switch-slider" />
    </label>
  );
}

export interface SegmentOption<V extends string = string> {
  ariaLabel?: string;
  label: string;
  value: V;
}

export interface SegmentState<V extends string = string> {
  active: V;
  label?: string;
  options: SegmentOption<V>[];
}

/**
 * A row of mutually exclusive buttons with a sliding indicator. As a tablist it is one
 * tab stop: arrow keys, Home and End move between tabs and select the one reached.
 */
export function SegmentedChoice<V extends string>({
  buttonClassName,
  className,
  idFor,
  indicatorClassName,
  indicatorRef,
  name,
  onSelect,
  panelIdFor,
  refFor,
  role,
  segment,
  valueAttribute,
  visible = true
}: {
  buttonClassName: string;
  className: string;
  idFor?(value: V): string;
  indicatorClassName: string;
  indicatorRef: string;
  name: string;
  onSelect(value: V): void;
  panelIdFor?(value: V): string;
  refFor?(value: V): string | undefined;
  role: 'group' | 'tablist';
  segment: SegmentState<V>;
  valueAttribute: `data-${string}`;
  /** Whether the row is displayed; the indicator is measured again once it is. */
  visible?: boolean;
}) {
  const indicator = useRef<HTMLSpanElement>(null);
  const buttons = useRef(new Map<V, HTMLButtonElement>());
  const tabs = role === 'tablist';
  useSegmentedIndicator(
    indicator,
    [String(visible), segment.active, ...segment.options.map((option) => option.label)].join('\u0000')
  );

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const count = segment.options.length;
    const index = segment.options.findIndex((option) => option.value === segment.active);
    let next = -1;
    if (event.key === 'ArrowRight') next = (index + 1) % count;
    else if (event.key === 'ArrowLeft') next = (index - 1 + count) % count;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = count - 1;
    if (next < 0 || !count) {
      return;
    }
    event.preventDefault();
    const value = segment.options[next].value;
    buttons.current.get(value)?.focus();
    if (value !== segment.active) {
      onSelect(value);
    }
  };

  return (
    <div
      {...ref(name)}
      aria-label={segment.label || undefined}
      className={`x-nt-segmented-tabs ${className}`}
      onKeyDown={tabs ? handleKeyDown : undefined}
      role={role}
    >
      <span
        {...ref(indicatorRef)}
        aria-hidden="true"
        className={`x-nt-segmented-tabs-indicator ${indicatorClassName}`}
        ref={indicator}
      />
      {segment.options.map((option) => {
        const selected = option.value === segment.active;
        const optionRef = refFor?.(option.value);
        return (
          <button
            {...(optionRef ? ref(optionRef) : {})}
            {...{ [valueAttribute]: option.value }}
            {...(tabs
              ? {
                  'aria-controls': panelIdFor?.(option.value),
                  'aria-selected': selected ? 'true' : 'false',
                  id: idFor?.(option.value),
                  role: 'tab',
                  tabIndex: selected ? 0 : -1
                }
              : { 'aria-pressed': selected ? 'true' : 'false' })}
            aria-label={option.ariaLabel || undefined}
            className={buttonClassName}
            data-active={selected ? 'true' : 'false'}
            key={option.value}
            onClick={() => onSelect(option.value)}
            ref={(element) => {
              if (element) buttons.current.set(option.value, element);
              else buttons.current.delete(option.value);
            }}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export interface SliderState {
  /** Defaults to `label`. */
  ariaLabel?: string;
  disabled?: boolean;
  label: string;
  max: number;
  min: number;
  step?: number;
  /** Shown after the number in the value bubble; `%` also marks the value box. */
  suffix?: string;
  value: number;
  /** aria-valuetext; defaults to the number. */
  valueText?: string;
}

export interface SliderChange {
  /** True while a pointer holds the thumb, where snapping helps. */
  dragging: boolean;
  /** True at the end of a drag, a key step or a typed value: time to save. */
  final: boolean;
}

export interface SliderBubble {
  hide(slider: HTMLInputElement | null, force?: boolean): void;
  show(slider: HTMLInputElement): void;
  startDrag(slider: HTMLInputElement): void;
  sync(slider: HTMLInputElement): void;
}

export interface SliderResetButton {
  label: string;
  name: string;
  onReset(): void;
  visible: boolean;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Range input plus an editable number box. The box keeps a draft while it is edited
 * and commits it, clamped and stepped, on blur or Enter; an empty or invalid draft
 * falls back to the current value.
 */
export function PanelSlider({
  bubble,
  className = 'x-nt-overlay-slider-wrap',
  inputClass = 'x-nt-overlay-slider',
  labelClass = 'x-nt-appearance-setting-title',
  labelRef,
  marks,
  name,
  onChange,
  reset,
  slider
}: {
  bubble?: SliderBubble;
  className?: string;
  inputClass?: string;
  labelClass?: string;
  labelRef?: string;
  marks?: number[];
  name: string;
  onChange(value: number, change: SliderChange): void;
  reset?: SliderResetButton;
  slider: SliderState;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const draggingRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [draft, setDraft] = useState<string | null>(null);
  const { min, max } = slider;
  const step = slider.step || 1;
  const value = Number.isFinite(slider.value) ? slider.value : min;
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const ariaLabel = slider.ariaLabel || slider.label;
  const disabled = Boolean(slider.disabled);

  // The shared field renders the row and the track wrapper; the page styles key off
  // attributes on those two, so they are set here.
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const row = getRangeSliderRow(input);
    if (row) {
      if (slider.suffix === '%') row.setAttribute('data-value-suffix', '%');
      else row.removeAttribute('data-value-suffix');
    }
    input.parentElement?.setAttribute('data-disabled', disabled ? 'true' : 'false');
  }, [disabled, slider.suffix]);

  // React reports every input; the native change marks the end of a drag or key step.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return undefined;
    const handleChange = () => {
      onChangeRef.current(Number(input.value), { dragging: false, final: true });
      bubble?.sync(input);
    };
    input.addEventListener('change', handleChange);
    return () => input.removeEventListener('change', handleChange);
  }, [bubble]);

  const endDrag = () => {
    draggingRef.current = false;
  };

  const commitDraft = () => {
    const text = draft === null ? '' : draft.trim();
    setDraft(null);
    const number = Number(text);
    if (draft === null || !text || !Number.isFinite(number)) {
      return;
    }
    const bounded = clampNumber(number, min, max);
    const next = min + Math.round((bounded - min) / step) * step;
    onChangeRef.current(next, { dragging: false, final: true });
  };

  return (
    <RangeSliderField
      {...ref(name)}
      aria-label={ariaLabel || undefined}
      aria-valuenow={value}
      aria-valuetext={slider.valueText ?? String(value)}
      className={className}
      data-value-suffix={slider.suffix || undefined}
      disabled={disabled}
      inputClass={inputClass}
      label={<span {...(labelRef ? ref(labelRef) : {})} className={labelClass}>{slider.label}</span>}
      marks={marks}
      max={String(max)}
      min={String(min)}
      onBlur={(event) => {
        endDrag();
        bubble?.hide(event.currentTarget, true);
      }}
      onChange={(event) => {
        onChangeRef.current(Number(event.currentTarget.value), {
          dragging: draggingRef.current,
          final: false
        });
        bubble?.show(event.currentTarget);
      }}
      onFocus={(event) => bubble?.show(event.currentTarget)}
      onMouseEnter={(event) => bubble?.show(event.currentTarget)}
      onMouseLeave={(event) => bubble?.hide(event.currentTarget)}
      onMouseMove={(event) => bubble?.sync(event.currentTarget)}
      onPointerCancel={endDrag}
      onPointerDown={(event) => {
        if (disabled) return;
        draggingRef.current = true;
        bubble?.startDrag(event.currentTarget);
      }}
      onPointerUp={endDrag}
      ref={inputRef}
      resetButtonProps={reset
        ? {
            ...ref(reset.name),
            'aria-label': reset.label,
            disabled: disabled || !reset.visible,
            onClick: (event) => {
              reset.onReset();
              event.currentTarget.blur();
            },
            title: reset.label
          }
        : undefined}
      rowClassName="x-nt-range-slider-row"
      step={String(step)}
      style={{ '--x-range-slider-percent': `${clampNumber(percent, 0, 100)}%` }}
      value={String(value)}
      valueInputProps={{
        ...ref(`${name}ValueInput`),
        'aria-label': ariaLabel || undefined,
        disabled,
        inputMode: 'numeric',
        onBlur: commitDraft,
        onChange: (event) => {
          let text = event.currentTarget.value;
          const number = Number(text);
          // Digits past the top snap to it while typing, as the slider would. A draft
          // below the bottom is left alone, since more digits may still lift it into
          // range (with min 300, "5" leads to "500"); the commit clamps it.
          if (text.trim() && Number.isFinite(number) && number > max) {
            text = String(max);
          }
          setDraft(text);
        },
        onKeyDown: (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        },
        value: draft ?? String(value)
      }}
    />
  );
}

function matchesSafely(element: Element, selector: string) {
  try {
    return element.matches(selector);
  } catch (_error) {
    return false;
  }
}

function formatBubbleValue(slider: HTMLInputElement) {
  const value = Number(slider.value);
  if (!Number.isFinite(value)) {
    return String(slider.value || '');
  }
  return `${Math.round(value)}${slider.getAttribute('data-value-suffix') || ''}`;
}

const BUBBLE_THUMB_SIZE = 16;
const BUBBLE_SPACING = 12;
const BUBBLE_EDGE = 8;

/**
 * One value bubble for every panel slider: it follows the thumb while the slider is
 * hovered, keyboard-focused or dragged, and sits below the slider near the top edge.
 */
export function useSliderValueBubble(documentObj: Document, open: boolean): {
  bubble: SliderBubble;
  node: ReactNode;
} {
  const windowObj = documentObj.defaultView || window;
  const bubbleRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<HTMLInputElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [target, setTarget] = useState<HTMLInputElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [, setRevision] = useState(0);

  const shouldShow = useCallback((slider: HTMLInputElement | null) => Boolean(
    slider && slider.isConnected && !slider.disabled &&
    (dragRef.current === slider ||
      (documentObj.activeElement === slider && matchesSafely(slider, ':focus-visible')) ||
      matchesSafely(slider, ':hover'))
  ), [documentObj]);

  const hide = useCallback((slider: HTMLInputElement | null, force = false) => {
    const current = slider || targetRef.current;
    if (!force && current && dragRef.current === current) return;
    if (!force && current && shouldShow(current)) return;
    targetRef.current = null;
    setTarget(null);
    setVisible(false);
  }, [shouldShow]);

  const show = useCallback((slider: HTMLInputElement) => {
    if (slider.disabled) return;
    targetRef.current = slider;
    setMounted(true);
    setTarget(slider);
    // Re-measure for the new value even when the target did not change.
    setRevision((revision) => revision + 1);
    windowObj.requestAnimationFrame(() => {
      if (targetRef.current === slider && shouldShow(slider)) {
        setVisible(true);
      }
    });
  }, [shouldShow, windowObj]);

  const sync = useCallback((slider: HTMLInputElement) => {
    if (targetRef.current !== slider) return;
    if (!shouldShow(slider)) {
      hide(slider, true);
      return;
    }
    setRevision((revision) => revision + 1);
    setVisible(true);
  }, [hide, shouldShow]);

  const startDrag = useCallback((slider: HTMLInputElement) => {
    dragRef.current = slider;
    show(slider);
    const finish = () => {
      windowObj.removeEventListener('pointerup', finish, true);
      windowObj.removeEventListener('pointercancel', finish, true);
      const dragged = dragRef.current;
      dragRef.current = null;
      if (dragged && shouldShow(dragged)) show(dragged);
      else hide(dragged, true);
    };
    windowObj.addEventListener('pointerup', finish, true);
    windowObj.addEventListener('pointercancel', finish, true);
  }, [hide, shouldShow, show, windowObj]);

  // Closing the panel, or resizing the window, drops the bubble.
  useEffect(() => {
    if (!open) {
      dragRef.current = null;
      hide(null, true);
    }
  }, [hide, open]);
  useEffect(() => {
    const handleResize = () => hide(null, true);
    windowObj.addEventListener('resize', handleResize, { passive: true });
    return () => windowObj.removeEventListener('resize', handleResize);
  }, [hide, windowObj]);

  useLayoutEffect(() => {
    const element = bubbleRef.current;
    const slider = target;
    if (!element || !slider) return;
    element.textContent = formatBubbleValue(slider);
    const sliderRect = slider.getBoundingClientRect();
    const bubbleRect = element.getBoundingClientRect();
    const viewportWidth = Math.max(0, windowObj.innerWidth || 0);
    const min = Number(slider.min);
    const max = Number(slider.max);
    const value = Number(slider.value);
    const percent = Number.isFinite(min) && Number.isFinite(max) && max > min && Number.isFinite(value)
      ? clampNumber((value - min) / (max - min), 0, 1)
      : 0;
    const centerX = sliderRect.left + (BUBBLE_THUMB_SIZE / 2) +
      Math.max(0, sliderRect.width - BUBBLE_THUMB_SIZE) * percent;
    let arrowSide = 'bottom';
    let top = sliderRect.top - bubbleRect.height - BUBBLE_SPACING;
    if (top < BUBBLE_EDGE) {
      arrowSide = 'top';
      top = sliderRect.bottom + BUBBLE_SPACING;
    }
    const maxLeft = viewportWidth > 0 ? viewportWidth - bubbleRect.width - BUBBLE_EDGE : centerX;
    const left = clampNumber(centerX - (bubbleRect.width / 2), BUBBLE_EDGE, Math.max(BUBBLE_EDGE, maxLeft));
    element.setAttribute('data-arrow-side', arrowSide);
    element.style.setProperty('top', `${Math.round(top)}px`);
    element.style.setProperty('left', `${Math.round(left)}px`);
  });

  const bubble = useRef<SliderBubble>({ hide, show, startDrag, sync });
  bubble.current.hide = hide;
  bubble.current.show = show;
  bubble.current.startDrag = startDrag;
  bubble.current.sync = sync;

  const host = documentObj.body || documentObj.documentElement;
  const node = mounted && host
    ? createPortal(
        <div
          aria-hidden="true"
          className="x-lumno-feature-hint x-nt-slider-value-bubble"
          data-arrow-align="center"
          data-arrow-side="bottom"
          data-visible={visible && target ? 'true' : 'false'}
          id="_x_extension_newtab_slider_value_bubble_2026_unique_"
          ref={bubbleRef}
        />,
        host
      )
    : null;
  return { bubble: bubble.current, node };
}
