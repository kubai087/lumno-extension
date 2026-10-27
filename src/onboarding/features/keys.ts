// The page's keys: the search shortcut opens the demo overlay (unless the
// reader is typing), and the arrows, Home and End step through the slides.
import { isElementNode } from '../../shared/dom-guards';
import * as MODEL from '../onboarding-content';
import type { OnboardingEvent } from '../onboarding-content';
import type { OnboardingFlow } from './flow';
import { openDemoOverlay } from './overlay-demo';
import type { SearchShortcut } from './search-shortcut';

const STEP_BY_KEY: ReadonlyMap<string, OnboardingEvent> = new Map<string, OnboardingEvent>([
  ['ArrowRight', { type: 'NEXT' }],
  ['ArrowLeft', { type: 'PREV' }],
  ['Home', { type: 'HOME' }],
  ['End', { type: 'END' }]
]);

// Key events target elements, never text nodes.
function isEditableTarget(target: EventTarget | null): boolean {
  return isElementNode(target) &&
    Boolean(target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
}

function followKeys(doc: Document, flow: OnboardingFlow, shortcut: SearchShortcut): void {
  doc.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) {
      return;
    }
    if (MODEL.shortcutHotkeyMatchesEvent(shortcut.store.getSnapshot().shortcut, event)) {
      if (!isEditableTarget(event.target)) {
        event.preventDefault();
        event.stopPropagation();
        openDemoOverlay();
      }
      return;
    }
    const step = STEP_BY_KEY.get(event.key);
    if (step) {
      event.preventDefault();
      flow.dispatch(step);
    }
  });
}

export { followKeys };
