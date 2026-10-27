import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useSegmentedIndicator } from '../../shared/react/segmented-indicator';
import { queryHtmlElement } from '../../shared/dom-lookup';
import type { RemixIconName } from '../../shared/ui/remix-icon';
import { RemixIcon } from '../../shared/react/remix-icon';

export interface SettingsNavigationItemModel {
  iconName: RemixIconName;
  key: string;
  label: string;
  labelKey: string;
}

export interface SettingsNavigationRenderModel {
  activeKey: string;
  items: SettingsNavigationItemModel[];
}

/**
 * Labels never wrap. When they do not fit on one row (long translations, narrow windows)
 * the strip goes compact first: no icons, tighter spacing. If it still overflows it
 * scrolls sideways; mark which edges hide tabs (the stylesheet fades them) and keep the
 * active tab in view. Returns whether the strip is compact.
 */
function useTabStripOverflow(
  indicatorRef: RefObject<HTMLSpanElement | null>,
  activeKey: string,
  labelsSignature: string
) {
  const [compact, setCompact] = useState(false);
  useLayoutEffect(() => {
    const strip = indicatorRef.current?.parentElement;
    if (!strip) {
      return undefined;
    }
    let disposed = false;
    const updateEdges = () => {
      const maxScroll = strip.scrollWidth - strip.clientWidth;
      strip.dataset.overflowStart = strip.scrollLeft > 1 ? 'true' : 'false';
      strip.dataset.overflowEnd = strip.scrollLeft < maxScroll - 1 ? 'true' : 'false';
    };
    // Measured with the icons shown, so the strip only goes compact when the full tabs overflow.
    const fit = () => {
      if (disposed) {
        return;
      }
      strip.dataset.compact = 'false';
      const overflows = strip.scrollWidth > strip.clientWidth + 1;
      strip.dataset.compact = overflows ? 'true' : 'false';
      setCompact(overflows);
      updateEdges();
    };
    fit();
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    resizeObserver?.observe(strip);
    strip.addEventListener('scroll', updateEdges, { passive: true });
    document.fonts?.ready.then(fit).catch(() => {});
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      strip.removeEventListener('scroll', updateEdges);
    };
  }, [indicatorRef, labelsSignature]);

  useLayoutEffect(() => {
    const strip = indicatorRef.current?.parentElement;
    const active = (strip ? queryHtmlElement(strip, 'button[data-active="true"]') : null);
    if (!strip || !active || strip.scrollWidth <= strip.clientWidth) {
      return;
    }
    const edge = 24;
    const left = active.offsetLeft;
    const right = left + active.offsetWidth;
    if (left - edge < strip.scrollLeft) {
      strip.scrollLeft = Math.max(0, left - edge);
    } else if (right + edge > strip.scrollLeft + strip.clientWidth) {
      strip.scrollLeft = right + edge - strip.clientWidth;
    }
  }, [activeKey, compact, indicatorRef]);
  return compact;
}

export function SettingsNavigation({
  model,
  onSelect
}: {
  model: SettingsNavigationRenderModel;
  onSelect(key: string): void;
}) {
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const labelsSignature = model.items.map((item) => item.label).join('\u0001');
  const compact = useTabStripOverflow(indicatorRef, model.activeKey, labelsSignature);
  useSegmentedIndicator(
    indicatorRef,
    `${model.activeKey}\u0002${labelsSignature}\u0002${compact ? 'compact' : 'full'}`
  );
  return (
    <>
      <span
        aria-hidden="true"
        className="_x_extension_tabs_indicator_2024_unique_"
        ref={indicatorRef}
      />
      {model.items.map((item) => {
        const active = item.key === model.activeKey;
        return (
          <button
            aria-current={active ? 'page' : undefined}
            aria-pressed={active}
            className="_x_extension_settings_tab_button_2024_unique_"
            data-active={active ? 'true' : 'false'}
            data-tab={item.key}
            key={item.key}
            onClick={() => onSelect(item.key)}
            type="button"
          >
            <RemixIcon className="_x_extension_tab_icon_2024_unique_" name={item.iconName} />
            <span data-i18n={item.labelKey}>{item.label}</span>
          </button>
        );
      })}
    </>
  );
}
