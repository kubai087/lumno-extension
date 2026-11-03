// The parts of a mouse or keyboard event that decide where a link opens.
interface OpenEvent {
  button?: number;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

// splitTab opens a new tab in a split view beside the current one, where
// the browser has split views; elsewhere it is a new tab.
type Disposition = 'backgroundTab' | 'newTab' | 'currentTab' | 'splitTab';

function isMiddleClick(event: OpenEvent | null | undefined): boolean {
  return Boolean(event && Number(event.button) === 1);
}

function isBackgroundOpenEvent(event: OpenEvent | null | undefined): boolean {
  return Boolean(event && (event.metaKey || event.ctrlKey || isMiddleClick(event)));
}

function getDisposition(event: OpenEvent | null | undefined, fallback?: Disposition): Disposition {
  return isBackgroundOpenEvent(event)
    ? 'backgroundTab'
    : (fallback || 'newTab');
}

// What decides where a result or card opens on a surface with a default tab.
interface DefaultTabOpen {
  // The surface opens in the current tab unless a key says otherwise.
  currentTabByDefault?: boolean;
  // Shift: the other of the current and a new tab.
  openInOtherTab?: boolean;
  // Option/Alt, in the search boxes: a split view beside the current tab.
  openInSplitView?: boolean;
  // Command/Ctrl or a middle click.
  openInBackgroundTab?: boolean;
}

// Option/Alt opens in a split view; otherwise Shift flips the surface's
// default tab and wins over Command/Ctrl, which opens in the background.
function getDefaultTabDisposition(options: DefaultTabOpen): Disposition {
  const defaultDisposition: Disposition = options.currentTabByDefault ? 'currentTab' : 'newTab';
  if (options.openInSplitView) {
    return 'splitTab';
  }
  if (options.openInOtherTab) {
    return defaultDisposition === 'currentTab' ? 'newTab' : 'currentTab';
  }
  return options.openInBackgroundTab ? 'backgroundTab' : defaultDisposition;
}

export { getDefaultTabDisposition, getDisposition, isBackgroundOpenEvent, isMiddleClick };
export type { DefaultTabOpen, Disposition, OpenEvent };
