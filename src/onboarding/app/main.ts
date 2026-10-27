// The onboarding page's entry, an ES module that runs once the markup is
// parsed: it makes the page's owners, draws the one root into the shell,
// then reads the slides in the reader's language and opens the one the link
// names.
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { queryHtmlElement } from '../../shared/dom-lookup';
import { captureCursorTransitionStart } from '../dom/cursor-transition';
import { OnboardingLayout } from '../dom/layout';
import { getTextSwapDurationMs, prefersReducedMotion } from '../dom/motion';
import { showSlide } from '../dom/shell';
import { OnboardingTooltips } from '../dom/tooltips';
import { OnboardingFlow } from '../features/flow';
import { followKeys } from '../features/keys';
import { loadOnboardingBlueprint } from '../features/locale';
import { followSearchCommand } from '../features/overlay-demo';
import { SearchShortcut } from '../features/search-shortcut';
import { OnboardingApp } from './root';

function start(shell: HTMLElement): void {
  const layout = new OnboardingLayout(shell, document, window);
  const flow: OnboardingFlow = new OnboardingFlow({
    win: window,
    reducedMotion: prefersReducedMotion,
    swapDurationMs: getTextSwapDurationMs,
    beforeSlideChange(current, next) {
      const { blueprint } = flow.store.getSnapshot();
      if (blueprint) {
        captureCursorTransitionStart(shell, blueprint, current, next);
      }
    },
    afterSlideChange(next) {
      const { blueprint } = flow.store.getSnapshot();
      if (blueprint) {
        showSlide(shell, blueprint, next);
      }
      layout.resetStackedLayoutScroll();
    },
    layoutCopy() {
      layout.layoutCopy();
    }
  });
  const shortcut = new SearchShortcut();
  const tooltips = new OnboardingTooltips(window, flow);

  // The frame shows at once; its columns fill in once the slides are read.
  shell.dataset.reactIsland = 'onboarding-page';
  createRoot(shell).render(createElement(OnboardingApp, { flow, shortcut, layout, tooltips }));
  layout.follow();
  followKeys(document, flow, shortcut);
  followSearchCommand();

  const params = new URLSearchParams(window.location.search || '');
  void loadOnboardingBlueprint(params).then((blueprint) => {
    flow.load(blueprint, Number(params.get('slide') || 0));
    shortcut.follow(window, document);
  });
}

const shell = queryHtmlElement(document, '[data-onboarding-shell]');
if (shell) {
  start(shell);
}
