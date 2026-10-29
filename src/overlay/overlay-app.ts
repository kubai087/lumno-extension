// The search overlay the worker injects into a web page (and the onboarding
// page loads for its demo), an ES module the browser loads once per page: the
// CJK font faces its text falls back to, then the search panel, which imports
// its views. The worker calls run() with each toggle (src/platform/injection.ts).
import '../shared/cjk-font-faces';
import { toggleSearchOverlay } from './app/main';
import { isOverlayOpenState, setOverlayOpenState } from '../platform/content-registry';
import { readOverlayCommand } from '../domain/injected-commands';
import { isOverlayHostInPage } from './react/shell';
import type { OverlayReply } from '../domain/injected-commands';

// Loaded and closed, until the first toggle opens it.
setOverlayOpenState(false);

// When this page finished loading the overlay's modules. The worker starts
// the entry motion's budget when it sends a toggle; the first toggle after a
// load starts it here instead, so parsing the modules does not use it up.
const loadedAt = Date.now();
let firstRun = true;

function withLoadTime(context: unknown): unknown {
  if (!firstRun) {
    return context;
  }
  firstRun = false;
  return context && typeof context === 'object' ? { ...context, openedAt: loadedAt } : context;
}

function run(command: unknown): OverlayReply {
  const request = readOverlayCommand(command);
  if (!request) {
    return { ok: false, reason: 'invalid-command' };
  }
  toggleSearchOverlay(request.tabs, withLoadTime(request.context));
  return { ok: true, overlayOpen: isOverlayOpenState() && isOverlayHostInPage(document) };
}

export { run };
