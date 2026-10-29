// The cursor tooltip's class names, options, controller and state.
import type { TooltipDrawing, TooltipElementOptions } from './tooltip';
import type { TooltipWindow } from './tooltip-frame';


const HOST_CLASS = '_x_extension_cursor_tooltip_host_2026_unique_';
const TAG_CLASS = '_x_extension_cursor_tooltip_tag_2026_unique_';
const TAG_KEY_CLASS = '_x_extension_cursor_tooltip_tag_key_2026_unique_';
const TAG_LABEL_CLASS = '_x_extension_cursor_tooltip_tag_label_2026_unique_';
const WINDOWS_LOGO_CLASS = '_x_extension_cursor_tooltip_windows_logo_2026_unique_';
const DEFAULT_VISIBLE_ATTRIBUTE = 'data-visible';
const DEFAULT_BOUND_ATTRIBUTE = 'data-cursor-tooltip-bound';
const DEFAULT_TEXT_ATTRIBUTE = 'data-cursor-tooltip';

interface CursorPoint {
  clientX: number;
  clientY: number;
}

// A pointer, focus or key event, or a bare point: whatever the caller has.
interface CursorPointInput {
  type?: string;
  key?: string;
  clientX?: number;
  clientY?: number;
  x?: number;
  y?: number;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  target?: EventTarget | null;
  relatedTarget?: EventTarget | null;
}

// A node the pointer may move to, or a test stand-in with these members.
interface HandoffNode {
  parentElement?: HandoffNode | null;
  parentNode?: HandoffNode | null;
  getAttribute?(name: string): string | null;
}

// The page window, or a stand-in with the members used here.
type CursorTooltipWindow = TooltipWindow & {
  navigator?: { platform?: string; userAgent?: string };
  addEventListener?: EventTarget['addEventListener'];
  removeEventListener?: EventTarget['removeEventListener'];
};

// The controller's options; show, move and bind take the same ones, merged
// over these.
interface CursorTooltipOptions extends TooltipElementOptions {
  windowObj?: CursorTooltipWindow | null;
  appendTo?: Node | null;
  hideDelay?: number;
  positionMode?: string;
  margin?: number;
  offsetX?: number;
  offsetY?: number;
  boundaryElement?: Element | null;
  maxWidth?: number | string;
  // false shows the tooltip even when the target is neither focused nor hovered.
  checkActive?: boolean;
  // Return false to keep the tooltip hidden for this target and input.
  shouldShow?(target: HTMLElement, inputEvent: CursorPointInput | null): boolean;
  // The input the current show or move came from.
  inputEvent?: CursorPointInput | null;
  // The action tag above the tooltip, e.g. "Open in new tab"; none when empty.
  getTagText?(input: CursorPointInput, target: HTMLElement): string | null | undefined;
  tagText?: string;
  // The key drawn in the tag: ⌘ on Apple platforms, the Windows logo elsewhere.
  getTagKeyText?(options: CursorTooltipOptions): string | null | undefined;
  tagKeyText?: string | null;
  tagGap?: number;
  tagMaxWidth?: number | string;
  // Moving to another bound target keeps the tooltip on screen.
  preserveVisibleOnTargetSwitch?: boolean;
  // Leaving for another bound target inside handoffRoot hides the tooltip
  // after a delay instead of at once.
  deferHideVisibility?: boolean;
  handoffRoot?: HandoffNode | null;
  handoffElement?: HandoffNode | null;
  boundAttribute?: string;
  // Keep the native title tooltip as well.
  suppressNativeTitle?: boolean;
  // The attribute that holds the text, data-cursor-tooltip by default.
  attributeName?: string;
  selector?: string;
}

interface CursorTooltipHideOptions {
  preserveActiveBinding?: boolean;
  deferVisibility?: boolean;
}

// The text for the target, which may depend on the input, such as where the
// pointer is on it.
type CursorTooltipTextSource = (
  target: HTMLElement,
  inputEvent?: CursorPointInput | null
) => string | null | undefined;

interface CursorTooltipPosition {
  top: number;
  left: number;
}

interface CursorTooltipController {
  readonly element: HTMLElement | null;
  readonly tagElement: HTMLElement | null;
  destroy(): void;
  show(
    target: HTMLElement | null | undefined,
    text: string | null | undefined,
    pointInput?: CursorPointInput | null,
    options?: CursorTooltipOptions | null
  ): HTMLElement | null;
  move(pointInput?: CursorPointInput | null, options?: CursorTooltipOptions | null): HTMLElement | null;
  hide(options?: CursorTooltipHideOptions | null): HTMLElement | null;
  // Shows the tooltip again for the target last bound, e.g. after a modifier key changed.
  refresh(event?: CursorPointInput | null): HTMLElement | null;
  bind(
    target: HTMLElement | null | undefined,
    getText?: CursorTooltipTextSource | null,
    options?: CursorTooltipOptions | null
  ): HTMLElement | null;
  bindAll(rootNode?: ParentNode | null, options?: CursorTooltipOptions | null): HTMLElement[];
}

type ListenerTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

interface ActiveBinding {
  target: HTMLElement;
  resolveText: CursorTooltipTextSource;
  settings: CursorTooltipOptions;
  lastPoint: CursorPoint;
}



export {
  DEFAULT_BOUND_ATTRIBUTE,
  DEFAULT_TEXT_ATTRIBUTE,
  DEFAULT_VISIBLE_ATTRIBUTE,
  HOST_CLASS,
  TAG_CLASS,
  TAG_KEY_CLASS,
  TAG_LABEL_CLASS,
  WINDOWS_LOGO_CLASS
};
// The options a controller is made with: the ones above, and the surface's
// React root that draws it.
type CursorTooltipControllerOptions = CursorTooltipOptions & TooltipDrawing;

export type {
  ActiveBinding,
  CursorPoint,
  CursorPointInput,
  CursorTooltipController,
  CursorTooltipControllerOptions,
  CursorTooltipHideOptions,
  CursorTooltipOptions,
  CursorTooltipPosition,
  CursorTooltipTextSource,
  CursorTooltipWindow,
  HandoffNode,
  ListenerTarget
};
