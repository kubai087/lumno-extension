// The scripts the worker injects into web pages, and the commands it sends
// them. Each one is an ES module the browser loads once per page; the worker
// imports it in the page (src/platform/injection.ts) and calls its run() with
// one of these commands. Commands arrive from another world, so every app
// reads them as untrusted.

const INJECTED_APP_PATHS = Object.freeze({
  'icon-font-preload': 'build/injected/icon-font-preload.js',
  overlay: 'build/injected/overlay.js',
  'tab-switcher': 'build/injected/tab-switcher.js',
  'link-preview': 'build/injected/link-preview.js',
  'pip-picker': 'build/injected/pip-picker.js',
  'page-shortcut-toast': 'build/injected/page-shortcut-toast.js',
  'copy-url-listener': 'build/injected/copy-url-listener.js',
  'ai-prompt-submit': 'build/injected/ai-prompt-submit.js'
});

type InjectedAppName = keyof typeof INJECTED_APP_PATHS;

// The search overlay's host element, which the worker checks after a toggle.
const OVERLAY_HOST_ID = '_x_extension_overlay_host_2026_unique_';
// The search panel inside the host.
const OVERLAY_PANEL_ID = '_x_extension_overlay_2024_unique_';

// Opens or closes the search overlay with the window's tabs and the context
// the worker opened it with; the overlay reads both as untrusted.
interface OverlayToggleCommand {
  type: 'toggle';
  tabs: unknown;
  context: unknown;
}

interface OverlayReply {
  ok: boolean;
  reason?: string;
  overlayOpen?: boolean;
}

interface TabSwitcherToggleCommand {
  type: 'toggle';
  context: unknown;
}

type PipPickerCommand = { type: 'toggle' } | { type: 'conflict-toast' };

interface PageShortcutToastCommand {
  type: 'show';
  message: string;
  error: boolean;
  duration: number | undefined;
  themeMode: string;
}

// Starts a script whose work then runs on messages and page events.
interface StartCommand {
  type: 'start';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function readOverlayCommand(value: unknown): OverlayToggleCommand | null {
  if (!isRecord(value) || value.type !== 'toggle') {
    return null;
  }
  return { type: 'toggle', tabs: value.tabs, context: value.context };
}

function readTabSwitcherCommand(value: unknown): TabSwitcherToggleCommand | null {
  if (!isRecord(value) || value.type !== 'toggle') {
    return null;
  }
  return { type: 'toggle', context: value.context };
}

function readPipPickerCommand(value: unknown): PipPickerCommand | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.type === 'toggle') {
    return { type: 'toggle' };
  }
  return value.type === 'conflict-toast' ? { type: 'conflict-toast' } : null;
}

function readPageShortcutToastCommand(value: unknown): PageShortcutToastCommand | null {
  if (!isRecord(value) || value.type !== 'show' || typeof value.message !== 'string' || !value.message) {
    return null;
  }
  const duration = typeof value.duration === 'number' && Number.isFinite(value.duration) ? value.duration : undefined;
  return {
    type: 'show',
    message: value.message,
    error: value.error === true,
    duration,
    themeMode: typeof value.themeMode === 'string' ? value.themeMode : 'system'
  };
}

function readStartCommand(value: unknown): StartCommand | null {
  return isRecord(value) && value.type === 'start' ? { type: 'start' } : null;
}

export {
  INJECTED_APP_PATHS,
  OVERLAY_HOST_ID,
  OVERLAY_PANEL_ID,
  readOverlayCommand,
  readPageShortcutToastCommand,
  readPipPickerCommand,
  readStartCommand,
  readTabSwitcherCommand
};
export type {
  InjectedAppName,
  OverlayReply,
  OverlayToggleCommand,
  PageShortcutToastCommand,
  PipPickerCommand,
  StartCommand,
  TabSwitcherToggleCommand
};
