// Where the reader is in the onboarding and how a slide change plays. This
// is its one owner: it holds the slides once read, the slide state the
// reducer keeps, the copy column's swap phase, the visual's exit, the step
// strip's entrance and the open accordion. A slide change swaps the copy
// out, then in from where it slides; each phase is drawn before the next.
import { flushSync } from 'react-dom';
import { createStore } from '../../shared/state/store';
import type { Store } from '../../shared/state/store';
import * as MODEL from '../onboarding-content';
import type { OnboardingBlueprint, OnboardingEvent, OnboardingState } from '../onboarding-content';
import type { CopySwapPhase } from '../react/copy-panel';

interface FlowState {
  blueprint: OnboardingBlueprint | null;
  slide: OnboardingState | null;
  copySwap: CopySwapPhase;
  // The visual blurs out ahead of some slide changes.
  visualExiting: boolean;
  // The step strip shows from the second slide on and slides in when it appears.
  pageStripEntering: boolean;
  expandedAccordionId: string;
}

interface FlowDeps {
  win: Window;
  reducedMotion(): boolean;
  // How long the copy takes to swap out, from the page's stylesheet.
  swapDurationMs(): number;
  // Runs before the new slide is drawn, while the old one is still there.
  beforeSlideChange(current: OnboardingState, next: OnboardingState): void;
  // Runs once a new slide is drawn.
  afterSlideChange(next: OnboardingState): void;
  // Lays out the copy where it slides in from before it is released.
  layoutCopy(): void;
}

// The wordmark comes in after the overlay demo blurs out.
function blursOut(blueprint: OnboardingBlueprint, current: OnboardingState, next: OnboardingState): boolean {
  const currentSlide = MODEL.getSlideByIndex(blueprint, current.index);
  const nextSlide = MODEL.getSlideByIndex(blueprint, next.index);
  return Boolean(currentSlide && nextSlide &&
    currentSlide.visual.kind === 'bookmark-focus-surface' &&
    nextSlide.visual.kind === 'lumno-web-wordmark-surface');
}

class OnboardingFlow {
  readonly store: Store<FlowState> = createStore<FlowState>({
    blueprint: null,
    slide: null,
    copySwap: null,
    visualExiting: false,
    pageStripEntering: false,
    expandedAccordionId: ''
  });
  private readonly deps: FlowDeps;
  private swapTimer = 0;

  constructor(deps: FlowDeps) {
    this.deps = deps;
  }

  // The slides in the page's language, opening on the slide the link names.
  load(blueprint: OnboardingBlueprint, requestedIndex: number): void {
    const slide = MODEL.createOnboardingState(blueprint.slides.length, requestedIndex);
    this.store.setState({ blueprint });
    this.commit(slide);
  }

  dispatch(event: OnboardingEvent): void {
    const { blueprint, slide } = this.store.getSnapshot();
    if (!blueprint || !slide) {
      return;
    }
    const next = MODEL.reduceOnboardingState(slide, event);
    if (next.index === slide.index || next.direction === 'none') {
      this.commit(next);
      return;
    }
    this.deps.win.clearTimeout(this.swapTimer);
    if (this.deps.reducedMotion()) {
      this.store.setState({ copySwap: null });
      this.deps.beforeSlideChange(slide, next);
      this.commit(next);
      return;
    }
    this.store.setState({ copySwap: 'exit', visualExiting: blursOut(blueprint, slide, next) });
    this.swapTimer = this.deps.win.setTimeout(() => {
      this.deps.beforeSlideChange(slide, next);
      // The new copy is placed where it slides in from, laid out there, then
      // released so it slides in.
      flushSync(() => {
        this.store.setState({ copySwap: 'enter-start' });
        this.commit(next);
      });
      this.deps.layoutCopy();
      this.store.setState({ copySwap: 'enter' });
    }, this.deps.swapDurationMs());
  }

  toggleAccordion(accordionId: string | undefined): void {
    const id = String(accordionId || '').trim();
    if (id) {
      const current = this.store.getSnapshot().expandedAccordionId;
      this.store.setState({ expandedAccordionId: current === id ? '' : id });
    }
  }

  // A new slide brings its visual in whole.
  private commit(next: OnboardingState): void {
    const previous = this.store.getSnapshot().slide;
    const stripEntered = next.index > 0 && (!previous || previous.index <= 0);
    this.store.setState({
      slide: next,
      visualExiting: false,
      pageStripEntering: previous && previous.index === next.index ? this.store.getSnapshot().pageStripEntering : stripEntered
    });
    this.deps.afterSlideChange(next);
  }
}

export { OnboardingFlow };
export type { FlowDeps, FlowState };
