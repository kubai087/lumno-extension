// The cursor tooltip: the shared tooltip drawn beside the pointer (for text
// cut short, such as long titles and addresses), with an optional tag above
// it that names what a held modifier key would do. The surface draws it;
// this controller binds targets to it and redraws the target last bound
// when a modifier key changes.
import { queryHtmlElements } from '../dom-lookup';
import { DEFAULT_BOUND_ATTRIBUTE, DEFAULT_TEXT_ATTRIBUTE, HOST_CLASS } from './cursor-tooltip-model';
import type {
  ActiveBinding,
  CursorPointInput,
  CursorTooltipController,
  CursorTooltipHideOptions,
  CursorTooltipControllerOptions, CursorTooltipOptions,
  CursorTooltipTextSource,
  CursorTooltipWindow,
  ListenerTarget
} from './cursor-tooltip-model';
import {
  getBoundHandoffTarget,
  getNodeParent,
  getPointFromInput,
  getWindow,
  isHandoffNode,
  isModifierRefreshEvent,
  isNodeContainedBy,
  shouldShowTarget
} from './cursor-tooltip-points';
import { createCursorSurface } from './cursor-tooltip-surface';
import type { CursorSurface } from './cursor-tooltip-surface';

// What a bound target's listeners do with the tooltip.
interface BindingActions {
  surface: CursorSurface;
  // The bound target the pointer or focus is on, which modifier keys redraw.
  activate(binding: ActiveBinding): void;
  release(target: HTMLElement): void;
  hide(hideOptions?: CursorTooltipHideOptions | null): void;
}

// Whether leaving the target for another bound target in the handoff root
// should keep the tooltip up for the hide delay.
function shouldDeferBoundTooltipHide(
  event: CursorPointInput | null | undefined,
  target: HTMLElement,
  settings: CursorTooltipOptions,
  boundAttribute: string
): boolean {
  if (settings.deferHideVisibility !== true || !event) {
    return false;
  }
  const relatedTarget = event.relatedTarget;
  if (!isHandoffNode(relatedTarget) || relatedTarget === target) {
    return false;
  }
  const handoffRoot = settings.handoffRoot || settings.handoffElement || getNodeParent(target);
  if (!handoffRoot || !isNodeContainedBy(handoffRoot, relatedTarget)) {
    return false;
  }
  const relatedBoundTarget = getBoundHandoffTarget(relatedTarget, boundAttribute, handoffRoot);
  return Boolean(relatedBoundTarget && relatedBoundTarget !== target);
}

// The pointer stays where it was; only the held modifier keys change.
function getModifierRefreshInput(event: CursorPointInput | null | undefined, binding: ActiveBinding, surface: CursorSurface): CursorPointInput {
  const source: CursorPointInput = event || {};
  const point = binding.lastPoint || surface.lastPoint() || getPointFromInput(null, binding.target);
  return {
    type: source.type || 'modifierchange',
    key: source.key || '',
    clientX: point.clientX,
    clientY: point.clientY,
    metaKey: Boolean(source.metaKey),
    ctrlKey: Boolean(source.ctrlKey),
    altKey: Boolean(source.altKey),
    shiftKey: Boolean(source.shiftKey)
  };
}

// The window's key events, or the document's when the window has no
// listener methods.
function getModifierListenerTarget(windowObj: CursorTooltipWindow, documentObj: Document | null): ListenerTarget | null {
  const { addEventListener: addListener, removeEventListener: removeListener } = windowObj;
  if (typeof addListener !== 'function') {
    return documentObj;
  }
  return {
    addEventListener: (...args) => Reflect.apply(addListener, windowObj, args),
    removeEventListener: (...args) => {
      if (typeof removeListener === 'function') {
        Reflect.apply(removeListener, windowObj, args);
      }
    }
  };
}

// Calls refresh whenever a key goes down or up, and with every modifier
// released when the window loses focus. Returns the detach.
function listenForModifierKeys(
  listenerTarget: ListenerTarget,
  refresh: (event: CursorPointInput) => void
): () => void {
  const onKey = (event: CursorPointInput): void => {
    if (isModifierRefreshEvent(event)) {
      refresh(event);
    }
  };
  const onBlur = (): void => {
    refresh({ type: 'blur', key: '', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false });
  };
  listenerTarget.addEventListener('keydown', onKey, true);
  listenerTarget.addEventListener('keyup', onKey, true);
  listenerTarget.addEventListener('blur', onBlur, true);
  return () => {
    listenerTarget.removeEventListener('keydown', onKey, true);
    listenerTarget.removeEventListener('keyup', onKey, true);
    listenerTarget.removeEventListener('blur', onBlur, true);
  };
}

// Marks a target as bound, moving its native title aside so the browser's
// own tooltip does not show too. False when it was bound already.
function markBoundTarget(target: HTMLElement, settings: CursorTooltipOptions, boundAttribute: string): boolean {
  if (target.getAttribute(boundAttribute) === 'true') {
    return false;
  }
  target.classList.add(HOST_CLASS);
  target.setAttribute(boundAttribute, 'true');
  if (settings.suppressNativeTitle !== false) {
    const nativeTitle = target.getAttribute('title');
    if (nativeTitle) {
      target.setAttribute('data-cursor-tooltip-native-title', nativeTitle);
      target.removeAttribute('title');
    }
  }
  return true;
}

