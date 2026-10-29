// Types the New Tab shares with the modules split out of it.
import type { ToastShowOptions } from '../shared/ui/toast-screen';
import type { CursorTooltipOptions, CursorTooltipTextSource } from '../shared/ui/cursor-tooltip-model';
import type { createSelectMenuController } from './react/select-menu';
import type { TooltipBindOptions, TooltipTextSource } from '../shared/ui/tooltip';

// A message by key from the page language; fallback when it has none.
type Translate = (key: string, fallback: string) => string;

// The message with each {name} replaced by params[name].
type FormatMessage = (key: string, fallback: string, params?: Readonly<Record<string, string | number>>) => string;


// How a favicon image loads: the address to try first, the fallbacks after
// it, and what happens when none loads.
interface FaviconAttachOptions {
  primaryUrl?: string;
  fallbackUrl?: string;
  // The browser's icon for the page.
  browserUrl?: string;
  // An icon saved for this exact page.
  pageSpecificUrl?: string;
  // Load an icon from another site's address directly.
  allowRemoteImage?: boolean;
  skipPersisted?: boolean;
  sourceProfile?: 'shortcut';
  onUnavailable?: () => void;
}

// Shows the page's favicon in the image, trying fallbacks in turn.
type AttachFaviconWithFallbacks = (
  image: HTMLImageElement,
  pageUrl: string,
  host: string,
  options?: FaviconAttachOptions
) => void;

// Shows a toast; isError marks it as a failure.
type ShowToast = (message: string, isError?: boolean, options?: ToastShowOptions) => void;

// Binds a tooltip to the target; null when there is no target.
type BindTooltip = (
  target: HTMLElement | null,
  getText: TooltipTextSource,
  options?: TooltipBindOptions
) => HTMLElement | null;

// Binds a tooltip that follows the pointer to the target.
type BindCursorTooltip = (
  target: HTMLElement | null,
  getText: CursorTooltipTextSource,
  options?: CursorTooltipOptions
) => HTMLElement | null;

// The controller of the React select menus the page's context menus are.
type SelectMenuController = ReturnType<typeof createSelectMenuController>;

// A context menu's parts: the positioned wrapper and the select it drives.
interface ContextMenuParts {
  control: HTMLElement;
  select: HTMLSelectElement;
  trigger: HTMLButtonElement;
  menu: HTMLElement;
}

// The New Tab's own theme: light, dark, or following the global theme.
type NewtabThemeMode = 'light' | 'dark' | 'global';

// Which theme the panel edits: the global one, or the New Tab's own.
type NewtabThemeScope = 'global' | 'home';

export type {
  AttachFaviconWithFallbacks,
  BindCursorTooltip,
  BindTooltip,
  ContextMenuParts,
  FaviconAttachOptions,
  FormatMessage,
  NewtabThemeMode,
  NewtabThemeScope,
  SelectMenuController,
  ShowToast,
  Translate
};
