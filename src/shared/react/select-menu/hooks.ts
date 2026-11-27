// What an open select menu follows: the viewport and the elements whose
// size moves it, and the clicks, focus and Escape outside it that close it.
import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { isNode } from '../../dom-guards';
import { VIEWPORT_PADDING, placeSelectMenu } from './placement';
import type { MenuPlacementSettings } from './placement';

type PlacementSettings = Omit<MenuPlacementSettings, 'topInset'>;

interface MenuPositionerOptions {
  settings: PlacementSettings;
  host: HTMLElement;
  openRef: RefObject<boolean>;
  triggerRef: RefObject<HTMLElement | null>;
  menuRef: RefObject<HTMLElement | null>;
  getViewportTopInset?(wrapper: HTMLElement): number;
}

// The function that places the open menu, and the one that forgets its
// measured height (for a new open, or a list that changed while open).
function useMenuPositioner(options: MenuPositionerOptions): { position(): void; remeasure(): void } {
  const { settings, host, openRef, triggerRef, menuRef, getViewportTopInset } = options;
  // A searchable menu measures its whole list once per open; filtering then
  // changes only what it shows, never its box.
  const measuredHeightRef = useRef<number | null>(null);
  const { absolute, matchTriggerWidth, align, offset, zIndex, searchable, win, doc } = settings;
  const position = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!openRef.current || !trigger || !menu) {
      return;
    }
    const configuredInset = Number(getViewportTopInset?.(host));
    const topInset = Number.isFinite(configuredInset) ? Math.max(VIEWPORT_PADDING, configuredInset) : VIEWPORT_PADDING;
    const placement = { absolute, matchTriggerWidth, align, offset, zIndex, searchable, win, doc, topInset };
    const naturalHeight = placeSelectMenu(menu, trigger, placement, measuredHeightRef.current);
    if (searchable) {
      measuredHeightRef.current = naturalHeight;
    }
  }, [absolute, align, doc, getViewportTopInset, host, matchTriggerWidth, menuRef, offset, openRef, searchable, triggerRef, win, zIndex]);
  const remeasure = useCallback(() => {
    measuredHeightRef.current = null;
  }, []);
  return { position, remeasure };
}

// Calls `onChange` while the viewport scrolls or resizes, or one of the
// elements changes size; returns the function that stops.
function followViewport(win: Window & typeof globalThis, elements: ReadonlyArray<Element | null | undefined>,
  onChange: () => void): () => void {
  win.addEventListener('resize', onChange);
  win.addEventListener('scroll', onChange, true);
  const ResizeObserverCtor = win.ResizeObserver;
  const resizeObserver = ResizeObserverCtor ? new ResizeObserverCtor(onChange) : null;
  elements.forEach((element) => {
    if (element) {
      resizeObserver?.observe(element);
    }
  });
  win.visualViewport?.addEventListener('resize', onChange);
  win.visualViewport?.addEventListener('scroll', onChange);
  return () => {
    win.removeEventListener('resize', onChange);
    win.removeEventListener('scroll', onChange, true);
    resizeObserver?.disconnect();
    win.visualViewport?.removeEventListener('resize', onChange);
    win.visualViewport?.removeEventListener('scroll', onChange);
  };
}

// Closes the open menu on a press or focus outside it, and on Escape.
function useOutsideDismiss(open: boolean, doc: Document, host: HTMLElement, menuRef: RefObject<HTMLElement | null>,
  triggerRef: RefObject<HTMLElement | null>, setOpen: (open: boolean) => void): void {
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const isOutside = (event: Event): boolean => {
      const target = isNode(event.target) ? event.target : null;
      return Boolean(target && !host.contains(target) && !menuRef.current?.contains(target));
    };
    const onPointerDown = (event: PointerEvent) => {
      if (isOutside(event)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      // Escape that drops an IME composition (in a searchable menu's filter)
      // belongs to the IME, not the menu.
      if (event.key === 'Escape' && !event.isComposing && event.keyCode !== 229) {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    // Focus coming back to where it was when the menu opened, as when the
    // window comes to the front again, has not left the menu. On macOS the
    // click that brings the window forward would otherwise close the menu
    // and land on what was under it.
    let focusedAtOpen = doc.activeElement;
    const onFocusIn = (event: FocusEvent) => {
      if (event.target === focusedAtOpen) {
        return;
      }
      focusedAtOpen = null;
      if (isOutside(event)) {
        setOpen(false);
      }
    };
    doc.addEventListener('pointerdown', onPointerDown, true);
    doc.addEventListener('keydown', onKeyDown, true);
    doc.addEventListener('focusin', onFocusIn, true);
    return () => {
      doc.removeEventListener('pointerdown', onPointerDown, true);
      doc.removeEventListener('keydown', onKeyDown, true);
      doc.removeEventListener('focusin', onFocusIn, true);
    };
  }, [doc, host, menuRef, open, setOpen, triggerRef]);
}

export { followViewport, useMenuPositioner, useOutsideDismiss };