// Shows the tooltip while the pointer is over the target or it has focus,
// following the pointer; a target that stops wanting it (a modifier key
// released) hides it but stays active, so pressing the key shows it again.
function listenToBoundTarget(
  target: HTMLElement,
  resolveText: CursorTooltipTextSource,
  settings: CursorTooltipOptions,
  boundAttribute: string,
  actions: BindingActions
): void {
  const { surface } = actions;
  const activateAndShow = (event: CursorPointInput | null, show: (options: CursorTooltipOptions) => void): void => {
    actions.activate({ target, resolveText, settings, lastPoint: getPointFromInput(event, target) });
    const eventOptions: CursorTooltipOptions = { ...settings, inputEvent: event || null };
    if (shouldShowTarget(target, eventOptions)) {
      show(eventOptions);
    } else {
      actions.hide({ preserveActiveBinding: true });
    }
  };
  const onEnter = (event: CursorPointInput): void => {
    if (settings.preserveVisibleOnTargetSwitch === true && surface.keepForStaleEnter(event, target)) {
      return;
    }
    activateAndShow(event, (options) => surface.show(target, resolveText(target, event), event, options));
  };
  const onMove = (event: CursorPointInput): void => {
    const current = surface.currentTarget();
    if (current && current !== target) {
      return;
    }
    activateAndShow(event, (options) => {
      if (!current) {
        surface.show(target, resolveText(target, event), event, options);
        return;
      }
      // A target whose text depends on where the pointer is on it, such as
      // a result row over its address line, swaps the text in place.
      const text = String(resolveText(target, event) || '');
      if (!text) {
        actions.hide({ preserveActiveBinding: true });
        return;
      }
      surface.retext(text);
      surface.move(event, options, () => actions.hide());
    });
  };
  const onFocus = (): void => {
    activateAndShow(null, (options) => surface.show(target, resolveText(target), getPointFromInput(null, target), options));
  };
  const onLeave = (event: CursorPointInput): void => {
    const current = surface.currentTarget();
    actions.release(target);
    if (!current || current === target) {
      actions.hide({ deferVisibility: shouldDeferBoundTooltipHide(event, target, settings, boundAttribute) });
    }
  };
  target.addEventListener('pointerenter', onEnter, true);
  target.addEventListener('pointermove', onMove);
  target.addEventListener('pointerleave', onLeave);
  target.addEventListener('pointercancel', onLeave);
  target.addEventListener('focus', onFocus);
  target.addEventListener('blur', onLeave);
}

function createController(options: CursorTooltipControllerOptions): CursorTooltipController {
  const config = options;
  const surface = createCursorSurface(config);
  let activeBinding: ActiveBinding | null = null;
  let detachModifierListeners: (() => void) | null = null;

  function hide(hideOptions?: CursorTooltipHideOptions | null): HTMLElement | null {
    if (!(hideOptions && hideOptions.preserveActiveBinding)) {
      activeBinding = null;
    }
    return surface.hide(Boolean(hideOptions && hideOptions.deferVisibility));
  }

  function refresh(event?: CursorPointInput | null): HTMLElement | null {
    const binding = activeBinding;
    if (!binding) {
      return null;
    }
    const input = getModifierRefreshInput(event, binding, surface);
    const eventOptions: CursorTooltipOptions = { ...binding.settings, inputEvent: input };
    if (!shouldShowTarget(binding.target, eventOptions)) {
      return hide({ preserveActiveBinding: true });
    }
    return surface.show(binding.target, binding.resolveText(binding.target, input), input, eventOptions);
  }

  // Held modifier keys change the action tag, so key presses refresh it.
  function attachModifierListeners(): void {
    const listenerTarget = detachModifierListeners ? null : getModifierListenerTarget(getWindow(config), surface.documentObj);
    if (listenerTarget) {
      detachModifierListeners = listenForModifierKeys(listenerTarget, refresh);
    }
  }

  const actions: BindingActions = {
    surface,
    activate: (binding) => { activeBinding = binding; },
    release: (target) => {
      if (activeBinding && activeBinding.target === target) {
        activeBinding = null;
      }
    },
    hide
  };

  function bind(
    target: HTMLElement | null | undefined,
    getText?: CursorTooltipTextSource | null,
    bindOptions?: CursorTooltipOptions | null
  ): HTMLElement | null {
    if (!target) {
      return null;
    }
    attachModifierListeners();
    const settings: CursorTooltipOptions = bindOptions || {};
    const boundAttribute = settings.boundAttribute || DEFAULT_BOUND_ATTRIBUTE;
    if (markBoundTarget(target, settings, boundAttribute)) {
      const resolveText: CursorTooltipTextSource = typeof getText === 'function'
        ? getText
        : () => target.getAttribute(settings.attributeName || DEFAULT_TEXT_ATTRIBUTE);
      listenToBoundTarget(target, resolveText, settings, boundAttribute, actions);
    }
    return target;
  }

  return {
    get element() {
      return surface.ensureElement();
    },
    get tagElement() {
      return surface.ensureTagElement();
    },
    destroy() {
      activeBinding = null;
      if (detachModifierListeners) {
        detachModifierListeners();
        detachModifierListeners = null;
      }
      surface.destroy();
    },
    show: (target, text, pointInput, showOptions) => surface.show(target, text, pointInput, showOptions),
    move: (pointInput, moveOptions) => surface.move(pointInput, moveOptions, () => hide()),
    hide,
    refresh,
    bind,
    bindAll(rootNode?: ParentNode | null, bindOptions?: CursorTooltipOptions | null): HTMLElement[] {
      const scope = rootNode || surface.documentObj;
      const settings: CursorTooltipOptions = bindOptions || {};
      const selector = settings.selector || `[${settings.attributeName || DEFAULT_TEXT_ATTRIBUTE}]`;
      return scope ? queryHtmlElements(scope, selector).filter((node) => Boolean(bind(node, null, settings))) : [];
    }
  };
}

export { createController };
